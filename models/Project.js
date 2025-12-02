import mongoose from "mongoose";

const projectSchema = mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: { 
    type: String, 
    enum: ['ACTIVE', 'COMPLETED', 'ARCHIVED'], 
    default: 'ACTIVE' 
  },
  priority: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM'
  },
  startDate: { type: Date },
  dueDate: { type: Date },
  // We will link this to the Clerk User ID later
  ownerId: { type: String, required: true }, 
}, {
  timestamps: true
});

export default projectSchema;