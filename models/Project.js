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
  
  ownerId: { type: String, required: true },
  
  // 👇 NEW: List of User IDs allowed to see this project
  members: [{ type: String }] 
}, {
  timestamps: true
});

export default mongoose.model('Project', projectSchema);