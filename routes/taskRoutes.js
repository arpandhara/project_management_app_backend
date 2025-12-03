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

router.get("/project/:projectId", requireAuth, getTasks);


router.post(
  "/",
  requireAuth,
  requireRole(["admin", "org:admin"]), 
  validate(createTaskSchema),
  createTask
);

router.delete("/:id", requireAuth, requireRole(["admin"]), deleteTask);
router.get("/user/:userId", requireAuth, getUserTasks);

export default router;