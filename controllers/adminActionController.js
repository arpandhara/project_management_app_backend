import AdminRequest from "../models/AdminRequest.js";
import User from "../models/User.js"; // Import User model to update MongoDB
import { createClerkClient } from '@clerk/clerk-sdk-node';
import dotenv from "dotenv";
dotenv.config();

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// @desc    Request to demote an admin
const requestDemotion = async (req, res) => {
  const { targetUserId } = req.body;
  const requesterId = req.auth.userId;
  
  const orgId = req.auth.orgId || req.body.orgId; 

  if (!orgId) return res.status(400).json({ message: "Organization ID required" });

  try {
    const existing = await AdminRequest.findOne({ 
      targetUserId, 
      orgId, 
      status: 'PENDING' 
    });

    if (existing) {
      return res.status(400).json({ message: "A request for this user is already pending." });
    }

    await AdminRequest.create({
      targetUserId,
      requesterUserId: requesterId,
      orgId
    });

    res.json({ message: "Demotion requested. Waiting for another admin to approve." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve a demotion request (Updates Org, Metadata, and MongoDB)
const approveDemotion = async (req, res) => {
  const { requestId } = req.params;
  const approverId = req.auth.userId;

  try {
    const request = await AdminRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.requesterUserId === approverId) {
      return res.status(403).json({ message: "You cannot approve your own request. Another admin is required." });
    }

    // 1. Update Organization Membership (Clerk)
    await clerkClient.organizations.updateOrganizationMembership({
      organizationId: request.orgId,
      userId: request.targetUserId,
      role: "org:member"
    });

    // 2. Update User Metadata (Clerk Global Role)
    await clerkClient.users.updateUserMetadata(request.targetUserId, {
      publicMetadata: {
        role: "member"
      }
    });

    // 3. Update MongoDB User Role
    await User.findOneAndUpdate(
      { clerkId: request.targetUserId },
      { role: "member" }
    );

    // Clear Request
    await AdminRequest.findByIdAndDelete(requestId);

    res.json({ message: "Demotion approved and executed successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to execute demotion." });
  }
};

// @desc    Get pending requests
const getPendingRequests = async (req, res) => {
  try {
    const orgId = req.auth.orgId || req.query.orgId;
    
    if (!orgId) return res.json([]); 

    const requests = await AdminRequest.find({ orgId });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Promote a member to Admin (Updates Org, Metadata, and MongoDB)
const promoteMember = async (req, res) => {
  const { targetUserId } = req.body;
  const orgId = req.auth.orgId || req.body.orgId;

  try {
    // 1. Update Organization Membership (Clerk)
    await clerkClient.organizations.updateOrganizationMembership({
      organizationId: orgId,
      userId: targetUserId,
      role: "org:admin"
    });

    // 2. Update User Metadata (Clerk Global Role)
    await clerkClient.users.updateUserMetadata(targetUserId, {
      publicMetadata: {
        role: "admin"
      }
    });

    // 3. Update MongoDB User Role
    await User.findOneAndUpdate(
      { clerkId: targetUserId },
      { role: "admin" }
    );

    res.json({ message: "Member promoted to Admin successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to promote member." });
  }
};


const requestOrgDeletion = async (req, res) => {
  const requesterId = req.auth.userId;
  const orgId = req.auth.orgId || req.body.orgId;

  if (!orgId) return res.status(400).json({ message: "Organization ID required" });

  try {
    // Check if request already exists
    const existing = await AdminRequest.findOne({ 
      orgId, 
      type: 'DELETE_ORG',
      status: 'PENDING' 
    });

    if (existing) {
      return res.status(400).json({ message: "A deletion request for this organization is already pending." });
    }

    await AdminRequest.create({
      requesterUserId: requesterId,
      orgId,
      type: 'DELETE_ORG'
    });

    res.json({ message: "Deletion requested. Waiting for another admin to approve." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveOrgDeletion = async (req, res) => {
  const { requestId } = req.params;
  const approverId = req.auth.userId;

  try {
    const request = await AdminRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.type !== 'DELETE_ORG') return res.status(400).json({ message: "Invalid request type" });

    if (request.requesterUserId === approverId) {
      return res.status(403).json({ message: "You cannot approve your own deletion request." });
    }

    const orgId = request.orgId;

    // 1. Delete from Clerk
    await clerkClient.organizations.deleteOrganization(orgId);

    // 2. Clean up Local DB (Projects & Tasks)
    // Find all projects in this org to delete their tasks first
    const projects = await Project.find({ orgId });
    const projectIds = projects.map(p => p._id);

    await Task.deleteMany({ projectId: { $in: projectIds } });
    await Project.deleteMany({ orgId });

    // 3. Delete All Pending Requests for this Org
    await AdminRequest.deleteMany({ orgId });

    res.json({ message: "Organization deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete organization." });
  }
};

export { requestDemotion, approveDemotion, getPendingRequests , promoteMember , requestOrgDeletion , approveOrgDeletion };