import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(['To Do', 'In Progress', 'Done']).optional(), // Fixed 'Done' to match model
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  // 👇 UPDATED: Added new types
  type: z.enum([
    'TASK', 
    'BUG', 
    'IMPROVEMENT', 
    'DESIGN', 
    'CONTENT_WRITING', 
    'SOCIAL_MEDIA', 
    'OTHER'
  ]).optional(),
  projectId: z.string().min(1, "Project ID is required"),
  assignees: z.array(z.string()).optional(),
  dueDate: z.string().datetime({ offset: true }).optional().or(z.date()), 
});