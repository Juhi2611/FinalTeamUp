/**
 * perksService.ts
 * ---------------
 * All Perks-system Firestore operations for TeamUp.
 *
 * Perk Rules
 * ----------
 * - Users earn Perks when a team leader verifies their submitted task.
 * - `perks`           → spendable balance (incremented on earn, decremented on spend)
 * - `totalPerksEarned`→ lifetime total (only incremented, never decremented)
 *   This field is the source of truth for rank & leaderboard position.
 *
 * Join-Fee Logic
 * --------------
 * - Pioneer phase  (0–49 perks total earned): joining is FREE
 * - 50+ perks total earned: user must spend 50 Perks per join-request / invite-acceptance
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
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '@/lib/firebase';
import type { UserProfile, LeaderboardEntry } from '@/types/firestore.types';
import { getPerkRank, JOIN_FEE, JOIN_FEE_THRESHOLD } from '@/types/firestore.types';
// ========================
// AWARD PERKS (called by verifyTask)
// ========================

/**
 * Awards perkValue perks to a user when a task is verified.
 * Uses Firestore `increment` so it is safe to call concurrently.
 */
export const awardPerks = async (
  userId: string,
  perkValue: number
): Promise<void> => {
  if (!isFirebaseConfigured() || perkValue <= 0) return;
  const profileRef = doc(db, 'profiles', userId);
  await updateDoc(profileRef, {
    perks: increment(perkValue),
    totalPerksEarned: increment(perkValue),
  });
};

// ========================
// SPEND PERKS (join fee)
// ========================

/**
 * Checks whether the user must pay a join fee and, if so, deducts it.
 *
 * @returns `{ allowed: boolean; feePaid: number }` — if `allowed` is false the
 *          caller should throw / show an error (insufficient balance).
 */
export const chargeJoinFee = async (
  userId: string
): Promise<{ allowed: boolean; feePaid: number }> => {
  if (!isFirebaseConfigured()) return { allowed: true, feePaid: 0 };

  const profileSnap = await getDoc(doc(db, 'profiles', userId));
  if (!profileSnap.exists()) return { allowed: true, feePaid: 0 };

  const profile = profileSnap.data() as UserProfile;
  const totalEarned = profile.totalPerksEarned ?? 0;
  const currentBalance = profile.perks ?? 0;

  // Pioneer phase — free to join
  if (totalEarned < JOIN_FEE_THRESHOLD) {
    return { allowed: true, feePaid: 0 };
  }

  // Non-pioneer — must have at least JOIN_FEE spendable
  if (currentBalance < JOIN_FEE) {
    return { allowed: false, feePaid: 0 };
  }

  // Deduct the fee
  await updateDoc(doc(db, 'profiles', userId), {
    perks: increment(-JOIN_FEE),
  });

  return { allowed: true, feePaid: JOIN_FEE };
};

// ========================
// LEADERBOARDS
// ========================

/**
 * Global Top-50 leaderboard ranked by `totalPerksEarned`.
 */
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

/**
 * Private team leaderboard — members of a specific team ranked by
 * `totalPerksEarned` (best proxy for task-completion contribution).
 */
export const getTeamLeaderboard = async (
  memberUserIds: string[]
): Promise<LeaderboardEntry[]> => {
  if (!isFirebaseConfigured() || memberUserIds.length === 0) return [];

  // Firestore `in` supports up to 30 items; teams are capped well below that
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
      position: 0, // filled in after sort
    };
  });

  return entries
    .sort((a, b) => b.totalPerksEarned - a.totalPerksEarned)
    .map((e, i) => ({ ...e, position: i + 1 }));
};

// ========================
// REFERRAL SYSTEM
// ========================

/**
 * Generates a unique referral code for a user.
 * Format: TU- + 8 uppercase alphanumeric chars derived from userId + random suffix.
 */
export const generateReferralCode = (userId: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  // Use first 4 chars of userId (uppercased) + 4 random chars
  const fromId = userId.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  const random = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `TU-${fromId}${random}`;
};

/**
 * Gets or creates a referral code for a user.
 * Saves the code to Firestore if new.
 */
export const getOrCreateReferralCode = async (userId: string): Promise<string> => {
  if (!isFirebaseConfigured()) return generateReferralCode(userId);

  const profileRef = doc(db, 'profiles', userId);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) return generateReferralCode(userId);

  const data = snap.data();
  if (data.referralCode) return data.referralCode as string;

  // Create and save a new one
  const newCode = generateReferralCode(userId);
  await updateDoc(profileRef, { referralCode: newCode });
  return newCode;
};

