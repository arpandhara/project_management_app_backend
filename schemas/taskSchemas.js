import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(['To Do', 'In Progress', 'Completed']).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  type: z.enum(['TASK', 'BUG', 'FEATURE', 'IMPROVEMENT']).optional(),
  projectId: z.string().min(1, "Project ID is required"),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime({ offset: true }).optional().or(z.date()), 
});