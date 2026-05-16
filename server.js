import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import amg_router from "./Routes/amg-user.js";

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/dhr-backend";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

app.use(cors());
app.use(express.json());
app.use("/amg-securities", amg_router);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});