import { Timestamp, FieldValue } from 'firebase/firestore';

export interface UserProfile {
  id: string;
  name?: string;
  email: string;
  fullName: string;
  college?: string;
  yearOfStudy?: 'First Year' | 'Second Year' | 'Third Year' | 'Fourth Year';
  primaryRole?: 'Frontend Developer' | 'Backend Developer' | 'UI/UX Designer' | 'Tester' | 'Full Stack Developer' | 'ML Engineer' | 'Mobile Developer' | 'DevOps Engineer' | 'Product Manager';
  skills?: { name: string; proficiency: 'Beginner' | 'Intermediate' | 'Pro' }[];
  bio?: string;
  avatar?: string;
  teamId: string | null;
  isTeamLeader?: boolean;
  
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
  
  // DEPRECATED: Keep for backward compatibility but use skillVerifications collection instead
  skillVerification?: {
    verified: boolean;
    githubVerified?: boolean;
    certificatesVerified?: number;
    verifiedAt?: Timestamp;
  };
  
  createdAt: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  hackathon?: string;
  leaderId: string;
  leaderName?: string;
  members: { userId: string; role: string; userName?: string }[];
  maxMembers: number;
  status: 'forming' | 'active' | 'complete';
  rolesNeeded?: string[];
  createdAt: Timestamp;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: Timestamp;
}

export interface Invitation {
  id: string;
  teamId: string;
  teamName: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  message?: string;
  type: 'invite' | 'join_request';
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
}

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

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole?: string;
  type: 'team_created' | 'member_joined' | 'looking_for_team' | 'open_to_join' | 'user_post';
  title: string;
  description: string;
  teamId?: string;
  teamName?: string;
  rolesNeeded?: string[];
  skills?: string[];
  tags?: string[];
  createdAt: Timestamp;
}

export interface WorkspaceLog {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: Timestamp;
}

export interface TeamTask {
  id: string;
  teamId: string;
  title: string;
  assignedTo: string[];
  completed: boolean;
  completedBy?: string;
  completedAt?: Timestamp;
  createdAt: Timestamp;
}

// Comprehensive skill verification structure
export interface SkillVerification {
  id: string;
  userId: string;
  status: 'pending' | 'verified' | 'invalidated';
  verifiedSkills: string[];
  
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

// Messaging types
export interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  lastMessage?: {
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

// GitHub Stats type for fetchGitHubStats
export interface GitHubStats {
  publicRepos: number;
  followers: number;
  following: number;
}
