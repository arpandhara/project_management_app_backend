import express from "express";
import dotenv from "dotenv";
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import connectDB from "./config/db.js";
import { errorHandler } from "./middleware/errorMiddleware.js";

// Import Routes
import projectRoutes from "./routes/projectRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js"; // Import webhooks

dotenv.config();
connectDB();

const app = express();

// Security
app.use(helmet());
app.use(cors());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
});
app.use(limiter);

app.use(express.json()); 

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/webhooks', webhookRoutes); // Mount webhook route

app.get('/', (req, res) => {
    res.send('API is running...');
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});