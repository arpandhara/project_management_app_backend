import { Webhook } from "svix";
import User from "../models/User.js";

export const clerkWebhook = async (req, res) => {
  // Get the secret from your .env (You will get this from Clerk Dashboard later)
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

  const body = req.body; 
  const payload = JSON.stringify(body); 


  //Verify the Webhook Signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt;

  try {
    // We pass the payload string and headers to verify it actually came from Clerk
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return res.status(400).json({ "Error": err.message });
  }

  //Handle the Event
  const eventType = evt.type;
  const { id, email_addresses, username, first_name, last_name, image_url } = evt.data;

  console.log(`Webhook received: ${eventType}`);

  if (eventType === "user.created") {
    try {
      // Create new user in MongoDB
      const newUser = new User({
        clerkId: id,
        email: email_addresses[0].email_address,
        username: username || "",
        firstName: first_name || "",
        lastName: last_name || "",
        photo: image_url || "",
        role: "member" // Default role
      });

      await newUser.save();
      console.log("User created in DB:", newUser);
    } catch (error) {
      console.error("Error saving user:", error);
      return res.status(500).json({ message: "Database error" });
    }
  } else if (eventType === "user.updated") {
    try {
      await User.findOneAndUpdate(
        { clerkId: id },
        {
          email: email_addresses[0].email_address,
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
  } else if (eventType === "user.deleted") {
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