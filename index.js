import express from "express";
import dotenv from "dotenv";
await dotenv.config();
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

// Import Routes
import connectDB from "./config/db.js";
import errorHandler from "./middleware/errorMiddleware.js";
import projectRoutes from "./routes/projectRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import taskRoutes from "./routes/taskRoutes.js"; // Import Tasks
import userRoutes from "./routes/userRoutes.js";
import adminActionRoutes from "./routes/adminActionRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

await connectDB();

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
});
app.use(limiter);

// Routes
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes); // Mount Tasks
app.use("/api/webhooks", webhookRoutes);
app.use("/api/users", userRoutes);
app.use('/api/admin-actions', adminActionRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
