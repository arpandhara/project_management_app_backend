import Task from "../models/Task.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import nodemailer from "nodemailer";

// @desc    Get tasks for a specific project
// @route   GET /api/tasks/project/:projectId
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
// @route   POST /api/tasks
const createTask = async (req, res) => {
  try {
    // Zod middleware has already validated req.body
    const task = new Task(req.body);
    const createdTask = await task.save();

    // 3. Handle Notifications & Emails
    if (createdTask.assignees && createdTask.assignees.length > 0) {
      // Filter out the creator (don't notify yourself)
      const assigneesToNotify = createdTask.assignees.filter(
        (id) => id !== req.auth.userId
      );

      if (assigneesToNotify.length > 0) {
        // A. In-App Notifications (Existing Logic)
        const notifications = assigneesToNotify.map((userId) => ({
          userId,
          message: `You have been assigned to task: "${createdTask.title}"`,
          type: "TASK_ASSIGN",
          projectId: createdTask.projectId,
        }));
        await Notification.insertMany(notifications);

        // B. 👇 NEW: Send Emails
        try {
          // Fetch user details to get email addresses
          const usersToEmail = await User.find({
            clerkId: { $in: assigneesToNotify },
          });

          // Configure Transporter (Use App Password for Gmail)
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.EMAIL_USER, // Your Email
              pass: process.env.EMAIL_PASS, // Your App Password
            },
          });

          // Send emails in parallel
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
                      <p><strong>Due Date:</strong> ${
                        createdTask.dueDate
                          ? new Date(createdTask.dueDate).toLocaleDateString()
                          : "No due date"
                      }</p>
                    </blockquote>
                    <p>Please check your dashboard for more details.</p>
                    <p>Best regards,<br/>The Team</p>
                  </div>
                `,
              };

              return transporter.sendMail(mailOptions);
            })
          );
          console.log("📧 Emails sent to assignees");
        } catch (emailErr) {
          console.error("❌ Failed to send emails:", emailErr);
          // We don't fail the request here, just log the error
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
// @route   DELETE /api/tasks/:id
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (task) {
      await task.deleteOne();
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
    // Find tasks where assigneeId matches
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
    // Check if user is Org Admin or Global Admin
    const isOrgAdmin = req.auth.orgRole === "org:admin";
    const isGlobalAdmin =
      req.auth.sessionClaims?.publicMetadata?.role === "admin";
    const isAdmin = isOrgAdmin || isGlobalAdmin;

    const task = await Task.findById(id).populate("projectId", "title ownerId");

    if (!task) return res.status(404).json({ message: "Task not found" });

    // PERMISSION CHECK:
    // 1. Admin -> Allow
    // 2. Assignee -> Allow
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
    const isGlobalAdmin =
      req.auth.sessionClaims?.publicMetadata?.role === "admin";
    const isAdmin = isOrgAdmin || isGlobalAdmin;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const isAssignee = task.assignees.includes(userId);

    if (!isAdmin && !isAssignee) {
      return res.status(403).json({ message: "Access Denied" });
    }

    // ROLE-BASED UPDATE LOGIC
    if (isAdmin) {
      // Admin can update everything
      Object.assign(task, updates);
    } else if (isAssignee) {
      // Assignee can ONLY update Status and Attachments
      if (updates.status) task.status = updates.status;
      if (updates.attachments) task.attachments = updates.attachments;
      // Note: We ignore other fields if sent by a non-admin
    }

    await task.save();
    res.json(task);
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Failed to update task" });
  }
};

const inviteToTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { targetUserId } = req.body; // The person being invited
    const senderId = req.auth.userId;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // Ensure sender is actually assigned to the task (or is admin)
    const isAssignee = task.assignees.includes(senderId);
    const isAdmin = req.auth.orgRole === "org:admin";

    if (!isAssignee && !isAdmin) {
      return res
        .status(403)
        .json({ message: "Only assignees can invite others." });
    }

    // Check if target is already assigned
    if (task.assignees.includes(targetUserId)) {
      return res.status(400).json({ message: "User is already assigned." });
    }

    // Create Notification for Target User
    await Notification.create({
      userId: targetUserId,
      message: `Help Request: Please help with task "${task.title}"`,
      type: "TASK_INVITE",
      projectId: task.projectId,
      metadata: {
        taskId: task._id,
        senderId: senderId,
      },
    });

    res.json({ message: "Invitation sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

//  Handle Accept/Decline
const respondToTaskInvite = async (req, res) => {
  try {
    const { notificationId, action } = req.body; // action = 'ACCEPT' or 'DECLINE'
    const userId = req.auth.userId;

    const notification = await Notification.findById(notificationId);
    if (!notification)
      return res.status(404).json({ message: "Notification not found" });

    // Security Check
    if (notification.userId !== userId)
      return res.status(403).json({ message: "Not authorized" });

    const { taskId, senderId } = notification.metadata || {};

    if (action === "ACCEPT") {
      // 1. Add user to task assignees
      await Task.findByIdAndUpdate(taskId, {
        $addToSet: { assignees: userId }, // Prevent duplicates
      });

      // 2. Notify Sender
      await Notification.create({
        userId: senderId,
        message: `Accepted: User has joined task`,
        type: "INFO",
        projectId: notification.projectId,
      });
    } else {
      // Decline: Just notify sender
      await Notification.create({
        userId: senderId,
        message: `Declined: User cannot help with task`,
        type: "INFO",
        projectId: notification.projectId,
      });
    }

    // 3. Delete the invitation notification so it can't be clicked again
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
