import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: { 
    type: String, 
    enum: ['To Do', 'In Progress', 'Done'], 
    default: 'To Do' 
  },
  priority: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM'
  },
  type: {
    type: String,
    enum: ['TASK', 'BUG', 'IMPROVEMENT', 'DESIGN', 'CONTENT_WRITING', 'SOCIAL_MEDIA', 'OTHER'], 
    default: 'TASK'
  },
  dueDate: { type: Date },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  assignees: [{ type: String }],
  

  attachments: [{
    type: { type: String, enum: ['DOC', 'GITHUB', 'LINK'], default: 'LINK' },
    name: { type: String, required: true },
    url: { type: String, required: true }
  }]
}, {
  timestamps: true
});

export default mongoose.model('Task', taskSchema);