import cron from "node-cron";
import axios from "axios";
import admin, { db } from "./config/firebase.js";

/**
 * TeamUp Task Reminder Engine
 * Runs every hour to check for tasks due today.
 * Sends email reminders via EmailJS.
 */

const EMAILJS_URL = "https://api.emailjs.com/api/v1.0/email/send";

const runReminderCheck = async () => {
  console.log("[ReminderEngine] Running scheduled check...");
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Fetch all tasks with status !== 'verified' and deadline within the current day
    const tasksSnapshot = await db.collection("teamTasks")
      .where("status", "!=", "verified")
      .where("deadline", ">=", admin.firestore.Timestamp.fromDate(today))
      .where("deadline", "<", admin.firestore.Timestamp.fromDate(tomorrow))
      .get();

    if (tasksSnapshot.empty) {
      console.log("[ReminderEngine] No tasks due today.");
      return;
    }

    console.log(`[ReminderEngine] Found ${tasksSnapshot.size} potential tasks due today.`);

    const results = await Promise.allSettled(
      tasksSnapshot.docs.map(async (taskDoc) => {
        const task = taskDoc.data();
        
        // Skip if reminder already sent
        if (task.reminderEmailSent) return;

        const assignedUserIds = task.assignedTo || [];
        if (assignedUserIds.length === 0) return;

        // For each assigned user, fetch their profile and send email
        const userEmails = await Promise.all(
          assignedUserIds.map(async (uid) => {
            const p = await db.collection("profiles").doc(uid).get();
            if (p.exists) {
              const data = p.data();
              return { email: data.email, name: data.fullName || data.username || "Member" };
            }
            return null;
          })
        );

        for (const user of userEmails) {
          if (user?.email) {
            await sendReminderEmail(user.email, user.name, task.title, task.deadline.toDate().toLocaleDateString());
          }
        }

        // Mark task as reminded
        await taskDoc.ref.update({ reminderEmailSent: true });
      })
    );

    console.log("[ReminderEngine] Check complete.");
  } catch (err) {
    console.error("[ReminderEngine] Error during check:", err);
  }
};

const sendReminderEmail = async (to, name, taskTitle, deadlineStr) => {
  try {
    const payload = {
      service_id:  process.env.VITE_EMAILJS_SERVICE_ID  || "service_ga46jnw",
      template_id: process.env.VITE_EMAILJS_TEMPLATE_ID || "template_z8234ix",
      user_id:     process.env.VITE_EMAILJS_PUBLIC_KEY  || "NTQ_HSkYjufQlVakK",
      template_params: {
        to_email: to,
        subject:  `⏰ Reminder: Task "${taskTitle}" is due today`,
        message: `Hi ${name}, just a friendly reminder that your task "${taskTitle}" is due today (${deadlineStr}). Missing the deadline results in a 30% Perk penalty! Submit your proof in the app now.`
      },
    };

    const res = await axios.post(EMAILJS_URL, payload);
    return res.status === 200;
  } catch (err) {
    console.error(`[ReminderEngine] Failed to send email to ${to}:`, err.message);
    return false;
  }
};

const runAutoPenaltyCheck = async () => {
  console.log("[ReminderEngine] Running automated penalty check...");
  try {
    const now = admin.firestore.Timestamp.now();

    // 1. Fetch tasks that are overdue and haven't been penalized yet
    // Condition: deadline < now AND deadlinePenaltyApplied != true AND status != 'verified'
    const overdueSnapshot = await db.collection("teamTasks")
      .where("deadline", "<", now)
      .where("deadlinePenaltyApplied", "==", false)
      .get();

    if (overdueSnapshot.empty) {
      console.log("[ReminderEngine] No overdue tasks needing penalty.");
      return;
    }

    console.log(`[ReminderEngine] Found ${overdueSnapshot.size} potentially overdue tasks.`);

    for (const taskDoc of overdueSnapshot.docs) {
      const task = taskDoc.data();
      const taskId = taskDoc.id;

      // Skip if verified (status check in query was != 'verified', but double check)
      if (task.status === "verified") continue;

      // EXEMPTION logic: If submitted logic exists, check submittedAt
      const submittedAt = task.submittedAt;
      const deadline = task.deadline;
      
      // If submitted ON TIME, skip penalty (penalty only applies if not done by deadline)
      if (submittedAt && submittedAt.toMillis() <= deadline.toMillis()) {
        console.log(`[ReminderEngine] Task "${task.title}" (${taskId}) was submitted on time. Skipping penalty.`);
        // Still mark it as "applied" so we don't check it again until leader verifies/rejects
        await taskDoc.ref.update({ deadlinePenaltyApplied: true });
        continue;
      }

      const perkValue = task.perkValue || 10;
      const assignedTo = task.assignedTo || [];
      const penaltyAmount = Math.floor(perkValue * 0.3); // 30% penalty

      if (penaltyAmount <= 0 || assignedTo.length === 0) {
        await taskDoc.ref.update({ deadlinePenaltyApplied: true });
        continue;
      }

      console.log(`[ReminderEngine] Penalizing task "${task.title}" — deducting ${penaltyAmount} perks from ${assignedTo.length} users.`);

      for (const userId of assignedTo) {
        try {
          await db.runTransaction(async (transaction) => {
            const profileRef = db.collection("profiles").doc(userId);
            const profileSnap = await transaction.get(profileRef);

            if (!profileSnap.exists) return;

            const currentPerks = profileSnap.data().perks || 0;
            const actualDeduction = Math.min(penaltyAmount, currentPerks);
            const newBalance = currentPerks - actualDeduction;

            // Update profile
            transaction.update(profileRef, { perks: newBalance });

            // Log Transaction
            const transRef = db.collection("perkTransactions").doc();
            transaction.set(transRef, {
              userId,
              amount: -actualDeduction,
              type: "deadline_penalty",
              description: `⏰ Auto-penalty: Deadline missed on "${task.title}" — 30% deducted.`,
              balanceAfter: newBalance,
              relatedId: taskId,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          });
        } catch (penErr) {
          console.error(`[ReminderEngine] Failed to apply penalty to user ${userId} for task ${taskId}:`, penErr);
        }
      }

      // Mark task as penalty handled
      await taskDoc.ref.update({ deadlinePenaltyApplied: true });
    }

    console.log("[ReminderEngine] Auto-penalty check complete.");
  } catch (err) {
    console.error("[ReminderEngine] Error during penalty check:", err);
  }
};

// Schedule: Every hour at minute 0
export const initReminderEngine = () => {
  console.log("[ReminderEngine] Online. Scheduling hourly checks.");
  
  // Every hour: Reminders at min 0, Penalties at min 5
  cron.schedule("0 * * * *", runReminderCheck);
  cron.schedule("5 * * * *", runAutoPenaltyCheck);
  
  // Run both immediately on startup
  runReminderCheck();
  runAutoPenaltyCheck();
};
