// GitHub Service - Fetches and analyzes GitHub profiles for skill verification
import { 
  AdvancedGitHubStats, 
  GitHubUser, 
  GitHubRepo, 
  SkillMetrics,
  LANGUAGE_TO_SKILLS,
  TOPIC_TO_SKILLS 
} from '@/types/skillVerification.types';
// Extract username from various GitHub URL formats
export function extractGitHubUsername(input: string): string | null {
  const trimmed = input.trim();
  
  // Direct username (no slashes, no dots except in valid usernames)
  if (/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(trimmed) && trimmed.length <= 39) {
    return trimmed;
  }
  
  // URL patterns
  const patterns = [
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/?$/i,
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/.*$/i,
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}
// Validate GitHub URL format
export function validateGitHubUrl(url: string): { isValid: boolean; error?: string } {
  const trimmed = url.trim();
  
  if (!trimmed) {
    return { isValid: false, error: 'Please enter a GitHub profile URL' };
  }
  
  const username = extractGitHubUsername(trimmed);
  
  if (!username) {
    return { isValid: false, error: 'Invalid GitHub URL format. Example: https://github.com/username' };
  }
  
  if (username.length > 39) {
    return { isValid: false, error: 'GitHub username cannot exceed 39 characters' };
  }
  
  return { isValid: true };
}
// Fetch GitHub user profile
export async function fetchGitHubUser(username: string, accessToken?: string): Promise<GitHubUser> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(`https://api.github.com/users/${username}`, { headers });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`GitHub user "${username}" not found`);
    }
    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please try again later.');
    }
    throw new Error(`Failed to fetch GitHub user: ${response.statusText}`);
  }
  
  return response.json();
}
// Fetch user repositories with pagination
export async function fetchUserRepos(
  username: string, 
  accessToken?: string,
  maxPages: number = 5
): Promise<GitHubRepo[]> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const allRepos: GitHubRepo[] = [];
  let page = 1;
  
  while (page <= maxPages) {
    const response = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=pushed`,
      { headers }
    );
    
    if (!response.ok) {
      if (response.status === 403) {
        console.warn('Rate limit hit during repo fetch, using collected repos');
        break;
      }
      throw new Error(`Failed to fetch repositories: ${response.statusText}`);
    }
    
    const repos: GitHubRepo[] = await response.json();
    
    if (repos.length === 0) break;
    
    allRepos.push(...repos);
    
    // Check if there are more pages
    const linkHeader = response.headers.get('Link');
    if (!linkHeader || !linkHeader.includes('rel="next"')) break;
    
    page++;
  }
  
  return allRepos;
}
// Calculate Activity score (0-25)
function calculateActivityScore(repos: GitHubRepo[], totalCommits: number): number {
  // Factors: repo count, commit count, stars received
  const repoScore = Math.min(repos.length / 20, 1) * 8; // Up to 8 points for 20+ repos
  const commitScore = Math.min(totalCommits / 500, 1) * 10; // Up to 10 points for 500+ commits
  const starScore = Math.min(
    repos.reduce((sum, r) => sum + r.stargazers_count, 0) / 50, 
    1
  ) * 7; // Up to 7 points for 50+ total stars
  
  return Math.round(repoScore + commitScore + starScore);
}
// Calculate Consistency score (0-25)
function calculateConsistencyScore(repos: GitHubRepo[]): number {
  if (repos.length === 0) return 0;
  
  // Get push dates from last 12 months
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  
  const recentPushes = repos
    .filter(repo => new Date(repo.pushed_at) >= oneYearAgo)
    .map(repo => new Date(repo.pushed_at));
  
  if (recentPushes.length === 0) return 0;
  
  // Count unique months with activity
  const uniqueMonths = new Set(
    recentPushes.map(date => `${date.getFullYear()}-${date.getMonth()}`)
  );
  
  // Score based on months with activity (max 12)
  const monthScore = Math.min(uniqueMonths.size / 12, 1) * 15;
  
  // Bonus for sustained activity
  const sustainedBonus = uniqueMonths.size >= 6 ? 5 : 0;
  
  // Bonus for recent activity
  const mostRecentPush = new Date(Math.max(...recentPushes.map(d => d.getTime())));
  const daysSinceLastPush = (now.getTime() - mostRecentPush.getTime()) / (1000 * 60 * 60 * 24);
  const recencyBonus = daysSinceLastPush <= 30 ? 5 : daysSinceLastPush <= 90 ? 2 : 0;
  
  return Math.min(25, Math.round(monthScore + sustainedBonus + recencyBonus));
}
// Calculate Recency score (0-25)
function calculateRecencyScore(repos: GitHubRepo[]): number {
  if (repos.length === 0) return 0;
  
  const now = new Date();
  
  // Find most recent push
  const pushDates = repos.map(repo => new Date(repo.pushed_at));
  const mostRecent = new Date(Math.max(...pushDates.map(d => d.getTime())));
  
  const daysSinceLastPush = (now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24);
  
  // Score based on recency
  let recencyScore: number;
  if (daysSinceLastPush <= 7) {
    recencyScore = 25;
  } else if (daysSinceLastPush <= 30) {
    recencyScore = 22;
  } else if (daysSinceLastPush <= 90) {
    recencyScore = 18;
  } else if (daysSinceLastPush <= 180) {
    recencyScore = 12;
  } else if (daysSinceLastPush <= 365) {
    recencyScore = 6;
  } else {
    recencyScore = 2;
  }
  
  return recencyScore;
}
// Calculate Diversity score (0-25)
function calculateDiversityScore(languages: string[], topics: string[]): number {
  // Language diversity (up to 15 points)
  const languageScore = Math.min(languages.length / 5, 1) * 15;
  
  // Topic/technology diversity (up to 10 points)
  const uniqueTopics = new Set(topics.map(t => t.toLowerCase()));
  const topicScore = Math.min(uniqueTopics.size / 8, 1) * 10;
  
  return Math.round(languageScore + topicScore);
}
// Infer skills from languages and topics
function inferSkillsFromProfile(languages: string[], topics: string[]): string[] {
  const skillSet = new Set<string>();
  
  // Add skills from languages
  for (const language of languages) {
    const skills = LANGUAGE_TO_SKILLS[language];
    if (skills) {
      skills.forEach(skill => skillSet.add(skill));
    }
  }
  
  // Add skills from topics
  for (const topic of topics) {
    const normalizedTopic = topic.toLowerCase();
    const skills = TOPIC_TO_SKILLS[normalizedTopic];
    if (skills) {
      skills.forEach(skill => skillSet.add(skill));
    }
  }
  
  return Array.from(skillSet);
}
// Estimate total commits (simplified - counts recent activity)
async function estimateTotalCommits(
  username: string,
  repos: GitHubRepo[],
  accessToken?: string
): Promise<number> {
  // For efficiency, we estimate based on repo activity rather than fetching all commits
  // This avoids hitting rate limits while providing a reasonable approximation
  
  let totalCommits = 0;
  
  // Use repo size and activity as a proxy for commit count
  for (const repo of repos.slice(0, 10)) { // Check top 10 most recently pushed repos
    // Estimate: larger repos with more updates likely have more commits
    const ageInDays = (Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const updateFrequency = (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
    
    // Rough estimation based on repo characteristics
    const estimatedCommits = Math.round(
      (repo.size / 100) * // Size factor
      Math.min(ageInDays / 30, 24) * // Age factor (capped at 24 months)
      (updateFrequency < 30 ? 1.5 : updateFrequency < 90 ? 1.2 : 1) // Activity factor
    );
    
    totalCommits += Math.max(estimatedCommits, 5); // Minimum 5 commits per repo
  }
  
  // Add base commits for remaining repos
  totalCommits += Math.max(0, repos.length - 10) * 10;
  
  return totalCommits;
}
// Main function to fetch and analyze GitHub stats
export async function fetchAdvancedGitHubStats(
  username: string,
  accessToken?: string
): Promise<AdvancedGitHubStats> {
  // Fetch user profile
  const user = await fetchGitHubUser(username, accessToken);
  
  // Fetch repositories
  const repos = await fetchUserRepos(username, accessToken);
  
  // Extract languages (unique, non-null)
  const languages = [...new Set(
    repos
      .map(repo => repo.language)
      .filter((lang): lang is string => lang !== null)
  )];
  
  // Extract all topics
  const allTopics = repos.flatMap(repo => repo.topics || []);
  
  // Estimate total commits
  const totalCommits = await estimateTotalCommits(username, repos, accessToken);
  
  // Find last commit date
  const lastCommitDate = repos.length > 0 
    ? repos.reduce((latest, repo) => {
        const pushDate = new Date(repo.pushed_at);
        return pushDate > new Date(latest) ? repo.pushed_at : latest;
      }, repos[0].pushed_at)
    : null;
  
  // Calculate metrics
  const metrics: SkillMetrics = {
    activity: calculateActivityScore(repos, totalCommits),
    consistency: calculateConsistencyScore(repos),
    recency: calculateRecencyScore(repos),
    diversity: calculateDiversityScore(languages, allTopics),
  };
  
  // Calculate overall score
  const overallScore = metrics.activity + metrics.consistency + metrics.recency + metrics.diversity;
  
  // Infer skills
  const inferredSkills = inferSkillsFromProfile(languages, allTopics);
  
  return {
    username: user.login,
    profileUrl: user.html_url,
    repoCount: repos.length,
    languages,
    totalCommits,
    lastCommitDate,
    inferredSkills,
    metrics,
    overallScore,
  };
}
// Match user's claimed skills against inferred skills
export function matchVerifiedSkills(
  userSkills: string[],
  inferredSkills: string[]
): string[] {
  const normalizedInferred = new Set(
    inferredSkills.map(s => s.toLowerCase().trim())
  );
  
  return userSkills.filter(skill => 
    normalizedInferred.has(skill.toLowerCase().trim())
  );
}
// Normalize skill name for comparison
export function normalizeSkillName(skill: string): string {
  return skill.toLowerCase().trim().replace(/[.\-_\s]+/g, '');
}
// Check if two skills match (case-insensitive, normalized)
export function skillsMatch(skill1: string, skill2: string): boolean {
  return normalizeSkillName(skill1) === normalizeSkillName(skill2);
}