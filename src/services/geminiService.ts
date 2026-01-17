import type { UserProfile, Team } from '@/types/firestore.types';

interface TeamRecommendation {
  missingRoles: string[];
  recommendedUsers: {
    user: UserProfile;
    reason: string;
  }[];
  explanation: string;
}

// Rule-based recommendations (no Gemini API needed for this feature)
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
  const allRoles = [
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
  
  const missingRoles = allRoles.filter(role => 
    !currentRoles.some(cr => cr.toLowerCase().includes(role.toLowerCase()))
  ).slice(0, 3);
  
  const prioritizedMissingRoles = team.rolesNeeded?.length 
    ? [...new Set([...team.rolesNeeded, ...missingRoles])].slice(0, 3)
    : missingRoles;
  
  const recommendedUsers = availableUsers
    .filter(u => {
      const userRole = u.primaryRole?.toLowerCase() || '';
      return prioritizedMissingRoles.some(role => 
        userRole.includes(role.toLowerCase()) || 
        role.toLowerCase().includes(userRole)
      );
    })
    .slice(0, 3)
    .map(user => ({
      user,
      reason: `Matches needed role: ${user.primaryRole}. Skills include ${user.skills?.slice(0, 3).map(s => s.name).join(', ') || 'various technologies'}.`
    }));
  
  let explanation = 'Based on your team composition, ';
  
  if (prioritizedMissingRoles.length > 0) {
    explanation += `we recommend filling these roles to have a well-rounded team: ${prioritizedMissingRoles.join(', ')}.`;
  } else {
    explanation += 'your team seems well-balanced! Consider adding specialized roles based on your project needs.';
  }
  
  if (team.description) {
    const desc = team.description.toLowerCase();
    if (desc.includes('ai') || desc.includes('ml') || desc.includes('machine learning')) {
      explanation += ' Given your AI/ML focus, an ML Engineer would be valuable.';
    }
    if (desc.includes('mobile') || desc.includes('app')) {
      explanation += ' For mobile development, consider a Mobile Developer.';
    }
    if (desc.includes('design') || desc.includes('ux') || desc.includes('user')) {
      explanation += ' A strong UI/UX Designer would help with user experience.';
    }
  }

  return {
    missingRoles: prioritizedMissingRoles,
    recommendedUsers,
    explanation
  };
}