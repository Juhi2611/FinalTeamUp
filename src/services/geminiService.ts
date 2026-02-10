import type { UserProfile, Team } from '@/types/firestore.types';

interface TeamRecommendation {
  missingRoles: string[];
  recommendedUsers: {
    user: UserProfile;
    reason: string;
  }[];
  explanation: string;
}

// Rule-based recommendations (team-specific & scored)
export const getTeamRecommendations = async (
  team: Team,
  currentMembers: { role: string }[],
  availableUsers: UserProfile[]
): Promise<TeamRecommendation> => {
  try {
    const currentRoles = currentMembers.map(m => m.role);
    return getDefaultRecommendation(team, currentRoles, availableUsers);
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return getDefaultRecommendation(team, [], availableUsers);
  }
};

function getDefaultRecommendation(
  team: Team,
  currentRoles: string[],
  availableUsers: UserProfile[]
): TeamRecommendation {
  const ALL_ROLES = [
    'Frontend Developer',
    'Backend Developer',
    'UI/UX Designer',
    'Tester',
    'ML Engineer',
    'Full Stack Developer',
    'Mobile Developer',
    'DevOps Engineer',
    'Product Manager'
  ];

  /* -----------------------------
   * 1️⃣ Find missing roles
   * ----------------------------- */
  const normalizedCurrentRoles = currentRoles.map(r => r.toLowerCase());

  const inferredMissingRoles = ALL_ROLES.filter(role =>
    !normalizedCurrentRoles.includes(role.toLowerCase())
  );

  const prioritizedMissingRoles = team.rolesNeeded?.length
    ? Array.from(new Set([...team.rolesNeeded, ...inferredMissingRoles])).slice(0, 3)
    : inferredMissingRoles.slice(0, 3);

  /* -----------------------------
   * 2️⃣ Score users per team
   * ----------------------------- */
  const teamDesc = team.description?.toLowerCase() || '';

  const scoredUsers = availableUsers.map(user => {
    let score = 0;

    const userRole = user.primaryRole?.toLowerCase() || '';

    // Role match (strong signal)
    prioritizedMissingRoles.forEach(role => {
      const roleLower = role.toLowerCase();
      if (userRole.includes(roleLower) || roleLower.includes(userRole)) {
        score += 5;
      }
    });

    // Skill match with team description
    if (user.skills) {
      user.skills.forEach(skill => {
        if (teamDesc.includes(skill.name.toLowerCase())) {
          score += 3;
        }
      });
    }

    // Bio relevance (soft signal)
    if (user.bio && teamDesc) {
      const keywords = teamDesc.split(' ');
      keywords.forEach(word => {
        if (word.length > 3 && user.bio!.toLowerCase().includes(word)) {
          score += 1;
        }
      });
    }

    return { user, score };
  });

  /* -----------------------------
   * 3️⃣ Pick top 3 users
   * ----------------------------- */
  const recommendedUsers = scoredUsers
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => ({
      user: item.user,
      reason: `Strong match for ${item.user.primaryRole}. Relevant skills: ${
        item.user.skills?.slice(0, 3).map(s => s.name).join(', ') || 'various technologies'
      }.`
    }));

  /* -----------------------------
   * 4️⃣ Build explanation
   * ----------------------------- */
  let explanation = 'Based on your team composition, ';

  if (prioritizedMissingRoles.length > 0) {
    explanation += `we recommend adding ${prioritizedMissingRoles.join(', ')} to balance the team.`;
  } else {
    explanation += 'your team already looks well-balanced.';
  }

  if (teamDesc.includes('ai') || teamDesc.includes('ml')) {
    explanation += ' Since this project involves AI/ML, technical depth is especially important.';
  }

  if (teamDesc.includes('mobile') || teamDesc.includes('app')) {
    explanation += ' Mobile experience will be valuable for this project.';
  }

  if (teamDesc.includes('design') || teamDesc.includes('ux')) {
    explanation += ' Strong UX skills can significantly improve user experience.';
  }

  return {
    missingRoles: prioritizedMissingRoles,
    recommendedUsers,
    explanation
  };
}
