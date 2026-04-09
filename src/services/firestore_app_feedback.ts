// services/firestore_app_feedback.ts
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface FeedbackData {
  teamId: string;
  rating: number;
  message: string;
}

export const submitAppFeedback = async ({ teamId, rating, message }: FeedbackData) => {
  const feedbackRef = doc(db, 'app_feedback', teamId);

  await setDoc(feedbackRef, {
    rating,
    message,
    createdAt: new Date().toISOString()
  });
};