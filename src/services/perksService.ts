/**
 * perksService.ts
 * ---------------
 * All Perks-system Firestore operations for TeamUp.
 *
 * Perk Rules
 * ----------
 * - Every new user gets 50 perks on signup (INITIAL_PERKS).
 * - `perks`           → spendable balance (incremented on earn, decremented on spend).
 * - `totalPerksEarned`→ lifetime total (only incremented, never decremented).
 *   This field is the source of truth for rank & leaderboard position.
 *
 * Costs
 * -----
 * - Join a team     : 10 perks  (TEAM_JOIN_COST)
 * - Create a team   : 25 perks  (TEAM_CREATE_COST)
 * - Start interview : 5  perks  (INTERVIEW_COST) — once per leader+candidate pair
 *
 * Penalties
 * ---------
 * - Miss a task deadline: −30% of task perk value (DEADLINE_PENALTY_RATE)
 *
 * Safeguard: perk balance NEVER goes below 0.
 */

import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  increment,
  addDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '@/lib/firebase';
import type { UserProfile, LeaderboardEntry, PerkTransaction, PerkTransactionType } from '@/types/firestore.types';
import {
  getPerkRank,
  INITIAL_PERKS,
  TEAM_JOIN_COST,
  TEAM_CREATE_COST,
  INTERVIEW_COST,
  DEADLINE_PENALTY_RATE,
} from '@/types/firestore.types';

// ========================
// INTERNAL HELPERS
// ========================

/**
 * Reads the current perk balance for a user.
 * Returns 0 if the profile doesn't exist.
 */
const getCurrentBalance = async (userId: string): Promise<number> => {
  const snap = await getDoc(doc(db, 'profiles', userId));
  if (!snap.exists()) return 0;
  return (snap.data().perks as number) ?? 0;
};

/**
 * Writes a perk transaction log entry to Firestore.
 * Fires and forgets — does NOT throw if it fails (non-critical).
 */
export const logPerkTransaction = async (
  userId: string,
  amount: number,
  type: PerkTransactionType,
  description: string,
  balanceAfter: number,
  relatedId?: string
): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  try {
    const entry: Omit<PerkTransaction, 'id'> = {
      userId,
      amount,
      type,
      description,
      balanceAfter,
      createdAt: serverTimestamp() as any,
      ...(relatedId ? { relatedId } : {}),
    };
    await addDoc(collection(db, 'perkTransactions'), entry);
  } catch (err) {
    console.warn('[logPerkTransaction] Failed to log:', err);
  }
};

// ========================
// INITIAL PERKS (SIGNUP)
// ========================

/**
 * Grants INITIAL_PERKS (50) to a user on account creation.
 * Idempotent — will not double-grant if called more than once
 * (checks the `initialPerksGranted` flag on the profile).
 */
export const grantInitialPerks = async (userId: string): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  try {
    const profileRef = doc(db, 'profiles', userId);
    const snap = await getDoc(profileRef);
    if (!snap.exists()) return;

    const data = snap.data();
    // Idempotency guard
    if (data.initialPerksGranted) return;

    const newBalance = (data.perks ?? 0) + INITIAL_PERKS;
    const newTotalEarned = (data.totalPerksEarned ?? 0) + INITIAL_PERKS;

    await updateDoc(profileRef, {
      perks: newBalance,
      totalPerksEarned: newTotalEarned,
      initialPerksGranted: true,
    });

    await logPerkTransaction(
      userId,
      INITIAL_PERKS,
      'signup_bonus',
      '🎉 Welcome to TeamUp! Here are your starter perks.',
      newBalance
    );
  } catch (err) {
    console.error('[grantInitialPerks] Error:', err);
  }
};

// ========================
// AWARD PERKS (task reward)
// ========================

/**
 * Awards perkValue perks to a user when a task is verified.
 * Also logs a transaction entry.
 */
export const awardPerks = async (
  userId: string,
  perkValue: number,
  taskId?: string,
  taskTitle?: string
): Promise<void> => {
  if (!isFirebaseConfigured() || perkValue <= 0) return;

  const profileRef = doc(db, 'profiles', userId);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) return;

  const currentBalance = (snap.data().perks ?? 0) as number;
  const newBalance = currentBalance + perkValue;

  await updateDoc(profileRef, {
    perks: increment(perkValue),
    totalPerksEarned: increment(perkValue),
  });

  await logPerkTransaction(
    userId,
    perkValue,
    'task_reward',
    `✅ Task "${taskTitle || 'Task'}" verified — perks awarded!`,
    newBalance,
    taskId
  );
};

