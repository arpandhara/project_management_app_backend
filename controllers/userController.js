import User from "../models/User.js";

// @desc    Get all users (Team members)
// @route   GET /api/users
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-clerkId"); // Exclude sensitive ID if needed
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

export { getUsers };