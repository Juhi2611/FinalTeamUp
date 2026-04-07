import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ CONNECT ADMIN ROUTES
app.use("/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("Admin backend running 🚀");
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});