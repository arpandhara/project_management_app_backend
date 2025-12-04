import { Webhook } from "svix";
import User from "../models/User.js";
import Project from "../models/Project.js"; 
import Task from "../models/Task.js"

export const clerkWebhook = async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local");
  }

  // Get the Headers
  const svix_id = req.headers["svix-id"];
  const svix_timestamp = req.headers["svix-timestamp"];
  const svix_signature = req.headers["svix-signature"];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).send("Error occurred -- no svix headers");
  }

  // Verify Payload
  const payload = req.rawBody;
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt;

  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return res.status(400).json({ "Error": err.message });
  }

  // Handle Events
  const eventType = evt.type;
  const data = evt.data;

  console.log(`Webhook received: ${eventType}`);

  if (eventType === "user.created") {
    // ... (Existing user.created logic)
    try {
      const primaryEmail = data.email_addresses?.[0]?.email_address;
      if (!primaryEmail) return res.status(200).json({ message: "No email found" });

      const newUser = new User({
        clerkId: data.id,
        email: primaryEmail,
        username: data.username || data.id,
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        photo: data.image_url || "",
        role: "member"
      });

      await newUser.save();
      console.log("✅ User created in DB");
    } catch (error) {
      if (error.code === 11000) return res.status(200).json({ message: "User exists" });
      console.error("❌ Error saving user:", error);
      return res.status(500).json({ message: "Database error" });
    }
  } 
  
  else if (eventType === "user.updated") {
    // ... (Existing user.updated logic)
    try {
      const primaryEmail = data.email_addresses?.[0]?.email_address;
      await User.findOneAndUpdate(
        { clerkId: data.id },
        {
          ...(primaryEmail && { email: primaryEmail }),
          username: data.username,
          firstName: data.first_name,
          lastName: data.last_name,
          photo: data.image_url,
        }
      );
      console.log("✅ User updated in DB");
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({ message: "Database error" });
    }
  } 
  
  else if (eventType === "user.deleted") {
    try {
      await User.findOneAndDelete({ clerkId: data.id });
      // 👇 NEW: Also remove them from ALL projects if they delete their account
      await Project.updateMany({}, { $pull: { members: data.id } });
      console.log("✅ User deleted from DB and Projects");
    } catch (error) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ message: "Database error" });
    }
  }

  // 👇 NEW SECTION: Handle Organization Membership Deletion (Kicked/Left)
  else if (eventType === "organizationMembership.deleted") {
    try {
      // Extract IDs. Structure depends on API version, safe check both:
      const organizationId = data.organization?.id || data.organization_id;
      const userId = data.public_user_data?.user_id || data.user_id;

      if (organizationId && userId) {
        // Remove this user from the 'members' array of ALL projects in this Org
        await Project.updateMany(
          { orgId: organizationId },
          { $pull: { members: userId } }
        );
        console.log(`✅ Synced: Removed user ${userId} from all projects in Org ${organizationId}`);
      } else {
        console.log("⚠️ Skipped project sync: Missing ID in webhook payload");
      }
    } catch (error) {
      console.error("❌ Error syncing project members:", error);
      return res.status(500).json({ message: "Database error during sync" });
    }
  }
  else if (eventType === "organization.deleted") {
    try {
      const orgId = data.id;

      if (!orgId) {
        console.log("⚠️ Skipped org deletion: Missing ID");
        return res.status(200).json({ message: "Missing ID" });
      }

      // 1. Find all projects to get their IDs
      const projects = await Project.find({ orgId });
      const projectIds = projects.map(p => p._id);

      // 2. Delete all Tasks associated with these projects
      if (projectIds.length > 0) {
        const taskResult = await Task.deleteMany({ projectId: { $in: projectIds } });
        console.log(`🗑️ Deleted ${taskResult.deletedCount} tasks.`);
      }

      // 3. Delete the Projects
      const projectResult = await Project.deleteMany({ orgId });
      console.log(`✅ Organization Deleted: Removed ${projectResult.deletedCount} projects for Org ${orgId}`);

    } catch (error) {
      console.error("❌ Error syncing organization deletion:", error);
      return res.status(500).json({ message: "Database error" });
    }
  }
  return res.status(200).json({ success: true, message: "Webhook received" });
};