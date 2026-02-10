import type { UserProfile, Team } from '@/types/firestore.types';

interface TeamRecommendation {
  missingRoles: string[];
  recommendedUsers: {
    user: UserProfile;
    reason: string;
  }[];
  explanation: string;
}

// Rule-based recommendations (team-specific & filtered)
export const getTeamRecommendations = async (
  team: Team,
  currentMembers: { role: string; userId?: string }[],
  availableUsers: UserProfile[]
): Promise<TeamRecommendation> => {
  try {
    const currentRoles = currentMembers.map(m => m.role);

    // ✅ exclude already joined members
    const currentMemberIds = new Set(
      currentMembers.map(m => m.userId).filter(Boolean)
    );

    const filteredUsers = availableUsers.filter(u => !currentMemberIds.has(u.id));

    return getDefaultRecommendation(team, currentRoles, filteredUsers);
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

  // Normalize roles
  const normalizedCurrentRoles = currentRoles.map(r => r.toLowerCase());

  // Missing roles
  const inferredMissingRoles = ALL_ROLES.filter(role =>
    !normalizedCurrentRoles.some(cr => cr.includes(role.toLowerCase()))
  );

  // Priority roles from team.rolesNeeded first
  const prioritizedMissingRoles = team.rolesNeeded?.length
    ? Array.from(new Set([...team.rolesNeeded, ...inferredMissingRoles])).slice(0, 3)
    : inferredMissingRoles.slice(0, 3);

  const teamDesc = team.description?.toLowerCase() || '';

  // Score users based on role + description + skills
  const scoredUsers = availableUsers.map(user => {
    let score = 0;

    const userRole = user.primaryRole?.toLowerCase() || '';

    // Role match (big weight)
    prioritizedMissingRoles.forEach(role => {
      const roleLower = role.toLowerCase();
      if (userRole.includes(roleLower) || roleLower.includes(userRole)) {
        score += 10;
      }
    });

    // Skills match (medium weight)
    if (user.skills) {
      user.skills.forEach(skill => {
        const skillName = skill.name.toLowerCase();

        if (teamDesc.includes(skillName)) {
          score += 5;
        }

        prioritizedMissingRoles.forEach(role => {
          if (role.toLowerCase().includes(skillName)) {
            score += 2;
          }
        });
      });
    }

    // Bio match (small weight)
    if (user.bio && teamDesc) {
      const keywords = teamDesc.split(/\s+/);
      keywords.forEach(word => {
        if (word.length > 4 && user.bio!.toLowerCase().includes(word)) {
          score += 1;
        }
      });
    }

    return { user, score };
  });

  // Sort and pick top 3
 const recommendedUsers = scoredUsers
  .filter(item => item.score > 0)
  .sort((a, b) => {
    // higher score first
    if (b.score !== a.score) return b.score - a.score;

    // if same score, randomize
    return Math.random() - 0.5;
  })
  .slice(0, 3)
  .map(item => ({
    user: item.user,
    reason: `Matches role: ${item.user.primaryRole || "N/A"}. Skills: ${
      item.user.skills?.slice(0, 3).map(s => s.name).join(', ') || 'various technologies'
    }.`
  }));

  // Explanation
  let explanation = 'Based on your team composition, ';

  if (prioritizedMissingRoles.length > 0) {
    explanation += `we recommend adding ${prioritizedMissingRoles.join(', ')} to balance the team.`;
  } else {
    explanation += 'your team already looks balanced.';
  }

  if (teamDesc.includes('ai') || teamDesc.includes('ml')) {
    explanation += ' Since your project involves AI/ML, technical expertise is important.';
  }

  if (teamDesc.includes('mobile') || teamDesc.includes('app')) {
    explanation += ' A Mobile Developer would be valuable.';
  }

  if (teamDesc.includes('design') || teamDesc.includes('ux')) {
    explanation += ' Strong UI/UX will improve user experience.';
  }

  return {
    missingRoles: prioritizedMissingRoles,
    recommendedUsers,
    explanation
  };
}
