import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'INFO' },
  projectId: { type: String },
  read: { type: Boolean, default: false } // Tracks if user has seen it
}, { timestamps: true });

export default mongoose.model("Notification", notificationSchema);