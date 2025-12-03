import express from "express";
import validate from "../middleware/zodValidationMiddleWare.js";
import { createTaskSchema } from "../schemas/taskSchemas.js";
import {
  getTasks,
  createTask,
  deleteTask,
  getUserTasks,
} from "../controllers/taskController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get tasks for a project (Open to all authenticated members)
router.get("/project/:projectId", requireAuth, getTasks);

// We exclude 'viewer' here if you want read-only viewers
router.post(
  "/",
  requireAuth,
  requireRole(["admin", "member"]),
  validate(createTaskSchema),
  createTask
);

// Delete Task (Admins only)
router.delete("/:id", requireAuth, requireRole(["admin"]), deleteTask);

router.get("/user/:userId", requireAuth, getUserTasks);

export default router;
