import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc,
  deleteDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';

export interface UserBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: any;
}

export interface UserReport {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'actioned';
  createdAt: any;
}

export interface UserRestriction {
  id: string;
  userId: string;
  type: 'warning' | 'limited' | 'suspended';
  reason: string;
  reportCount: number;
  createdAt: any;
  expiresAt?: any;
}

// ========================
// BLOCK FUNCTIONS
// ========================

export const blockUser = async (blockerId: string, blockedId: string): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  
  const existingQuery = query(
    collection(db, 'userBlocks'),
    where('blockerId', '==', blockerId),
    where('blockedId', '==', blockedId)
  );
  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) {
    throw new Error('User is already blocked');
  }
  
  await addDoc(collection(db, 'userBlocks'), {
    blockerId,
    blockedId,
    createdAt: serverTimestamp()
  });
};

export const unblockUser = async (blockerId: string, blockedId: string): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  
  const q = query(
    collection(db, 'userBlocks'),
    where('blockerId', '==', blockerId),
    where('blockedId', '==', blockedId)
  );
  const snapshot = await getDocs(q);
  
  for (const docSnap of snapshot.docs) {
    await deleteDoc(docSnap.ref);
  }
};

export const getBlockedUsers = async (userId: string): Promise<string[]> => {
  if (!isFirebaseConfigured()) return [];
  
  const q = query(collection(db, 'userBlocks'), where('blockerId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data().blockedId);
};

export const getBlockedByUsers = async (userId: string): Promise<string[]> => {
  if (!isFirebaseConfigured()) return [];
  
  const q = query(collection(db, 'userBlocks'), where('blockedId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data().blockerId);
};

export const getHiddenUsers = async (userId: string): Promise<Set<string>> => {
  if (!isFirebaseConfigured()) return new Set();
  
  const [blocked, blockedBy] = await Promise.all([
    getBlockedUsers(userId),
    getBlockedByUsers(userId)
  ]);
  
  return new Set([...blocked, ...blockedBy]);
};

export const subscribeToHiddenUsers = (
  userId: string,
  onUpdate: (hiddenIds: Set<string>) => void
): Unsubscribe => {
  if (!isFirebaseConfigured()) return () => {};
  
  const blockedQuery = query(collection(db, 'userBlocks'), where('blockerId', '==', userId));
  const blockedByQuery = query(collection(db, 'userBlocks'), where('blockedId', '==', userId));
  
  let blocked: string[] = [];
  let blockedBy: string[] = [];
  
  const update = () => onUpdate(new Set([...blocked, ...blockedBy]));
  
  const unsub1 = onSnapshot(blockedQuery, (snapshot) => {
    blocked = snapshot.docs.map(d => d.data().blockedId);
    update();
  });
  
  const unsub2 = onSnapshot(blockedByQuery, (snapshot) => {
    blockedBy = snapshot.docs.map(d => d.data().blockerId);
    update();
  });
  
  return () => { unsub1(); unsub2(); };
};

export const isBlocked = async (userId1: string, userId2: string): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  
  const q1 = query(collection(db, 'userBlocks'), where('blockerId', '==', userId1), where('blockedId', '==', userId2));
  const q2 = query(collection(db, 'userBlocks'), where('blockerId', '==', userId2), where('blockedId', '==', userId1));
  
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  return !snap1.empty || !snap2.empty;
};

// ========================
// REPORT FUNCTIONS
// ========================

const REPORT_EMAIL = 'yashvisanghvi1812@gmail.com';

// Thresholds:
// 3 reports = Warning notification
// 5 reports = Limited functionality for 24 hours
// 10 reports = Account suspended

export const reportUser = async (
  reporterId: string,
  reportedId: string,
  reason: string,
  description?: string
): Promise<void> => {
  if (!isFirebaseConfigured()) return;

  const existingQuery = query(
    collection(db, 'userReports'),
    where('reporterId', '==', reporterId),
    where('reportedId', '==', reportedId),
    where('status', '==', 'pending')
  );

  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) {
    throw new Error('You have already reported this user');
  }

  await addDoc(collection(db, 'userReports'), {
    reporterId,
    reportedId,
    reason,
    description: description || '',
    status: 'pending',
    createdAt: serverTimestamp()
  });
};


const applyRestriction = async (
  userId: string, 
  type: 'warning' | 'limited' | 'suspended',
  reason: string,
  reportCount: number
): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  
  const existingQuery = query(
    collection(db, 'userRestrictions'),
    where('userId', '==', userId),
    where('type', '==', type)
  );
  const existing = await getDocs(existingQuery);
  if (!existing.empty) return;
  
  const expiresAt = type === 'limited' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
  
  await addDoc(collection(db, 'userRestrictions'), {
    userId, type, reason, reportCount,
    createdAt: serverTimestamp(),
    expiresAt
  });
  
  await addDoc(collection(db, 'notifications'), {
    toUserId: userId,
    fromUserId: 'system',
    fromUserName: 'TeamUp System',
    type: 'REPORT_WARNING',
    message: reason,
    read: false,
    createdAt: serverTimestamp()
  });
};

const sendReportEmail = async (reportedUserId: string, reportCount: number, reason: string): Promise<void> => {
  console.log(`[REPORT EMAIL] To: ${REPORT_EMAIL}`);
  console.log(`Subject: User Report Alert - ${reportedUserId}`);
  console.log(`Body: User ${reportedUserId} has received ${reportCount} reports. Reason: ${reason}`);
  
  await addDoc(collection(db, 'adminNotifications'), {
    type: 'report_alert',
    reportedUserId,
    reportCount,
    reason,
    adminEmail: REPORT_EMAIL,
    createdAt: serverTimestamp()
  });
};

export const getUserRestriction = async (userId: string): Promise<UserRestriction | null> => {
  if (!isFirebaseConfigured()) return null;
  
  const q = query(collection(db, 'userRestrictions'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  const restriction = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as UserRestriction;
  
  if (restriction.expiresAt && restriction.expiresAt.toDate() < new Date()) {
    await deleteDoc(snapshot.docs[0].ref);
    return null;
  }
  
  return restriction;
};

export const isUserRestricted = async (userId: string): Promise<{ restricted: boolean; type?: string; reason?: string }> => {
  const restriction = await getUserRestriction(userId);
  if (!restriction) return { restricted: false };
  return {
    restricted: restriction.type === 'limited' || restriction.type === 'suspended',
    type: restriction.type,
    reason: restriction.reason
  };
};

export const getReportReasons = (): string[] => [
  'Spam or misleading',
  'Harassment or bullying',
  'Inappropriate content',
  'Fake profile or impersonation',
  'Fraudulent certificates',
  'Other'
];
