import Task from '../models/Task.js';

// @desc    Get tasks for a specific project
// @route   GET /api/tasks/project/:projectId
const getTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = await Task.find({ projectId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new task
// @route   POST /api/tasks
const createTask = async (req, res) => {
  try {
    // Zod middleware has already validated req.body
    const task = new Task(req.body);
    const createdTask = await task.save();
    res.status(201).json(createdTask);
  } catch (error) {
    res.status(400).json({ message: 'Invalid task data' });
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
const deleteTask = async (req, res) => {
    try {
      const task = await Task.findById(req.params.id);
      if (task) {
        await task.deleteOne();
        res.json({ message: 'Task removed' });
      } else {
        res.status(404).json({ message: 'Task not found' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Server Error' });
    }
  };

export { getTasks, createTask, deleteTask };