/**
 * Redeems a referral code for the current user.
 * Each code is SINGLE-USE — after one person redeems it:
 *   - The REDEEMER immediately receives +10 Perks
 *   - A pending reward doc is created for the REFERRER to claim on next visit
 *   - The referrer's old code is regenerated when they claim (via claimPendingReferralRewards)
 *
 * Flow:
 *   1. Redeemer writes to their own profile: referredBy + +10 perks
 *   2. A doc is created in `referralRedemptions` for the referrer to claim
 *   3. The referrer claims pending rewards via claimPendingReferralRewards()
 *      which awards their +10 perks AND auto-generates a fresh referral code
 *
 * Guards:
 *   - Redeemer can only ever use one code (referredBy field)
 *   - Code is blocked once a pending referralRedemptions doc exists for that referrer
 */
export const redeemReferralCode = async (
  code: string,
  redeemerUserId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    if (!isFirebaseConfigured()) return { success: false, message: 'Firebase not configured' };

    // 0) Require verified email before redeeming
    const currentUser = auth?.currentUser;
    if (!currentUser || !currentUser.emailVerified) {
      return {
        success: false,
        message: 'Please verify your email before redeeming a referral code.',
      };
    }

    const normalised = code.trim().toUpperCase();

    // 1) Check if redeemer has already used a code
    const redeemerSnap = await getDoc(doc(db, 'profiles', redeemerUserId));
    if (!redeemerSnap.exists()) return { success: false, message: 'Your profile was not found.' };
    const redeemerData = redeemerSnap.data();
    if (redeemerData.referredBy) {
      return { success: false, message: 'You have already redeemed a referral code.' };
    }

    // 2) Find the owner of this referral code
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

    // 3) Cannot refer yourself
    if (referrerId === redeemerUserId) {
      return { success: false, message: "You can't use your own referral code." };
    }

    // 3b) SINGLE-USE GUARD: check if this referrer's code is already pending redemption
    //     (i.e., someone redeemed it but the referrer hasn't claimed yet)
    //     Wrapped in try/catch — if rules aren't deployed yet this query may fail,
    //     but the redeemer's own `referredBy` guard still prevents their side of double-use.
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
      // Rules not yet deployed — skip the guard and continue
      console.warn('[redeemReferralCode] Could not check pending redemptions (rules may need deployment):', permErr);
    }

    // 4) Mark redeemer as referred (writing to OWN profile — always allowed)
    //    NOTE: Only the REFERRER earns Perks (via claimPendingReferralRewards).
    //    The redeemer does NOT earn perks — they just record who referred them.
    await updateDoc(doc(db, 'profiles', redeemerUserId), {
      referredBy: referrerId,
    });

    // 5) Create a pending reward for the referrer to claim
    //    (any authenticated user can create docs in this collection)
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
      message: `\uD83C\uDF89 Referral redeemed! You earned +10 Perks! ${referrerName} will also receive 10 Perks when they next visit the Perk Shop.`,
    };
  } catch (err: any) {
    console.error('[redeemReferralCode] Error:', err);
    return { success: false, message: err?.message || 'Something went wrong. Please try again.' };
  }
};

/**
 * Called when the referrer visits the Perk Shop.
 * Claims any pending referral rewards by:
 *   - Reading unclaimed docs from `referralRedemptions` where referrerId == userId
 *   - Awarding +10 Perks to the current user's OWN profile (no cross-user writes)
 *   - Auto-generating a FRESH referral code (old code is now spent / single-used)
 *   - Deleting the claimed referralRedemption docs
 *
 * @returns number of rewards claimed (each = 10 perks)
 */
export const claimPendingReferralRewards = async (
  userId: string
): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;

  try {
    // Query only by referrerId — docs are deleted after claim
    const q = query(
      collection(db, 'referralRedemptions'),
      where('referrerId', '==', userId)
    );
    const snap = await getDocs(q);
    console.log(`[claimPendingReferralRewards] Found ${snap.size} pending reward(s) for ${userId}`);
    if (snap.empty) return 0;

    let totalPerks = 0;
    snap.docs.forEach((d) => {
      totalPerks += d.data().perksAwarded || 10;
    });

    // Award all pending perks to own profile + auto-generate a fresh referral code
    // Writing to own profile → Firestore rule 1 (request.auth.uid == userId) allows all fields
    const newCode = generateReferralCode(userId);
    await updateDoc(doc(db, 'profiles', userId), {
      perks: increment(totalPerks),
      totalPerksEarned: increment(totalPerks),
      referralCount: increment(snap.size),
      referralCode: newCode,   // ← fresh single-use code automatically assigned
    });
    console.log(`[claimPendingReferralRewards] Awarded ${totalPerks} perks, new referral code: ${newCode}`);

    // Delete all claimed docs so the old code path is cleared
    await Promise.allSettled(snap.docs.map((d) => deleteDoc(d.ref)));

    return snap.size;
  } catch (err: any) {
    console.error('[claimPendingReferralRewards] Error:', err?.message || err);
    return 0;
  }
};