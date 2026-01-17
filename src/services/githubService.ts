interface GitHubAnalysis {
  username: string;
  profileUrl: string;
  inferredSkills: string[];
  repositories: { name: string; languages: string[] }[];
}

// Map programming languages to common skill names
const languageToSkillMap: Record<string, string[]> = {
  'javascript': ['JavaScript', 'JS', 'Node.js', 'React', 'Frontend'],
  'typescript': ['TypeScript', 'JavaScript', 'React', 'Frontend'],
  'python': ['Python', 'Django', 'Flask', 'Machine Learning', 'ML'],
  'java': ['Java', 'Spring', 'Backend'],
  'kotlin': ['Kotlin', 'Android', 'Mobile'],
  'swift': ['Swift', 'iOS', 'Mobile'],
  'go': ['Go', 'Golang', 'Backend'],
  'rust': ['Rust', 'Systems Programming'],
  'c++': ['C++', 'Systems Programming'],
  'c#': ['C#', '.NET', 'Unity'],
  'ruby': ['Ruby', 'Rails', 'Backend'],
  'php': ['PHP', 'Laravel', 'Backend'],
  'html': ['HTML', 'Frontend', 'Web Development'],
  'css': ['CSS', 'Frontend', 'Web Development', 'Tailwind'],
  'scss': ['SCSS', 'CSS', 'Frontend'],
  'vue': ['Vue.js', 'Frontend', 'JavaScript'],
  'dart': ['Dart', 'Flutter', 'Mobile'],
  'shell': ['Shell', 'Bash', 'DevOps'],
  'dockerfile': ['Docker', 'DevOps', 'Containers'],
};

export const extractGitHubUsername = (input: string): string | null => {
  // Handle direct username
  if (/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(input)) {
    return input;
  }
  
  // Handle GitHub URLs
  const urlPatterns = [
    /github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)/,
    /github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\?/,
  ];
  
  for (const pattern of urlPatterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  
  return null;
};

export const analyzeGitHubProfile = async (username: string): Promise<GitHubAnalysis> => {
  // Fetch user's public repositories
  const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`);
  
  if (!reposResponse.ok) {
    if (reposResponse.status === 404) {
      throw new Error('GitHub user not found');
    }
    throw new Error('Failed to fetch GitHub repositories');
  }
  
  const repos = await reposResponse.json();
  
  // Collect all languages
  const languageSet = new Set<string>();
  const repoData: { name: string; languages: string[] }[] = [];
  
  for (const repo of repos) {
    if (repo.language) {
      languageSet.add(repo.language.toLowerCase());
      repoData.push({
        name: repo.name,
        languages: [repo.language]
      });
    }
  }
  
  // Map languages to skills
  const skillSet = new Set<string>();
  languageSet.forEach(lang => {
    const skills = languageToSkillMap[lang];
    if (skills) {
      skills.forEach(skill => skillSet.add(skill));
    } else {
      // Add the language itself as a skill
      skillSet.add(lang.charAt(0).toUpperCase() + lang.slice(1));
    }
  });
  
  return {
    username,
    profileUrl: `https://github.com/${username}`,
    inferredSkills: Array.from(skillSet),
    repositories: repoData.slice(0, 20) // Limit to 20 repos
  };
};
