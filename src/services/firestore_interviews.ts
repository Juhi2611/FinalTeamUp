// =============================================================
// services/firestore_interviews.ts
// Interview System - Firestore service layer
// Extends existing firestore.ts WITHOUT modifying it
// =============================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type InterviewType = 'video' | 'quiz';
export type InterviewStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'terminated';

export interface InterviewRequest {
  id: string;
  teamId: string;
  teamName: string;
  leaderId: string;
  leaderName: string;
  candidateId: string;
  candidateName: string;
  type: InterviewType;
  scheduledAt: Timestamp;
  status: InterviewStatus;
  createdAt: Timestamp;
  // Quiz config (only for quiz type)
  quizConfig?: {
    topics: string[];
    difficulty: 'easy' | 'medium' | 'hard';
    numQuestions: number;
    timeLimitMinutes: number;
  };
}

export interface QuizQuestion {
  id: string;
  interviewId: string;
  question: string;
  options: string[];
  correct_answer: string; // stored encrypted or only visible server-side
  order: number;
}

export interface QuizAnswer {
  id: string;
  interviewId: string;
  candidateId: string;
  questionId: string;
  selectedOption: string;
  submittedAt: Timestamp;
}

export interface InterviewReport {
  status: string;
  id: string;
  interviewId: string;
  teamId: string;
  leaderId: string;
  candidateId: string;
  candidateName: string;
  type: InterviewType;
  completedAt: Timestamp;
  // Video interview
  recordingUrl?: string;
  recordingPath?: string; // Supabase storage path
  // Quiz interview
  score?: number;
  totalQuestions?: number;
  correctAnswers?: number;
  // Proctoring
  warnings: ProctoringWarning[];
  terminated: boolean;
  terminationReason?: string;
}

export interface ProctoringWarning {
  type: 'tab_switch' | 'fullscreen_exit' | 'camera_off' | 'no_face' | 'multiple_faces';
  timestamp: Timestamp;
  message: string;
}

// ─────────────────────────────────────────────
// INTERVIEW REQUESTS
// ─────────────────────────────────────────────

export const createInterviewRequest = async (
  data: Omit<InterviewRequest, 'id' | 'createdAt' | 'status'>
): Promise<string> => {
  const ref = await addDoc(collection(db, 'interview_requests'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const respondToInterviewRequest = async (
  requestId: string,
  response: 'accepted' | 'rejected'
): Promise<void> => {
  await updateDoc(doc(db, 'interview_requests', requestId), {
    status: response,
  });
};

export const getInterviewRequest = async (
  requestId: string
): Promise<InterviewRequest | null> => {
  const snap = await getDoc(doc(db, 'interview_requests', requestId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as InterviewRequest;
};

// Subscribe to requests sent TO the candidate (inbox)
export const subscribeToMyInterviewRequests = (
  candidateId: string,
  callback: (requests: InterviewRequest[]) => void
) => {
  const q = query(
    collection(db, 'interview_requests'),
    where('candidateId', '==', candidateId)
  );
  return onSnapshot(q, (snap) => {
    const results = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as InterviewRequest))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    callback(results);
  });
};

// Subscribe to requests sent BY the leader (outbox/scheduled)
export const subscribeToLeaderInterviews = (
  leaderId: string,
  callback: (requests: InterviewRequest[]) => void
) => {
  const q = query(
    collection(db, 'interview_requests'),
    where('leaderId', '==', leaderId)
  );
  return onSnapshot(q, (snap) => {
    const results = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as InterviewRequest))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    callback(results);
  });
};

export const updateInterviewStatus = async (
  interviewId: string,
  status: InterviewStatus
): Promise<void> => {
  await updateDoc(doc(db, 'interview_requests', interviewId), { status });
};

// ─────────────────────────────────────────────
// QUIZ QUESTIONS
// ─────────────────────────────────────────────

export const storeQuizQuestions = async (
  interviewId: string,
  questions: Omit<QuizQuestion, 'id' | 'interviewId'>[]
): Promise<void> => {
  const promises = questions.map((q, i) =>
    addDoc(collection(db, 'quiz_questions'), {
      ...q,
      interviewId,
      order: i,
    })
  );
  await Promise.all(promises);
};

export const getQuizQuestions = async (
  interviewId: string
): Promise<QuizQuestion[]> => {
  const q = query(
    collection(db, 'quiz_questions'),
    where('interviewId', '==', interviewId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as QuizQuestion))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

// ─────────────────────────────────────────────
// QUIZ ANSWERS
// ─────────────────────────────────────────────

export const submitQuizAnswer = async (
  data: Omit<QuizAnswer, 'id' | 'submittedAt'>
): Promise<void> => {
  await addDoc(collection(db, 'quiz_answers'), {
    ...data,
    submittedAt: serverTimestamp(),
  });
};

export const getQuizAnswers = async (
  interviewId: string,
  candidateId: string
): Promise<QuizAnswer[]> => {
  const q = query(
    collection(db, 'quiz_answers'),
    where('interviewId', '==', interviewId),
    where('candidateId', '==', candidateId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuizAnswer));
};

// ─────────────────────────────────────────────
// INTERVIEW REPORTS
// ─────────────────────────────────────────────

export const createInterviewReport = async (
  data: Omit<InterviewReport, 'id'>
): Promise<string> => {
  // Strip undefined fields — Firestore rejects them
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(collection(db, 'interview_reports'), clean);
  return ref.id;
};

export const updateInterviewReport = async (
  reportId: string,
  data: Partial<InterviewReport>
): Promise<void> => {
  await updateDoc(doc(db, 'interview_reports', reportId), data);
};

export const getInterviewReport = async (
  interviewId: string
): Promise<InterviewReport | null> => {
  const q = query(
    collection(db, 'interview_reports'),
    where('interviewId', '==', interviewId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as InterviewReport;
};

export const getLeaderReports = async (
  leaderId: string
): Promise<InterviewReport[]> => {
  const q = query(
    collection(db, 'interview_reports'),
    where('leaderId', '==', leaderId),
    orderBy('completedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InterviewReport));
};

export const getCandidateReports = async (
  candidateId: string
): Promise<InterviewReport[]> => {
  const q = query(
    collection(db, 'interview_reports'),
    where('candidateId', '==', candidateId),
    orderBy('completedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InterviewReport));
};