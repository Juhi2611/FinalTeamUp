import type { UserProfile, Team } from "@/types/firestore.types";

interface TeamRecommendation {
  missingRoles: string[];
  recommendedUsers: {
    user: UserProfile;
    reason: string;
  }[];
  explanation: string;
}

// Rule-based recommendations (team-specific & filtered properly)
export const getTeamRecommendations = async (
  team: Team,
  currentMembers: { role: string; userId?: string }[],
  availableUsers: UserProfile[]
): Promise<TeamRecommendation> => {
  try {
    const currentRoles = currentMembers.map(m => m.role);

    // ✅ Exclude already joined members
    const currentMemberIds = new Set(
      currentMembers.map(m => m.userId).filter(Boolean)
    );

    const filteredUsers = availableUsers.filter(
      u => !currentMemberIds.has(u.id)
    );

    return getDefaultRecommendation(team, currentRoles, filteredUsers);
  } catch (error) {
    console.error("Error getting recommendations:", error);
    return getDefaultRecommendation(team, [], availableUsers);
  }
};

function getDefaultRecommendation(
  team: Team,
  currentRoles: string[],
  availableUsers: UserProfile[]
): TeamRecommendation {
  const ALL_ROLES = [
    "Frontend Developer",
    "Backend Developer",
    "UI/UX Designer",
    "Tester",
    "ML Engineer",
    "Full Stack Developer",
    "Mobile Developer",
    "DevOps Engineer",
    "Product Manager"
  ];

  /* -----------------------------
   * 1️⃣ Find missing roles
   * ----------------------------- */
  const normalizedCurrentRoles = currentRoles.map(r => r.toLowerCase());

  const inferredMissingRoles = ALL_ROLES.filter(role =>
    !normalizedCurrentRoles.some(cr =>
      cr.includes(role.toLowerCase())
    )
  );

  const prioritizedMissingRoles = team.rolesNeeded?.length
    ? Array.from(new Set([...team.rolesNeeded, ...inferredMissingRoles])).slice(
        0,
        3
      )
    : inferredMissingRoles.slice(0, 3);

  const teamDesc = team.description?.toLowerCase() || "";

  /* -----------------------------
   * 2️⃣ HARD FILTER by missing roles
   * ----------------------------- */
  const roleMatchedUsers = availableUsers.filter(user => {
    if (!user.primaryRole) return false;

    return prioritizedMissingRoles.some(role => {
      const roleLower = role.toLowerCase();
      const userRoleLower = user.primaryRole!.toLowerCase();

      return (
        userRoleLower.includes(roleLower) ||
        roleLower.includes(userRoleLower)
      );
    });
  });

  // ✅ If no role matches found, fallback to all users
  const candidateUsers =
    roleMatchedUsers.length > 0 ? roleMatchedUsers : availableUsers;

  /* -----------------------------
   * 3️⃣ Score candidates
   * ----------------------------- */
  const scoredUsers = candidateUsers.map(user => {
    let score = 0;

    const userRole = user.primaryRole?.toLowerCase() || "";

    // Role match (highest weight)
    prioritizedMissingRoles.forEach(role => {
      const roleLower = role.toLowerCase();
      if (userRole.includes(roleLower) || roleLower.includes(userRole)) {
        score += 10;
      }
    });

    // Skill match (medium weight)
    if (user.skills) {
      user.skills.forEach(skill => {
        const skillName = skill.name.toLowerCase();

        if (teamDesc.includes(skillName)) {
          score += 5;
        }
      });
    }

    // Bio match (low weight)
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

  /* -----------------------------
   * 4️⃣ Pick top 3
   * ----------------------------- */
  const recommendedUsers = scoredUsers
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      // if same score, randomize to avoid same repeated users
      return Math.random() - 0.5;
    })
    .slice(0, 3)
    .map(item => ({
      user: item.user,
      reason: `Recommended because your team needs ${item.user.primaryRole || "this role"}. Skills: ${
        item.user.skills?.slice(0, 3).map(s => s.name).join(", ") ||
        "various technologies"
      }.`
    }));

  /* -----------------------------
   * 5️⃣ Build explanation
   * ----------------------------- */
  let explanation = "Based on your team composition, ";

  if (prioritizedMissingRoles.length > 0) {
    explanation += `we recommend adding ${prioritizedMissingRoles.join(
      ", "
    )} to balance the team.`;
  } else {
    explanation += "your team already looks balanced.";
  }

  if (teamDesc.includes("ai") || teamDesc.includes("ml")) {
    explanation += " Since your project involves AI/ML, technical expertise is important.";
  }

  if (teamDesc.includes("mobile") || teamDesc.includes("app")) {
    explanation += " A Mobile Developer would be valuable.";
  }

  if (teamDesc.includes("design") || teamDesc.includes("ux")) {
    explanation += " Strong UI/UX will improve user experience.";
  }

  return {
    missingRoles: prioritizedMissingRoles,
    recommendedUsers,
    explanation
  };
}
