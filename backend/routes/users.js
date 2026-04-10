import express from "express";
import { verifyAdmin } from "../middleware/auth.js";
import admin from "firebase-admin";

const router = express.Router();

// ✅ GET ALL USERS (PROTECTED)
router.get("/users", verifyAdmin, async (req, res) => {
  try {
    const listUsers = await admin.auth().listUsers(1000);

    const users = listUsers.users.map((user) => ({
      uid: user.uid,
      email: user.email,
      createdAt: user.metadata.creationTime,
    }));

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

export default router;