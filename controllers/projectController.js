import Project from '../models/Project.js';

// @desc    Get all projects
// @route   GET /api/projects
// @access  Public / Viewer
const getProjects = async (req, res) => {
  try {
    // Clerk automatically provides userId AND orgId (if an org is selected)
    const { userId, orgId } = req.auth; 

    let query;

    if (orgId) {
      // 🏢 ORGANIZATION MODE:
      // Fetch projects that belong to this specific Organization
      query = { orgId };
    } else {
      // 👤 PERSONAL MODE:
      // Fetch projects owned by the user that DO NOT belong to an organization
      // (This prevents Org projects from showing up in Personal workspace)
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
// @route   GET /api/projects/:id
// @access  Public / Viewer
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
    // Check if error is due to invalid ObjectId format
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new project
// @route   POST /api/projects
// @access  Admin Only
const createProject = async (req, res) => {
  try {
    const { title, description, status, priority, startDate, dueDate } = req.body;
    const { userId, orgId } = req.auth;

    const project = new Project({
      title,
      description,
      status,
      priority,
      startDate,
      dueDate,
      ownerId: userId,
      
      // 👇 Save the Org ID if one is active. If not, it saves as undefined (Personal)
      orgId: orgId || undefined, 
      
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
// @route   DELETE /api/projects/:id
// @access  Admin Only
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (project) {
      await project.deleteOne();
      res.json({ message: 'Project removed' });
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

export { 
  getProjects, 
  getProjectById, 
  createProject, 
  deleteProject 
};