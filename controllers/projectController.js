import Project from '../models/Project.js';

// @desc    Get all projects
// @route   GET /api/projects
// @access  Public / Viewer
const getProjects = async (req, res) => {
  try {
    // .lean() is a Mongoose optimization for faster read-only queries
    const projects = await Project.find().sort({ createdAt: -1 }).lean();
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

    const project = new Project({
      title,
      description,
      status,
      priority,
      startDate,
      dueDate,
      // We attach the Clerk User ID from the auth middleware
      ownerId: req.auth.userId 
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