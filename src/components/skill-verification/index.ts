// Skill Verification Components - Export Index
export { 
  GitHubOAuthVerificationModal,
  default as VerificationModal 
} from '../github/GitHubOAuthVerificationModal';
export { 
  SkillScoreCard, 
  InlineScoreDisplay,
  default as ScoreCard 
} from './SkillScoreCard';
export { 
  VerifiedSkillBadge, 
  VerifiedSkillsList,
  VerificationSummaryBadge,
  SkillsVerifiedBadge,
  default as SkillBadge 
} from './VerifiedSkillBadge';
// Re-export types for convenience
export type {
  SkillVerification,
  SkillMetrics,
  GitHubSource,
  AdvancedGitHubStats,
  VerificationStep,
  GitHubOAuthVerificationModalProps,
  SkillScoreCardProps,
  VerifiedSkillBadgeProps,
  VerifiedSkillsListProps,
} from '@/types/skillVerification.types';
// Re-export utility functions
export { 
  getScoreLabel, 
  getScoreColor 
} from '@/types/skillVerification.types';