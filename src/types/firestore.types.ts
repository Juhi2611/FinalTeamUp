import { Timestamp, FieldValue } from 'firebase/firestore';
import { Sprout, Zap, Hammer, Trophy, Crown } from 'lucide-react';

// ========================
// PERKS SYSTEM
// ========================

export type PerkRank = 'Pioneer' | 'Contributor' | 'Builder' | 'Elite' | 'Legend';

export interface PerkRankInfo {
  rank: PerkRank;
  label: string;
  color: string;       // Tailwind text color class
  bg: string;          // Tailwind bg color class
  border: string;      // Tailwind border color class
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

/**
 * Join Fee Logic:
 *  - 0–49 Perks  → Pioneer phase, joining is FREE
 *  - 50+ Perks   → Must spend 50 Perks per join request / invite acceptance
 */
export const JOIN_FEE = 50;
export const JOIN_FEE_THRESHOLD = 50; // Perks below this = free

export const getJoinFee = (perks: number): number =>
  perks >= JOIN_FEE_THRESHOLD ? JOIN_FEE : 0;

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

  // ========================
  // REFERRAL SYSTEM
  // ========================
  /** Unique referral code for this user */
  referralCode?: string;
  /** UID of the user who referred this user (if any) */
  referredBy?: string;
  /** How many users this user has referred successfully */
  referralCount?: number;

  // Identity Verification
  isProfileVerified?: boolean;

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