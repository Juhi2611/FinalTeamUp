// =============================================================
// services/feedbackService.ts
// Firestore service for app feedback collection
// =============================================================

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

export interface AppFeedback {
  userId: string;
  rating: number; // 1–5
  comment: string;
  triggerType: string; // team_created | team_joined | skill_verified | interview_completed | session_count | manual
  createdAt: any;
}

/**
 * Write a feedback document to the `appFeedback` collection.
 */
export const submitAppFeedback = async (
  userId: string,
  data: { rating: number; comment: string; triggerType: string }
): Promise<void> => {
  await addDoc(collection(db, 'appFeedback'), {
    userId,
    rating: data.rating,
    comment: data.comment,
    triggerType: data.triggerType,
    createdAt: serverTimestamp(),
  });
};

/**
 * Mark the user's profile so we never prompt again.
 */
export const markFeedbackGiven = async (userId: string): Promise<void> => {
  const ref = doc(db, 'profiles', userId);
  await updateDoc(ref, { feedbackGiven: true });
};

/**
 * Check (from Firestore) whether the user already submitted feedback.
 * Falls back to `false` on any error.
 */
export const hasFeedbackBeenGiven = async (userId: string): Promise<boolean> => {
  try {
    const ref = doc(db, 'profiles', userId);
    const snap = await getDoc(ref);
    return snap.exists() && snap.data()?.feedbackGiven === true;
  } catch {
    return false;
  }
};
