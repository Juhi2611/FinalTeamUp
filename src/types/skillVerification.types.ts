// Skill Verification Types - GitHub OAuth-based verification system
import { Timestamp } from 'firebase/firestore';
// Metrics for skill verification (each 0-25, total 0-100)
export interface SkillMetrics {
  activity: number;      // Based on commit frequency and repo count
  consistency: number;   // Based on commit distribution over time
  recency: number;       // Based on how recent the activity is
  diversity: number;     // Based on variety of languages/technologies
}
// GitHub source data stored with verification
export interface GitHubSource {
  username: string;
  profileUrl: string;
  oauthVerified: boolean;  // MUST be true - OAuth is mandatory
  inferredSkills: string[];
  analyzedAt: Timestamp;
  repoCount: number;
  languages: string[];
  totalCommits: number;
  lastCommitDate: string | null;
}
// Main skill verification document structure
export interface SkillVerification {
  id: string;
  userId: string;
  status: 'pending' | 'verified' | 'rejected';
  verifiedSkills: string[];

  /** 🔥 ADD THIS */
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
    certificates?: {
      fileName: string;
      extractedName: string;
      nameMatch: boolean;
      courseTopics: string[];
      inferredSkills: string[];
      verifiedAt: Timestamp;
    }[];
  };

  profileSkillsAtVerification: string[];
  verifiedAt?: Timestamp;
}

// Advanced GitHub stats returned from analysis
export interface AdvancedGitHubStats {
  username: string;
  profileUrl: string;
  repoCount: number;
  languages: string[];
  totalCommits: number;
  lastCommitDate: string | null;
  inferredSkills: string[];
  metrics: SkillMetrics;
  overallScore: number;
}
// Verification flow steps
export type VerificationStep = 
  | 'input'           // User enters GitHub URL
  | 'authenticating'  // GitHub OAuth in progress
  | 'fetching'        // Fetching GitHub data
  | 'analyzing'       // Analyzing repositories
  | 'success'         // Verification complete
  | 'error';          // Error occurred
