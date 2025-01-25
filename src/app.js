import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CROSS_ORIGIN || "http://localhost:3000", // Default origin
    credentials: true,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes
import userRouter from "./routes/user.routes.js";
app.use("/api/v1/users", userRouter); // Attach the user router to the "/api/v1/users" path

export default app;
