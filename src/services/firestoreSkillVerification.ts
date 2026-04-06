// Firestore Skill Verification Service
// Handles CRUD operations for skill verifications with security guarantees
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SkillVerification, AdvancedGitHubStats } from '@/types/skillVerification.types';
const COLLECTION_NAME = 'skillVerifications';
// Create a new skill verification record
export async function createSkillVerification(
  userId: string,
  githubStats: AdvancedGitHubStats,
  verifiedSkills: string[],
  profileSkills: string[]
): Promise<SkillVerification> {
  // First, invalidate any existing verifications for this user
  await invalidateAllUserVerifications(userId);
  
  const now = Timestamp.now();
  
  const verificationData = {
    userId,
    status: 'verified' as const,
    verifiedSkills,
    profileSkillsAtVerification: profileSkills,
    overallScore: githubStats.overallScore,
    metrics: githubStats.metrics,
    sources: {
      github: {
        username: githubStats.username,
        profileUrl: githubStats.profileUrl,
        oauthVerified: true, // CRITICAL: Must always be true
        inferredSkills: githubStats.inferredSkills,
        analyzedAt: now,
        repoCount: githubStats.repoCount,
        languages: githubStats.languages,
        totalCommits: githubStats.totalCommits,
        lastCommitDate: githubStats.lastCommitDate,
      },
    },
    verifiedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  
  const docRef = await addDoc(collection(db, COLLECTION_NAME), verificationData);
  
  return {
    id: docRef.id,
    ...verificationData,
  };
}
// Get the latest active verification for a user
export async function getLatestSkillVerification(
  userId: string
): Promise<SkillVerification | null> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId),
    where('status', '==', 'verified'),
    orderBy('verifiedAt', 'desc'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as SkillVerification;
}
// Subscribe to real-time verification updates
export function subscribeToSkillVerification(
  userId: string,
  callback: (verification: SkillVerification | null) => void
): () => void {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId),
    where('status', '==', 'verified'),
    orderBy('verifiedAt', 'desc'),
    limit(1)
  );
  
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null);
    } else {
      const doc = snapshot.docs[0];
      callback({
        id: doc.id,
        ...doc.data(),
      } as SkillVerification);
    }
  }, (error) => {
    console.error('Error subscribing to skill verification:', error);
    callback(null);
  });
}
// Invalidate a specific verification
export async function invalidateSkillVerification(
  verificationId: string
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, verificationId);
  await updateDoc(docRef, {
    status: 'invalidated',
    updatedAt: serverTimestamp(),
  });
}
// Invalidate all verifications for a user (called before new verification or on skill edit)
export async function invalidateAllUserVerifications(
  userId: string
): Promise<void> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId),
    where('status', '==', 'verified')
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return;
  
  const batch = writeBatch(db);
  
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'invalidated',
      updatedAt: serverTimestamp(),
    });
  });
  
  await batch.commit();
}
// Check if user has a valid verification
export async function hasValidVerification(userId: string): Promise<boolean> {
  const verification = await getLatestSkillVerification(userId);
  return verification !== null && verification.status === 'verified';
}
// Get verification count for a user (for stats)
export async function getVerificationCount(userId: string): Promise<number> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.size;
}
// Format verification date for display
export function formatVerificationDate(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
// Check if profile skills have changed since verification
export function haveSkillsChanged(
  currentSkills: string[],
  verifiedSkills: string[],
  profileSkillsAtVerification: string[]
): boolean {
  // Compare current profile skills with snapshot at verification time
  const currentSet = new Set(currentSkills.map(s => s.toLowerCase().trim()));
  const snapshotSet = new Set(profileSkillsAtVerification.map(s => s.toLowerCase().trim()));
  
  // If sizes differ, skills have changed
  if (currentSet.size !== snapshotSet.size) return true;
  
  // Check if all current skills were in the snapshot
  for (const skill of currentSet) {
    if (!snapshotSet.has(skill)) return true;
  }
  
  return false;
}