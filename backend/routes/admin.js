import express from "express";
import jwt from "jsonwebtoken";
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import admin, { db } from "../config/firebase.js";

const router = express.Router();

// 🔐 ADMIN LOGIN
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (
    email !== process.env.ADMIN_EMAIL ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = jwt.sign(
    { role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );

  res.json({ token });
});

// 👥 GET ALL USERS (AUTH + FIRESTORE MERGED)
router.get("/users", verifyAdmin, async (req, res) => {
  try {
    const listUsers = await admin.auth().listUsers(1000);

    const users = await Promise.all(
      listUsers.users.map(async (user) => {
        const doc = await db.collection("profiles").doc(user.uid).get();
        const extra = doc.exists ? doc.data() : {};

        return {
          id: user.uid,
          email: user.email || null,
          fullName: extra.fullName || null,
          username: extra.username || null,
          avatar: extra.avatar || null,
          role: extra.primaryRole || null,
          college: extra.college || null,
          createdAt: user.metadata.creationTime,
          lastLogin: user.metadata.lastSignInTime,
          isVerified: extra.isProfileVerified || false,
          skillsVerified: extra.skillsVerified || false,
        };
      })
    );

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// 🗑️ DELETE USER
router.delete("/user/:id", verifyAdmin, async (req, res) => {
  const userId = req.params.id;
  try {
    await db.collection("profiles").doc(userId).delete();
    await admin.auth().deleteUser(userId);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
});

// 🏢 GET ALL TEAMS
router.get("/teams", verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("teams").get();
    const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(teams);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch teams" });
  }
});

// 🗑️ DELETE TEAM
router.delete("/team/:id", verifyAdmin, async (req, res) => {
  const teamId = req.params.id;
  try {
    // Remove team from all member profiles
    const teamDoc = await db.collection("teams").doc(teamId).get();
    if (teamDoc.exists) {
      const teamData = teamDoc.data();
      const members = teamData.members || [];
      await Promise.allSettled(
        members.map(async (member) => {
          const profileRef = db.collection("profiles").doc(member.userId);
          const profileDoc = await profileRef.get();
          if (profileDoc.exists) {
            const profile = profileDoc.data();
            await profileRef.update({
              teamIds: (profile.teamIds || []).filter(id => id !== teamId),
              leaderOfTeamIds: (profile.leaderOfTeamIds || []).filter(id => id !== teamId),
            });
          }
        })
      );
    }
    await db.collection("teams").doc(teamId).delete();
    res.json({ message: "Team deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
});

// 📊 ANALYTICS
router.get("/analytics", verifyAdmin, async (req, res) => {
  try {
    const listUsers = await admin.auth().listUsers(1000);
    const growthMap = {};
    listUsers.users.forEach((user) => {
      const date = new Date(user.metadata.creationTime).toLocaleDateString();
      if (!growthMap[date]) growthMap[date] = 0;
      growthMap[date]++;
    });
    const chartData = Object.keys(growthMap).map((date) => ({
      name: date,
      users: growthMap[date],
    }));
    res.json(chartData);
  } catch (err) {
    res.status(500).json({ message: "Analytics failed" });
  }
});

// 📝 GET ALL POSTS (activity feed — all types)
router.get("/posts", verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("posts").orderBy("createdAt", "desc").get();
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

// ⭐ GET ALL RATINGS (with rater name resolved from profiles/auth)
router.get("/ratings", verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("ratings").orderBy("createdAt", "desc").get();

    const resolveProfile = async (uid) => {
      if (!uid) return null;
      try {
        const d = await db.collection("profiles").doc(uid).get();
        if (d.exists) {
          const p = d.data();
          if (p.fullName || p.username) return { fullName: p.fullName || null, username: p.username || null, avatar: p.avatar || null };
        }
      } catch (_) {}
      try {
        const authUser = await admin.auth().getUser(uid);
        return { fullName: authUser.displayName || null, username: null, avatar: authUser.photoURL || null, email: authUser.email || null };
      } catch (_) {}
      return null;
    };

    const ratings = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = { id: doc.id, ...doc.data() };
        data.raterProfile = await resolveProfile(data.raterId);
        return data;
      })
    );

    res.json(ratings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch ratings" });
  }
});

// ✅ GET ALL SKILL VERIFICATIONS (with user profile info)
router.get("/verifications", verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("skillVerifications").orderBy("verifiedAt", "desc").get();
    const verifs = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = { id: doc.id, ...doc.data() };
        // Resolve userId -> profile
        if (data.userId) {
          try {
            const profileDoc = await db.collection("profiles").doc(data.userId).get();
            if (profileDoc.exists) {
              const p = profileDoc.data();
              data.resolvedUser = {
                fullName: p.fullName || null,
                username: p.username || null,
                avatar: p.avatar || null,
                email: p.email || null,
                primaryRole: p.primaryRole || null,
              };
            }
          } catch (_) {}
        }
        return data;
      })
    );
    res.json(verifs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch verifications" });
  }
});

// 🚨 GET ALL REPORTS (with reporter + reported user names — resolved via Auth + Profiles)
router.get("/reports", verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("userReports").orderBy("createdAt", "desc").get();

    // Resolve a UID → name/username/avatar via Firestore profiles first, then Auth fallback
    const resolveUser = async (uid) => {
      if (!uid) return null;
      // 1. Try Firestore profiles
      try {
        const d = await db.collection("profiles").doc(uid).get();
        if (d.exists) {
          const p = d.data();
          if (p.fullName || p.username) {
            return {
              fullName: p.fullName || null,
              username: p.username || null,
              avatar: p.avatar || null,
              email: p.email || null,
            };
          }
        }
      } catch (_) {}
      // 2. Fall back to Firebase Auth record
      try {
        const authUser = await admin.auth().getUser(uid);
        return {
          fullName: authUser.displayName || null,
          username: null,
          avatar: authUser.photoURL || null,
          email: authUser.email || null,
        };
      } catch (_) {}
      return null;
    };

    const reports = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = { id: doc.id, ...doc.data() };
        const [reporter, reported] = await Promise.all([
          resolveUser(data.reporterId),
          resolveUser(data.reportedId),
        ]);
        data.reporterProfile = reporter;
        data.reportedProfile = reported;
        return data;
      })
    );

    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
});

export default router;