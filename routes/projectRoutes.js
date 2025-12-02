import express from 'express';
import validate from '../middleware/zodValidationMiddleWare.js';
import { createProjectSchema } from '../schemas/projectSchema.js';
import { getProjects, createProject, deleteProject } from '../controllers/projectController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Route: GET /api/projects
router.get('/', requireAuth, getProjects);


router.post('/', 
  requireAuth, 
  requireRole(['admin']), 
  validate(createProjectSchema), 
  createProject
);

// Route: DELETE /api/projects/:id
router.delete('/:id', 
  requireAuth, 
  requireRole(['admin']), 
  deleteProject
);

export default router;