// ========================
// TEAM JOIN FEE (10 perks)
// ========================

/**
 * Deducts TEAM_JOIN_COST (10) perks from the user when joining a team.
 * Flat cost — no pioneer threshold.
 *
 * @returns `{ allowed: boolean; feePaid: number }`
 */
export const chargeJoinFee = async (
  userId: string,
  teamId?: string,
  teamName?: string
): Promise<{ allowed: boolean; feePaid: number }> => {
  if (!isFirebaseConfigured()) return { allowed: true, feePaid: 0 };

  const profileRef = doc(db, 'profiles', userId);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) return { allowed: true, feePaid: 0 };

  const currentBalance = (snap.data().perks ?? 0) as number;

  if (currentBalance < TEAM_JOIN_COST) {
    return { allowed: false, feePaid: 0 };
  }

  const newBalance = Math.max(0, currentBalance - TEAM_JOIN_COST);
  await updateDoc(profileRef, { perks: newBalance });

  await logPerkTransaction(
    userId,
    -TEAM_JOIN_COST,
    'team_join',
    `🤝 Joined team${teamName ? ` "${teamName}"` : ''} — join fee deducted.`,
    newBalance,
    teamId
  );

  return { allowed: true, feePaid: TEAM_JOIN_COST };
};

// ========================
// TEAM CREATE FEE (25 perks)
// ========================

/**
 * Deducts TEAM_CREATE_COST (25) perks when a user creates a team.
 *
 * @returns `{ allowed: boolean; feePaid: number }`
 */
export const chargeTeamCreateFee = async (
  userId: string,
  teamId?: string,
  teamName?: string
): Promise<{ allowed: boolean; feePaid: number }> => {
  if (!isFirebaseConfigured()) return { allowed: true, feePaid: 0 };

  const profileRef = doc(db, 'profiles', userId);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) return { allowed: true, feePaid: 0 };

  const currentBalance = (snap.data().perks ?? 0) as number;

  if (currentBalance < TEAM_CREATE_COST) {
    return { allowed: false, feePaid: 0 };
  }

  const newBalance = Math.max(0, currentBalance - TEAM_CREATE_COST);
  await updateDoc(profileRef, { perks: newBalance });

  await logPerkTransaction(
    userId,
    -TEAM_CREATE_COST,
    'team_create',
    `🚀 Created team${teamName ? ` "${teamName}"` : ''} — creation fee deducted.`,
    newBalance,
    teamId
  );

  return { allowed: true, feePaid: TEAM_CREATE_COST };
};

// ========================
// INTERVIEW FEE (5 perks, idempotent)
// ========================

/**
 * Deducts INTERVIEW_COST (5) perks from the leader when an interview starts.
 *
 * Idempotent: uses `interviewPerkCharges/{leaderId}_{candidateId}` as a
 * "charged" marker so reconnects / restarts do NOT trigger additional deductions.
 * The same leader interviewing the same candidate counts as one session.
 *
 * @returns `{ charged: boolean; alreadyCharged: boolean }`
 */
export const chargeInterviewFee = async (
  leaderId: string,
  candidateId: string,
  interviewId: string
): Promise<{ charged: boolean; alreadyCharged: boolean }> => {
  if (!isFirebaseConfigured()) return { charged: false, alreadyCharged: false };

  // Idempotency key — one per leader+candidate pair
  const chargeKey = `${leaderId}_${candidateId}`;
  const chargeRef = doc(db, 'interviewPerkCharges', chargeKey);
  const chargeSnap = await getDoc(chargeRef);

  if (chargeSnap.exists()) {
    // Already charged for this leader+candidate pair
    return { charged: false, alreadyCharged: true };
  }

  const profileRef = doc(db, 'profiles', leaderId);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) return { charged: false, alreadyCharged: false };

  const currentBalance = (snap.data().perks ?? 0) as number;
  const deduction = Math.min(INTERVIEW_COST, currentBalance); // floor at 0
  const newBalance = currentBalance - deduction;

  // Write charge marker FIRST (prevents race conditions on reconnect)
  await setDoc(chargeRef, {
    leaderId,
    candidateId,
    interviewId,
    chargedAt: serverTimestamp(),
    amount: deduction,
  });

  if (deduction > 0) {
    await updateDoc(profileRef, { perks: newBalance });
    await logPerkTransaction(
      leaderId,
      -deduction,
      'interview',
      `🎤 Interview started with candidate. Interview fee deducted.`,
      newBalance,
      interviewId
    );
  }

  return { charged: true, alreadyCharged: false };
};

