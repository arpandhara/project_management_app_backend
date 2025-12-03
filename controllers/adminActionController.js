import AdminRequest from "../models/AdminRequest.js";
import { createClerkClient } from '@clerk/clerk-sdk-node';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// @desc    Request to demote an admin (Requires 2nd approval)
// @route   POST /api/admin-actions/demote/request
const requestDemotion = async (req, res) => {
  const { targetUserId } = req.body;
  const requesterId = req.auth.userId;
  const orgId = req.auth.orgId;

  try {
    // Check if request already exists
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

// @desc    Approve a demotion request (Must be different admin)
// @route   POST /api/admin-actions/demote/approve/:requestId
const approveDemotion = async (req, res) => {
  const { requestId } = req.params;
  const approverId = req.auth.userId;

  try {
    const request = await AdminRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    // 🛑 SECURITY: The approver cannot be the same person who requested it
    if (request.requesterUserId === approverId) {
      return res.status(403).json({ message: "You cannot approve your own request. Another admin is required." });
    }

    // 1. Execute Change in Clerk
    await clerkClient.organizations.updateOrganizationMembership({
      organizationId: request.orgId,
      userId: request.targetUserId,
      role: "org:member"
    });

    // 2. Clear Request
    await AdminRequest.findByIdAndDelete(requestId);

    res.json({ message: "Demotion approved and executed." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to execute demotion." });
  }
};

// @desc    Get pending requests for this Org
// @route   GET /api/admin-actions/pending
const getPendingRequests = async (req, res) => {
  try {
    const requests = await AdminRequest.find({ orgId: req.auth.orgId });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

export { requestDemotion, approveDemotion, getPendingRequests };