// Props for the verification modal
export interface GitHubOAuthVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userSkills: string[];
  userId: string;
  onVerificationComplete?: (verification: SkillVerification) => void;
}
// Props for score card
export interface SkillScoreCardProps {
  overallScore: number;
  metrics: SkillMetrics;
  animate?: boolean;
}
// Props for verified skill badge
export interface VerifiedSkillBadgeProps {
  skill: string;
  isVerified: boolean;
  showIcon?: boolean;
}
// Props for verified skills list
export interface VerifiedSkillsListProps {
  skills: string[];
  verifiedSkills: string[];
  showVerifiedFirst?: boolean;
}
// GitHub API response types
export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  public_repos: number;
  created_at: string;
}
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  topics: string[];
}
export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
}
// Language to skill mapping
export const LANGUAGE_TO_SKILLS: Record<string, string[]> = {
  'JavaScript': ['JavaScript', 'Node.js', 'React', 'Vue.js', 'Express.js'],
  'TypeScript': ['TypeScript', 'React', 'Node.js', 'Angular'],
  'Python': ['Python', 'Django', 'Flask', 'Machine Learning', 'Data Science'],
  'Java': ['Java', 'Spring Boot', 'Android'],
  'Kotlin': ['Kotlin', 'Android'],
  'Swift': ['Swift', 'iOS Development'],
  'Go': ['Go', 'Golang', 'Backend Development'],
  'Rust': ['Rust', 'Systems Programming'],
  'C++': ['C++', 'Systems Programming', 'Game Development'],
  'C#': ['C#', '.NET', 'Unity', 'Game Development'],
  'Ruby': ['Ruby', 'Ruby on Rails'],
  'PHP': ['PHP', 'Laravel', 'WordPress'],
  'HTML': ['HTML', 'Web Development', 'Frontend'],
  'CSS': ['CSS', 'Web Development', 'Frontend', 'Tailwind CSS'],
  'SCSS': ['CSS', 'SASS', 'Frontend'],
  'Vue': ['Vue.js', 'JavaScript', 'Frontend'],
  'Dart': ['Dart', 'Flutter', 'Mobile Development'],
  'Scala': ['Scala', 'Big Data', 'Spark'],
  'R': ['R', 'Data Science', 'Statistics'],
  'Shell': ['Shell', 'DevOps', 'Linux', 'Bash'],
  'Dockerfile': ['Docker', 'DevOps', 'Containers'],
  'HCL': ['Terraform', 'DevOps', 'Infrastructure as Code'],
};
// Topic to skill mapping
export const TOPIC_TO_SKILLS: Record<string, string[]> = {
  'react': ['React', 'JavaScript', 'Frontend'],
  'reactjs': ['React', 'JavaScript', 'Frontend'],
  'react-native': ['React Native', 'Mobile Development'],
  'nextjs': ['Next.js', 'React', 'Full Stack'],
  'vue': ['Vue.js', 'JavaScript', 'Frontend'],
  'vuejs': ['Vue.js', 'JavaScript', 'Frontend'],
  'angular': ['Angular', 'TypeScript', 'Frontend'],
  'svelte': ['Svelte', 'JavaScript', 'Frontend'],
  'nodejs': ['Node.js', 'JavaScript', 'Backend'],
  'express': ['Express.js', 'Node.js', 'Backend'],
  'django': ['Django', 'Python', 'Backend'],
  'flask': ['Flask', 'Python', 'Backend'],
  'fastapi': ['FastAPI', 'Python', 'Backend'],
  'spring': ['Spring Boot', 'Java', 'Backend'],
  'spring-boot': ['Spring Boot', 'Java', 'Backend'],
  'rails': ['Ruby on Rails', 'Ruby', 'Backend'],
  'laravel': ['Laravel', 'PHP', 'Backend'],
  'graphql': ['GraphQL', 'API Development'],
  'rest-api': ['REST API', 'Backend'],
  'docker': ['Docker', 'DevOps', 'Containers'],
  'kubernetes': ['Kubernetes', 'DevOps', 'Cloud'],
  'aws': ['AWS', 'Cloud', 'DevOps'],
  'gcp': ['Google Cloud', 'Cloud', 'DevOps'],
  'azure': ['Azure', 'Cloud', 'DevOps'],
  'machine-learning': ['Machine Learning', 'AI', 'Data Science'],
  'deep-learning': ['Deep Learning', 'AI', 'Machine Learning'],
  'tensorflow': ['TensorFlow', 'Machine Learning', 'Python'],
  'pytorch': ['PyTorch', 'Machine Learning', 'Python'],
  'data-science': ['Data Science', 'Python', 'Statistics'],
  'flutter': ['Flutter', 'Dart', 'Mobile Development'],
  'ios': ['iOS Development', 'Swift'],
  'android': ['Android', 'Kotlin', 'Java'],
  'unity': ['Unity', 'Game Development', 'C#'],
  'unreal': ['Unreal Engine', 'Game Development', 'C++'],
  'tailwindcss': ['Tailwind CSS', 'CSS', 'Frontend'],
  'tailwind': ['Tailwind CSS', 'CSS', 'Frontend'],
  'mongodb': ['MongoDB', 'NoSQL', 'Database'],
  'postgresql': ['PostgreSQL', 'SQL', 'Database'],
  'mysql': ['MySQL', 'SQL', 'Database'],
  'redis': ['Redis', 'Caching', 'Database'],
  'firebase': ['Firebase', 'Backend', 'Cloud'],
  'supabase': ['Supabase', 'Backend', 'Database'],
  'prisma': ['Prisma', 'ORM', 'Database'],
  'typescript': ['TypeScript', 'JavaScript'],
  'blockchain': ['Blockchain', 'Web3', 'Solidity'],
  'solidity': ['Solidity', 'Blockchain', 'Smart Contracts'],
  'web3': ['Web3', 'Blockchain', 'Ethereum'],
};
// Score labels based on overall score
export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Exceptional';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 40) return 'Fair';
  return 'Developing';
}
// Score color based on overall score
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-teal-500';
  if (score >= 40) return 'text-amber-500';
  return 'text-orange-500';
}