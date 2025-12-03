import AdminRequest from "../models/AdminRequest.js";
import { createClerkClient } from '@clerk/clerk-sdk-node';
import dotenv from "dotenv";
dotenv.config();

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// @desc    Request to demote an admin
const requestDemotion = async (req, res) => {
  const { targetUserId } = req.body;
  const requesterId = req.auth.userId;
  
  // 👇 FIX: Check body for orgId fallback
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

// @desc    Approve a demotion request
const approveDemotion = async (req, res) => {
  const { requestId } = req.params;
  const approverId = req.auth.userId;

  try {
    const request = await AdminRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.requesterUserId === approverId) {
      return res.status(403).json({ message: "You cannot approve your own request. Another admin is required." });
    }

    // Execute Change in Clerk
    await clerkClient.organizations.updateOrganizationMembership({
      organizationId: request.orgId,
      userId: request.targetUserId,
      role: "org:member"
    });

    // Clear Request
    await AdminRequest.findByIdAndDelete(requestId);

    res.json({ message: "Demotion approved and executed." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to execute demotion." });
  }
};

// @desc    Get pending requests
const getPendingRequests = async (req, res) => {
  try {
    // 👇 FIX: Check query for orgId fallback
    const orgId = req.auth.orgId || req.query.orgId;
    
    if (!orgId) return res.json([]); // Return empty if no org context

    const requests = await AdminRequest.find({ orgId });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Promote a member to Admin (Immediate)
const promoteMember = async (req, res) => {
  const { targetUserId } = req.body;
  // Check body for orgId (required for manual requests)
  const orgId = req.auth.orgId || req.body.orgId;

  try {
    await clerkClient.organizations.updateOrganizationMembership({
      organizationId: orgId,
      userId: targetUserId,
      role: "org:admin"
    });
    res.json({ message: "Member promoted to Admin successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to promote member." });
  }
};

export { requestDemotion, approveDemotion, getPendingRequests , promoteMember };