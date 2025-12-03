import { Webhook } from "svix";
import User from "../models/User.js";

export const clerkWebhook = async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local");
  }

  // Get the Headers
  const svix_id = req.headers["svix-id"];
  const svix_timestamp = req.headers["svix-timestamp"];
  const svix_signature = req.headers["svix-signature"];

  // If headers are missing, someone might be attacking your endpoint
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).send("Error occurred -- no svix headers");
  }

  // Use the raw body for verification
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

  // Handle the Event
  const eventType = evt.data.type || evt.type; // Sometimes type is inside data or root
  const { id, email_addresses, username, first_name, last_name, image_url } = evt.data;

  console.log(`Webhook received: ${eventType}`);

  if (eventType === "user.created") {
    try {
      // SAFEGUARD: Check if email exists to prevent crash
      const primaryEmail = email_addresses?.[0]?.email_address;

      if (!primaryEmail) {
        console.log("Skipping user creation: No email found in webhook data.");
        // Return 200 to tell Clerk "We got it, but we can't use it" (prevents retries)
        return res.status(200).json({ message: "No email found, skipped DB save" });
      }

      // Create new user in MongoDB
      const newUser = new User({
        clerkId: id,
        email: primaryEmail,
        username: username || id, // Fallback to ID if username is missing
        firstName: first_name || "",
        lastName: last_name || "",
        photo: image_url || "",
        role: "member"
      });

      await newUser.save();
      console.log("✅ User created in DB:", newUser);
      
    } catch (error) {
      // If user already exists (duplicate key error), we consider it a success
      if (error.code === 11000) {
         console.log("User already exists in DB, skipping.");
         return res.status(200).json({ message: "User already exists" });
      }
      console.error("❌ Error saving user:", error);
      return res.status(500).json({ message: "Database error", error: error.message });
    }
  } 
  
  else if (eventType === "user.updated") {
    try {
      const primaryEmail = email_addresses?.[0]?.email_address;
      
      await User.findOneAndUpdate(
        { clerkId: id },
        {
          // Only update email if it exists
          ...(primaryEmail && { email: primaryEmail }),
          username: username,
          firstName: first_name,
          lastName: last_name,
          photo: image_url,
        }
      );
      console.log("User updated in DB");
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({ message: "Database error" });
    }
  } 
  
  else if (eventType === "user.deleted") {
    try {
      await User.findOneAndDelete({ clerkId: id });
      console.log("User deleted from DB");
    } catch (error) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ message: "Database error" });
    }
  }

  return res.status(200).json({ success: true, message: "Webhook received" });
};