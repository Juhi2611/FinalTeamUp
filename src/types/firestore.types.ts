import { Timestamp, FieldValue } from 'firebase/firestore';
import { Sprout, Zap, Hammer, Trophy, Crown } from 'lucide-react';

// ========================
// PERKS SYSTEM
// ========================

export type PerkRank = 'Pioneer' | 'Contributor' | 'Builder' | 'Elite' | 'Legend';

export interface PerkRankInfo {
  rank: PerkRank;
  label: string;
  color: string;
  bg: string;
  border: string;
  minPerks: number;
  maxPerks: number | null;
  emoji: string;
}

export const PERK_RANKS: PerkRankInfo[] = [
  { rank: 'Pioneer',     label: 'Pioneer',     color: 'text-slate-500',   bg: 'bg-slate-100',   border: 'border-slate-300',   minPerks: 0,   maxPerks: 49,   emoji: '🌱' },
  { rank: 'Contributor', label: 'Contributor', color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-200',    minPerks: 50,  maxPerks: 149,  emoji: '⚡' },
  { rank: 'Builder',     label: 'Builder',     color: 'text-violet-600',  bg: 'bg-violet-50',   border: 'border-violet-200',  minPerks: 150, maxPerks: 349,  emoji: '🔨' },
  { rank: 'Elite',       label: 'Elite',       color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-200',   minPerks: 350, maxPerks: 699,  emoji: '🏆' },
  { rank: 'Legend',      label: 'Legend',      color: 'text-rose-600',    bg: 'bg-rose-50',     border: 'border-rose-200',    minPerks: 700, maxPerks: null, emoji: '👑' },
];

/** Returns the rank info for a given perk balance. */
export const getPerkRank = (perks: number): PerkRankInfo => {
  return (
    [...PERK_RANKS].reverse().find(r => perks >= r.minPerks) ?? PERK_RANKS[0]
  );
};

// ========================
// PERK COST CONSTANTS
// ========================

/** Perks granted automatically on account creation. */
export const INITIAL_PERKS = 50;

/** Flat cost to send a join request or accept an invite. */
export const TEAM_JOIN_COST = 10;

/** Flat cost to create a new team. */
export const TEAM_CREATE_COST = 25;

/** Cost charged to the interviewer when an interview session actually starts. */
export const INTERVIEW_COST = 5;

/** Fraction of task perk value deducted when deadline is missed (0.30 = 30%). */
export const DEADLINE_PENALTY_RATE = 0.30;

/** @deprecated Use TEAM_JOIN_COST. Kept for backward compat. */
export const JOIN_FEE = TEAM_JOIN_COST;
/** @deprecated No longer meaningful — join is flat cost. */
export const JOIN_FEE_THRESHOLD = 0;

export const getJoinFee = (_perks: number): number => TEAM_JOIN_COST;

// ========================
// PERK TRANSACTION LOG
// ========================

export type PerkTransactionType =
  | 'signup_bonus'
  | 'team_join'
  | 'team_create'
  | 'interview'
  | 'task_reward'
  | 'deadline_penalty'
  | 'referral';

export interface PerkTransaction {
  id: string;
  userId: string;
  /** Positive = credit, Negative = debit */
  amount: number;
  type: PerkTransactionType;
  description: string;
  /** Related entity ID (teamId / taskId / interviewId) */
  relatedId?: string;
  /** Perk balance after this transaction */
  balanceAfter: number;
  createdAt: Timestamp | FieldValue;
}

// ========================
// USER PROFILE
// ========================

export interface UserProfile {
  id: string;
  username?: string;
  imageUrl?: string;
  name?: string;
  email: string;
  fullName: string;
  college?: string;
  yearOfStudy?: 'First Year' | 'Second Year' | 'Third Year' | 'Fourth Year';
  city: string;
  primaryRole?: 'Frontend Developer' | 'Backend Developer' | 'UI/UX Designer' | 'Tester' | 'Full Stack Developer' | 'ML Engineer' | 'Mobile Developer' | 'DevOps Engineer' | 'Product Manager';
  skills?: { name: string; proficiency: 'Beginner' | 'Intermediate' | 'Pro' }[];
  bio?: string;
  avatar?: string;
  fromUserAvatar?: string;
  teamId: string | null;
  teamIds?: string[];
  leaderOfTeamIds: string[];
  isTeamLeader?: boolean;
  averageRating?: number;
  totalRatings?: number;
  cvUrl?: string;
  videoUrl?: string;
  cvUploaded?: boolean;
  videoUploaded?: boolean;

  // ========================
  // PERKS SYSTEM
  // ========================
  /** Current spendable Perks balance */
  perks?: number;
  /** Lifetime Perks earned (never decremented — used for leaderboards/rank) */
  totalPerksEarned?: number;
  /** Set to true after the 50-perk signup bonus has been granted (idempotency guard) */
  initialPerksGranted?: boolean;

  // ========================
  // REFERRAL SYSTEM
  // ========================
  /** Unique referral code for this user */
  referralCode?: string;
  /** UID of the user who referred this user (if any) */
  referredBy?: string;
  /** How many users this user has referred successfully */
  referralCount?: number;

  // Verification Flags
  isProfileVerified?: boolean;
  isSkillVerified?: boolean;

  // GitHub Verification Fields
  githubVerified?: boolean;
  githubUsername?: string;
  githubProfileUrl?: string;
  githubVerifiedAt?: Timestamp | FieldValue;
  githubStats?: {
    publicRepos: number;
    followers: number;
    following: number;
  };

  // DEPRECATED: Keep for backward compatibility
  skillVerification?: {
    verified: boolean;
    githubVerified?: boolean;
    certificatesVerified?: number;
    verifiedAt?: Timestamp;
  };

  createdAt: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

// ========================
// TEAM
// ========================

export interface Team {
  id: string;
  name: string;
  description: string;
  city: string;
  college?: string;
  hackathon?: string | null;
  leaderId: string;
  leaderName?: string;
  members: { userId: string; role: string; userName?: string }[];
  maxMembers: number;
  status: 'forming' | 'active' | 'complete';
  rolesNeeded?: string[];
  createdAt: Timestamp;
  recentlyLeft?: {
    userId: string;
    name: string;
    avatar?: string | null;
    leftAt: Timestamp;
  }[];
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: Timestamp;
}

// ========================
// INVITATIONS
// ========================

export interface Invitation {
  id: string;
  teamId: string;
  teamName: string;
  teamDescription?: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  message?: string;
  type: 'invite' | 'join_request';
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
}

// ========================
// NOTIFICATIONS
// ========================

export interface Notification {
  id: string;
  toUserId: string;
  fromUserId: string;
  fromUserName?: string;
  type: 'INVITE' | 'ACCEPTED' | 'REJECTED' | 'TEAM_UPDATE' | 'JOIN_REQUEST' | 'MESSAGE';
  teamId?: string;
  teamName?: string;
  message?: string;
  conversationId?: string;
  read: boolean;
  createdAt: Timestamp;
}

// ========================
// FEED
// ========================

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole?: string;
  type: 'team_created' | 'member_joined' | 'looking_for_team' | 'open_to_join' | 'user_post';
  title: string;
  description: string;
  imageUrl?: string;
  teamId?: string;
  teamName?: string;
  rolesNeeded?: string[];
  skills?: string[];
  tags?: string[];
  createdAt: Timestamp;
}

// ========================
// WORKSPACE
// ========================

export interface WorkspaceLog {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: Timestamp;
}

// ========================
// TASKS
// ========================

export interface TeamTask {
  verifiedAt: boolean;
  status: any;
  id: string;
  teamId: string;
  title: string;
  assignedTo: string[];
  completed: boolean;
  completedBy?: string;
  completedAt?: Timestamp;
  createdAt: Timestamp;
  /** Perk value awarded to the task completer upon leader verification. Defaults to 10 if not set. */
  perkValue?: number;
  /** Optional deadline for the task (set by leader). If missed, 30% penalty applies. */
  deadline?: Timestamp | null;
  /** True once the 30% deadline penalty has been deducted, preventing double penalties. */
  deadlinePenaltyApplied?: boolean;
}

// ========================
// SKILL VERIFICATION
// ========================

export interface SkillVerification {
  id: string;
  userId: string;
  status: 'pending' | 'verified' | 'invalidated';
  verifiedSkills: string[];

  stats?: {
    languageUsage: {
      language: string;
      bytes: number;
      percent: number;
    }[];
  };

  sources: {
    github?: {
      username: string;
      profileUrl: string;
      oauthVerified: boolean;
      inferredSkills: string[];
      analyzedAt: Timestamp;
    };
    certificates?: Array<{
      fileName: string;
      extractedName: string;
      nameMatch: boolean;
      courseTopics: string[];
      inferredSkills: string[];
      verifiedAt: Timestamp;
    }>;
    linkedin?: {
      profileUrl: string;
      oauthVerified: boolean;
      inferredSkills: string[];
      analyzedAt: Timestamp;
    };
  };

  profileSkillsAtVerification: string[];

  verifiedAt: Timestamp;
  invalidatedAt?: Timestamp;
  invalidationReason?: 'profile_edited' | 'manual' | 'expired';
}

// ========================
// MESSAGING
// ========================

export interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  lastMessage?: {
    read: any;
    createdAt: any;
    text: string;
    senderId: string;
    sentAt: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  read: boolean;
  createdAt: Timestamp;
}

// ========================
// GITHUB STATS
// ========================

export interface GitHubStats {
  publicRepos: number;
  followers: number;
  following: number;
}

// ========================
// LEADERBOARD
// ========================

export interface LeaderboardEntry {
  userId: string;
  fullName: string;
  avatar?: string;
  primaryRole?: string;
  totalPerksEarned: number;
  perks: number;
  rank: PerkRankInfo;
  position: number;
}