// ========================
// DEADLINE PENALTY (30%)
// ========================

/**
 * Applies a 30% deadline penalty when a task is verified after its deadline.
 * Deducts Math.floor(perkValue * DEADLINE_PENALTY_RATE) from the user's balance.
 * Perk balance is floored at 0.
 * Idempotent: checks `task.deadlinePenaltyApplied` before deducting.
 *
 * NOTE: The task perk reward is NOT awarded when a deadline is missed.
 * Instead, this penalty is deducted from the existing balance.
 */
export const applyDeadlinePenalty = async (
  userId: string,
  taskId: string,
  perkValue: number,
  taskTitle?: string
): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;

  const penalty = Math.floor(perkValue * DEADLINE_PENALTY_RATE);
  if (penalty <= 0) return 0;

  const profileRef = doc(db, 'profiles', userId);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) return 0;

  const currentBalance = (snap.data().perks ?? 0) as number;
  const actualDeduction = Math.min(penalty, currentBalance); // never go below 0
  const newBalance = currentBalance - actualDeduction;

  await updateDoc(profileRef, { perks: newBalance });

  // Mark the task so penalty isn't applied twice
  await updateDoc(doc(db, 'teamTasks', taskId), {
    deadlinePenaltyApplied: true,
  });

  await logPerkTransaction(
    userId,
    -actualDeduction,
    'deadline_penalty',
    `⏰ Deadline missed on "${taskTitle || 'Task'}" — 30% penalty applied.`,
    newBalance,
    taskId
  );

  return actualDeduction;
};

// ========================
// PERK TRANSACTION HISTORY
// ========================

/**
 * Fetches the perk transaction log for a user (most recent first).
 */
export const getUserPerkTransactions = async (
  userId: string,
  limitN = 30
): Promise<PerkTransaction[]> => {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(db, 'perkTransactions'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PerkTransaction));
};

/**
 * Real-time listener for a user's perk transaction log.
 */
export const subscribeToUserPerkTransactions = (
  userId: string,
  callback: (txs: PerkTransaction[]) => void,
  limitN = 20
): Unsubscribe => {
  if (!isFirebaseConfigured()) return () => {};
  const q = query(
    collection(db, 'perkTransactions'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitN)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as PerkTransaction)));
  });
};

// ========================
// LEADERBOARDS
// ========================

/** Global Top-50 leaderboard ranked by `totalPerksEarned`. */
export const getGlobalLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  if (!isFirebaseConfigured()) return [];

  const q = query(
    collection(db, 'profiles'),
    orderBy('totalPerksEarned', 'desc'),
    limit(50)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d, index) => {
    const data = d.data() as UserProfile;
    const totalPerksEarned = data.totalPerksEarned ?? 0;
    return {
      userId: d.id,
      fullName: data.fullName,
      avatar: data.avatar,
      primaryRole: data.primaryRole,
      totalPerksEarned,
      perks: data.perks ?? 0,
      rank: getPerkRank(totalPerksEarned),
      position: index + 1,
    } satisfies LeaderboardEntry;
  });
};

/** Private team leaderboard — members ranked by `totalPerksEarned`. */
export const getTeamLeaderboard = async (
  memberUserIds: string[]
): Promise<LeaderboardEntry[]> => {
  if (!isFirebaseConfigured() || memberUserIds.length === 0) return [];

  const q = query(
    collection(db, 'profiles'),
    where('__name__', 'in', memberUserIds)
  );

  const snapshot = await getDocs(q);
  const entries: LeaderboardEntry[] = snapshot.docs.map((d) => {
    const data = d.data() as UserProfile;
    const totalPerksEarned = data.totalPerksEarned ?? 0;
    return {
      userId: d.id,
      fullName: data.fullName,
      avatar: data.avatar,
      primaryRole: data.primaryRole,
      totalPerksEarned,
      perks: data.perks ?? 0,
      rank: getPerkRank(totalPerksEarned),
      position: 0,
    };
  });

  return entries
    .sort((a, b) => b.totalPerksEarned - a.totalPerksEarned)
    .map((e, i) => ({ ...e, position: i + 1 }));
};

