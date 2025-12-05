import Task from "../models/Task.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import nodemailer from "nodemailer";

// @desc    Get tasks for a specific project
const getTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = await Task.find({ projectId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Create a new task
const createTask = async (req, res) => {
  try {
    const task = new Task(req.body);
    const createdTask = await task.save();

    // ⚡ SOCKET: Broadcast to Project Room
    const io = req.app.get("io");
    if (io) {
      io.to(`project_${createdTask.projectId}`).emit("task:created", createdTask);
      console.log(`📡 Emitted task:created to project_${createdTask.projectId}`);
    }

    // 3. Handle Notifications & Emails
    if (createdTask.assignees && createdTask.assignees.length > 0) {
      const assigneesToNotify = createdTask.assignees.filter(
        (id) => id !== req.auth.userId
      );

      if (assigneesToNotify.length > 0) {
        // A. In-App Notifications
        const notifications = assigneesToNotify.map((userId) => ({
          userId,
          message: `You have been assigned to task: "${createdTask.title}"`,
          type: "TASK_ASSIGN",
          projectId: createdTask.projectId,
        }));
        
        // Save to DB
        const savedNotifications = await Notification.insertMany(notifications);

        // ⚡ SOCKET: Notify specific users
        if (io) {
          savedNotifications.forEach((note) => {
            io.to(`user_${note.userId}`).emit("notification:new", note);
            console.log(`🔔 Notification sent to user_${note.userId}`);
          });
        }

        // B. Send Emails (Keep existing logic)
        try {
          const usersToEmail = await User.find({
            clerkId: { $in: assigneesToNotify },
          });

          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          await Promise.all(
            usersToEmail.map((user) => {
              if (!user.email) return;
              const mailOptions = {
                from: `"Project Manager" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: `New Task Assigned: ${createdTask.title}`,
                html: `
                  <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2>New Task Assignment</h2>
                    <p>Hi <strong>${user.firstName || "Member"}</strong>,</p>
                    <p>You have been assigned to a new task:</p>
                    <blockquote style="border-left: 4px solid #2563eb; padding-left: 10px; margin: 20px 0;">
                      <p><strong>Title:</strong> ${createdTask.title}</p>
                      <p><strong>Priority:</strong> ${createdTask.priority}</p>
                    </blockquote>
                    <p>Best regards,<br/>The Team</p>
                  </div>
                `,
              };
              return transporter.sendMail(mailOptions);
            })
          );
        } catch (emailErr) {
          console.error("❌ Failed to send emails:", emailErr);
        }
      }
    }

    res.status(201).json(createdTask);
  } catch (error) {
    console.error("Create Task Error:", error);
    res.status(400).json({ message: "Invalid task data" });
  }
};

// @desc    Delete a task
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (task) {
      const projectId = task.projectId;
      await task.deleteOne();

      // ⚡ SOCKET: Update Project Board
      const io = req.app.get("io");
      if (io) {
        io.to(`project_${projectId}`).emit("task:deleted", req.params.id);
      }

      res.json({ message: "Task removed" });
    } else {
      res.status(404).json({ message: "Task not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

const getUserTasks = async (req, res) => {
  try {
    const { userId } = req.params;
    const tasks = await Task.find({ assignees: userId }).populate(
      "projectId",
      "title"
    );
    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.auth.userId;
    const isOrgAdmin = req.auth.orgRole === "org:admin";
    const isGlobalAdmin = req.auth.sessionClaims?.publicMetadata?.role === "admin";
    const isAdmin = isOrgAdmin || isGlobalAdmin;

    const task = await Task.findById(id).populate("projectId", "title ownerId");

    if (!task) return res.status(404).json({ message: "Task not found" });

    const isAssignee = task.assignees.includes(userId);

    if (!isAdmin && !isAssignee) {
      return res
        .status(403)
        .json({ message: "Access Denied. You are not assigned to this task." });
    }

    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.auth.userId;
    const isOrgAdmin = req.auth.orgRole === "org:admin";
    const isGlobalAdmin = req.auth.sessionClaims?.publicMetadata?.role === "admin";
    const isAdmin = isOrgAdmin || isGlobalAdmin;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const isAssignee = task.assignees.includes(userId);

    if (!isAdmin && !isAssignee) {
      return res.status(403).json({ message: "Access Denied" });
    }

    if (isAdmin) {
      Object.assign(task, updates);
    } else if (isAssignee) {
      if (updates.status) task.status = updates.status;
      if (updates.attachments) task.attachments = updates.attachments;
    }

    await task.save();

    // ⚡ SOCKET: Real-time update
    const io = req.app.get("io");
    if (io) {
      io.to(`project_${task.projectId}`).emit("task:updated", task);
    }

    res.json(task);
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Failed to update task" });
  }
};

const inviteToTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { targetUserId } = req.body;
    const senderId = req.auth.userId;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const isAssignee = task.assignees.includes(senderId);
    const isAdmin = req.auth.orgRole === "org:admin";

    if (!isAssignee && !isAdmin) {
      return res.status(403).json({ message: "Only assignees can invite others." });
    }

    if (task.assignees.includes(targetUserId)) {
      return res.status(400).json({ message: "User is already assigned." });
    }

    // Create Notification
    const note = await Notification.create({
      userId: targetUserId,
      message: `Help Request: Please help with task "${task.title}"`,
      type: "TASK_INVITE",
      projectId: task.projectId,
      metadata: {
        taskId: task._id,
        senderId: senderId,
      },
    });

    // ⚡ SOCKET: Notify target
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${targetUserId}`).emit("notification:new", note);
    }

    res.json({ message: "Invitation sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

const respondToTaskInvite = async (req, res) => {
  try {
    const { notificationId, action } = req.body;
    const userId = req.auth.userId;

    const notification = await Notification.findById(notificationId);
    if (!notification) return res.status(404).json({ message: "Notification not found" });

    if (notification.userId !== userId) return res.status(403).json({ message: "Not authorized" });

    const { taskId, senderId } = notification.metadata || {};
    const io = req.app.get("io"); // Get IO instance

    if (action === "ACCEPT") {
      const updatedTask = await Task.findByIdAndUpdate(
        taskId, 
        { $addToSet: { assignees: userId } }, 
        { new: true } // Return updated doc
      );

      // ⚡ SOCKET: Update project board with new assignee
      if (io) {
        io.to(`project_${notification.projectId}`).emit("task:updated", updatedTask);
      }

      // Notify Sender
      const replyNote = await Notification.create({
        userId: senderId,
        message: `Accepted: User has joined task`,
        type: "INFO",
        projectId: notification.projectId,
      });

      // ⚡ SOCKET: Notify sender
      if (io) io.to(`user_${senderId}`).emit("notification:new", replyNote);

    } else {
      // Decline
      const replyNote = await Notification.create({
        userId: senderId,
        message: `Declined: User cannot help with task`,
        type: "INFO",
        projectId: notification.projectId,
      });

      // ⚡ SOCKET: Notify sender
      if (io) io.to(`user_${senderId}`).emit("notification:new", replyNote);
    }

    await notification.deleteOne();
    res.json({ message: `Invitation ${action.toLowerCase()}ed` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export {
  getTasks,
  createTask,
  deleteTask,
  getUserTasks,
  getTaskById,
  updateTask,
  inviteToTask,
  respondToTaskInvite,
};