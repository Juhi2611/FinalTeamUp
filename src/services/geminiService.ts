import type { UserProfile, Team } from '@/types/firestore.types';

interface TeamRecommendation {
  missingRoles: string[];
  recommendedUsers: {
    user: UserProfile;
    reason: string;
  }[];
  explanation: string;
}

// Team-specific rule-based recommendations
export const getTeamRecommendations = async (
  team: Team,
  currentMembers: { role: string; userId?: string }[],
  availableUsers: UserProfile[]
): Promise<TeamRecommendation> => {
  try {
    return buildTeamRecommendation(team, currentMembers, availableUsers);
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return {
      missingRoles: [],
      recommendedUsers: [],
      explanation: 'Unable to generate recommendations at this time.'
    };
  }
};

function buildTeamRecommendation(
  team: Team,
  currentMembers: { role: string; userId?: string }[],
  availableUsers: UserProfile[]
): TeamRecommendation {
  /* -----------------------------
   * 1️⃣ Find missing roles
   * ----------------------------- */
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

  const currentRoles = currentMembers.map(m => m.role.toLowerCase());

  const inferredMissingRoles = ALL_ROLES.filter(
    role => !currentRoles.some(r => r.includes(role.toLowerCase()))
  );

  const prioritizedMissingRoles = team.rolesNeeded?.length
    ? Array.from(new Set([...team.rolesNeeded, ...inferredMissingRoles])).slice(0, 3)
    : inferredMissingRoles.slice(0, 3);

  /* -----------------------------
   * 2️⃣ Exclude existing members
   * ----------------------------- */
  const currentMemberIds = new Set(
    currentMembers.map(m => m.userId).filter(Boolean)
  );

  const teamDesc = team.description?.toLowerCase() || '';

  /* -----------------------------
   * 3️⃣ Score users uniquely per team
   * ----------------------------- */
  const scoredUsers = availableUsers
    .filter(user => !currentMemberIds.has(user.id))
    .map(user => {
      let score = 0;
      const userRole = user.primaryRole?.toLowerCase() || '';

      // Strong signal: role match
      prioritizedMissingRoles.forEach(role => {
        const roleLc = role.toLowerCase();
        if (userRole.includes(roleLc) || roleLc.includes(userRole)) {
          score += 5;
        }
      });

      // Medium signal: skill relevance
      if (user.skills) {
        user.skills.forEach(skill => {
          if (teamDesc.includes(skill.name.toLowerCase())) {
            score += 3;
          }
        });
      }

      // Soft signal: bio relevance
      if (user.bio) {
        teamDesc.split(' ').forEach(word => {
          if (word.length > 3 && user.bio!.toLowerCase().includes(word)) {
            score += 1;
          }
        });
      }

      return { user, score };
    });

  /* -----------------------------
   * 4️⃣ Pick top 3 users
   * ----------------------------- */
  const recommendedUsers = scoredUsers
    .filter(u => u.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ user }) => ({
      user,
      reason: `Good match for ${user.primaryRole}. Relevant skills: ${
        user.skills?.slice(0, 3).map(s => s.name).join(', ') || 'varied experience'
      }.`
    }));

  /* -----------------------------
   * 5️⃣ Explanation
   * ----------------------------- */
  let explanation = 'Based on your current team setup, ';

  if (prioritizedMissingRoles.length) {
    explanation += `adding ${prioritizedMissingRoles.join(', ')} would improve balance.`;
  } else {
    explanation += 'the team already looks well-rounded.';
  }

  if (teamDesc.includes('ai') || teamDesc.includes('ml')) {
    explanation += ' AI/ML experience is especially valuable here.';
  }

  if (teamDesc.includes('mobile') || teamDesc.includes('app')) {
    explanation += ' Mobile development expertise could help.';
  }

  if (teamDesc.includes('design') || teamDesc.includes('ux')) {
    explanation += ' Strong UX skills will improve usability.';
  }

  return {
    missingRoles: prioritizedMissingRoles,
    recommendedUsers,
    explanation
  };
}
