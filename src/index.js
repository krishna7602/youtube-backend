import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";
import express from "express"


app.use(express.json());
app.use(express.urlencoded({ extended: true }));



dotenv.config({
  path: "./env", // Ensure the path to your `.env` file is correct
});

connectDB()
  .then(() => {
    const PORT = 8000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log("MongoDB connection failed", error);
  });