// ========================
// REFERRAL SYSTEM
// ========================

export const generateReferralCode = (userId: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const fromId = userId.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  const random = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `TU-${fromId}${random}`;
};

export const getOrCreateReferralCode = async (userId: string): Promise<string> => {
  if (!isFirebaseConfigured()) return generateReferralCode(userId);

  const profileRef = doc(db, 'profiles', userId);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) return generateReferralCode(userId);

  const data = snap.data();
  if (data.referralCode) return data.referralCode as string;

  const newCode = generateReferralCode(userId);
  await updateDoc(profileRef, { referralCode: newCode });
  return newCode;
};

export const redeemReferralCode = async (
  code: string,
  redeemerUserId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    if (!isFirebaseConfigured()) return { success: false, message: 'Firebase not configured' };

    const currentUser = auth?.currentUser;
    if (!currentUser || !currentUser.emailVerified) {
      return {
        success: false,
        message: 'Please verify your email before redeeming a referral code.',
      };
    }

    const normalised = code.trim().toUpperCase();

    const redeemerSnap = await getDoc(doc(db, 'profiles', redeemerUserId));
    if (!redeemerSnap.exists()) return { success: false, message: 'Your profile was not found.' };
    const redeemerData = redeemerSnap.data();
    if (redeemerData.referredBy) {
      return { success: false, message: 'You have already redeemed a referral code.' };
    }

    const q = query(
      collection(db, 'profiles'),
      where('referralCode', '==', normalised),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return { success: false, message: 'Invalid or already-used referral code. Please check and try again.' };
    }

    const referrerDoc = snap.docs[0];
    const referrerId = referrerDoc.id;

    if (referrerId === redeemerUserId) {
      return { success: false, message: "You can't use your own referral code." };
    }

    try {
      const pendingQ = query(
        collection(db, 'referralRedemptions'),
        where('referrerId', '==', referrerId),
        limit(1)
      );
      const pendingSnap = await getDocs(pendingQ);
      if (!pendingSnap.empty) {
        return {
          success: false,
          message: 'This referral code has already been used. Ask your friend for their new code after they visit the Perk Shop.',
        };
      }
    } catch (permErr) {
      console.warn('[redeemReferralCode] Could not check pending redemptions:', permErr);
    }

    await updateDoc(doc(db, 'profiles', redeemerUserId), {
      referredBy: referrerId,
    });

    await addDoc(collection(db, 'referralRedemptions'), {
      referrerId,
      redeemerId: redeemerUserId,
      redeemerName: redeemerData.fullName || 'A teammate',
      perksAwarded: 10,
      claimed: false,
      createdAt: serverTimestamp(),
    });

    const referrerName = referrerDoc.data().fullName || 'your friend';
    return {
      success: true,
      message: `🎉 Referral redeemed! ${referrerName} will also receive 10 Perks when they next visit the Perk Shop.`,
    };
  } catch (err: any) {
    console.error('[redeemReferralCode] Error:', err);
    return { success: false, message: err?.message || 'Something went wrong. Please try again.' };
  }
};

export const claimPendingReferralRewards = async (userId: string): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;

  try {
    const q = query(
      collection(db, 'referralRedemptions'),
      where('referrerId', '==', userId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    let totalPerks = 0;
    snap.docs.forEach((d) => {
      totalPerks += d.data().perksAwarded || 10;
    });

    const profileRef = doc(db, 'profiles', userId);
    const profileSnap = await getDoc(profileRef);
    const currentBalance = (profileSnap.data()?.perks ?? 0) as number;
    const newBalance = currentBalance + totalPerks;

    const newCode = generateReferralCode(userId);
    await updateDoc(profileRef, {
      perks: increment(totalPerks),
      totalPerksEarned: increment(totalPerks),
      referralCount: increment(snap.size),
      referralCode: newCode,
    });

    await logPerkTransaction(
      userId,
      totalPerks,
      'referral',
      `🎁 Referral reward — ${snap.size} friend(s) joined using your code!`,
      newBalance
    );

    await Promise.allSettled(snap.docs.map((d) => deleteDoc(d.ref)));

    return snap.size;
  } catch (err: any) {
    console.error('[claimPendingReferralRewards] Error:', err?.message || err);
    return 0;
  }
};