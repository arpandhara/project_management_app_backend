import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String 
  },
  status: { 
    type: String, 
    enum: ['To Do', 'In Progress', 'Done'], // Matches your frontend options
    default: 'To Do' 
  },
  priority: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM'
  },
  type: {
    type: String,
    enum: ['TASK', 'BUG', 'FEATURE', 'IMPROVEMENT'], // Matches your frontend
    default: 'TASK'
  },
  dueDate: { 
    type: Date 
  },
  
  // Link to the Project this task belongs to
  projectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true 
  },
  
  // Link to the User assigned (Clerk User ID string)
  assigneeId: { 
    type: String 
  } 
}, {
  timestamps: true
});

export default mongoose.model('Task', taskSchema);