import Project from '../models/Project.js';
import User from "../models/User.js"; 
import Task from "../models/Task.js";
import Notification from "../models/Notification.js";
import { createClerkClient } from '@clerk/clerk-sdk-node';


// @desc    Get all projects
const getProjects = async (req, res) => {
  try {
    const { userId } = req.auth; 
    const orgId = req.auth.orgId || req.query.orgId;
    let query;
    const targetUserId = req.query.userId || userId;

    if (orgId && orgId !== "undefined" && orgId !== "null") {
      query = { orgId , members: targetUserId};
    } else {
      query = { 
        ownerId: userId, 
        orgId: { $exists: false } 
      };
    }

    const projects = await Project.find(query).sort({ createdAt: -1 }).lean();
    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error: Could not fetch projects' });
  }
};

// @desc    Get single project by ID
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (project) {
      res.json(project);
    } else {
      res.status(404).json({ message: 'Project not found' });
    }
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new project
const createProject = async (req, res) => {
  try {
    const { title, description, status, priority, startDate, dueDate } = req.body;
    const { userId } = req.auth;
    const orgId = req.body.orgId || req.auth.orgId;

    const project = new Project({
      title,
      description :  description || "No Description",
      status,
      priority,
      startDate,
      dueDate,
      ownerId: userId,
      orgId: (orgId && orgId !== "undefined" && orgId !== "null") ? orgId : undefined,
      members: [userId] 
    });

    const createdProject = await project.save();
    res.status(201).json(createdProject);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Invalid project data' });
  }
};

// @desc    Delete a project
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (project) {
      const orgId = project.orgId;

      // DELETE ALL TASKS associated with this project
      await Task.deleteMany({ projectId: project._id });

      // Delete the project itself
      await project.deleteOne();

      //Socket Broadcast
      const io = req.app.get("io");
      if (io && orgId) {
        io.to(`org_${orgId}`).emit("project:deleted", req.params.id);
      }

      res.json({ message: 'Project and all associated tasks removed' });
    } else {
      res.status(404).json({ message: 'Project not found' });
    }
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.status(500).json({ message: 'Server Error: Could not delete project' });
  }
};

// @desc    Add a user to a project
// @route   PUT /api/projects/:id/members
const addProjectMember = async (req, res) => {
  try {
    const { email } = req.body; 
    const project = await Project.findById(req.params.id);
    
    if (!project) return res.status(404).json({ message: "Project not found" });

    const userToAdd = await User.findOne({ email });

    if (!userToAdd) {
      return res.status(404).json({ message: "User not found in the system." });
    }

    // Organization Check
    if (project.orgId) {
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      try {
        const response = await clerkClient.organizations.getOrganizationMembershipList({
          organizationId: project.orgId,
          userId: userToAdd.clerkId, 
        });
        const memberships = Array.isArray(response) ? response : response.data;
        const isActuallyMember = memberships && memberships.some(mem => {
           const memId = mem.publicUserData?.userId || mem.public_user_data?.user_id;
           return memId === userToAdd.clerkId;
        });

        if (!memberships || memberships.length === 0 || !isActuallyMember) {
          return res.status(400).json({ 
            message: "User is not in the Organization's Core Team." 
          });
        }
      } catch (error) {
        return res.status(400).json({ message: "Could not verify organization membership." });
      }
    }

    if (project.members.includes(userToAdd.clerkId)) {
      return res.status(400).json({ message: "User is already a member" });
    }

    project.members.push(userToAdd.clerkId);
    await project.save();

    // Create Notification
    const note = await Notification.create({
      userId: userToAdd.clerkId,
      message: `You have been added to the project: "${project.title}"`,
      type: 'PROJECT_ADD',
      projectId: project._id
    });

    // Broadcast updates
    const io = req.app.get("io");
    if (io) {
      // Notify the specific user they were added
      io.to(`user_${userToAdd.clerkId}`).emit("notification:new", note);
      
      // Update the project room (so the member list updates live for everyone)
      io.to(`project_${project._id}`).emit("project:updated", project);
    }

    res.json({ message: "Member added", member: userToAdd });
  } catch (error) {
    console.error("Server Error in addProjectMember:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Get members of a specific project
const getProjectMembers = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const members = await User.find({ clerkId: { $in: project.members } }).select("firstName lastName email photo clerkId");

    res.json(members);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export { 
  getProjects, 
  getProjectById, 
  createProject, 
  deleteProject,
  addProjectMember,
  getProjectMembers
};