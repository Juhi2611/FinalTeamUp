import type { UserProfile, Team } from "@/types/firestore.types";

interface TeamRecommendation {
  missingRoles: string[];
  recommendedUsers: {
    user: UserProfile;
    reason: string;
  }[];
  explanation: string;
}

/* --------------------------------------------------
 * ROLE NORMALIZATION & ALIASES
 * -------------------------------------------------- */
const ROLE_ALIASES: Record<string, string[]> = {
  "Frontend Developer": ["frontend", "react", "ui"],
  "Backend Developer": ["backend", "api", "server"],
  "Full Stack Developer": ["full stack", "frontend", "backend"],
  "UI/UX Designer": ["ui", "ux", "design", "presentation"],
  "Tester": ["qa", "testing"],
  "ML Engineer": ["ml", "machine learning", "ai", "data"],
  "Data Scientist": ["data", "ml", "machine learning"],
  "Mobile Developer": ["mobile", "android", "ios"],
  "DevOps Engineer": ["devops", "cloud", "aws", "docker"],
  "Product Manager": ["product", "pm", "management"]
};

const normalize = (val: string) => val.toLowerCase().trim();

const rolesMatch = (userRole: string, neededRole: string): boolean => {
  const user = normalize(userRole);
  const needed = normalize(neededRole);

  if (user.includes(needed) || needed.includes(user)) return true;

  const aliases = ROLE_ALIASES[neededRole] || [];
  return aliases.some(alias => user.includes(alias));
};

/* --------------------------------------------------
 * MAIN ENTRY
 * -------------------------------------------------- */
export const getTeamRecommendations = async (
  team: Team,
  currentMembers: { role: string; userId?: string }[],
  availableUsers: UserProfile[]
): Promise<TeamRecommendation> => {
  try {
    const currentRoles = currentMembers.map(m => m.role);

    // Exclude already joined users
    const currentMemberIds = new Set(
      currentMembers.map(m => m.userId).filter(Boolean)
    );

    const filteredUsers = availableUsers.filter(
      u => !currentMemberIds.has(u.id)
    );

    return buildRecommendation(team, currentRoles, filteredUsers);
  } catch (error) {
    console.error("Error getting recommendations:", error);
    return buildRecommendation(team, [], availableUsers);
  }
};

/* --------------------------------------------------
 * CORE LOGIC
 * -------------------------------------------------- */
function buildRecommendation(
  team: Team,
  currentRoles: string[],
  users: UserProfile[]
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

  /* 1️⃣ Missing roles */
  const normalizedCurrent = currentRoles.map(r => normalize(r));

  const inferredMissingRoles = ALL_ROLES.filter(role =>
    !normalizedCurrent.some(cr => cr.includes(normalize(role)))
  );

  const prioritizedMissingRoles = team.rolesNeeded?.length
    ? Array.from(new Set([...team.rolesNeeded, ...inferredMissingRoles])).slice(0, 3)
    : inferredMissingRoles.slice(0, 3);

  const teamDesc = normalize(team.description || "");

  /* 2️⃣ HARD FILTER: role-based */
  const roleMatchedUsers = users.filter(user =>
    user.primaryRole &&
    prioritizedMissingRoles.some(role =>
      rolesMatch(user.primaryRole!, role)
    )
  );

  const candidateUsers =
    roleMatchedUsers.length > 0 ? roleMatchedUsers : users;

  /* 3️⃣ SCORING */
  const scoredUsers = candidateUsers.map(user => {
    let score = 0;

    // Role match (strongest)
    prioritizedMissingRoles.forEach(role => {
      if (user.primaryRole && rolesMatch(user.primaryRole, role)) {
        score += 10;
      }
    });

    // Skills relevance
    user.skills?.forEach(skill => {
      if (teamDesc.includes(normalize(skill.name))) {
        score += 5;
      }
    });

    // Bio relevance
    if (user.bio) {
      teamDesc.split(/\s+/).forEach(word => {
        if (word.length > 4 && normalize(user.bio!).includes(word)) {
          score += 1;
        }
      });
    }

    return { user, score };
  });

  /* 4️⃣ PICK TOP 3 (randomize ties) */
  const recommendedUsers = scoredUsers
    .filter(u => u.score > 0)
    .sort((a, b) =>
      b.score !== a.score ? b.score - a.score : Math.random() - 0.5
    )
    .slice(0, 3)
    .map(({ user }) => ({
      user,
      reason: `Matches your team's need for ${user.primaryRole || "this role"}. Skills: ${
        user.skills?.slice(0, 3).map(s => s.name).join(", ") ||
        "skills not added yet"
      }.`
    }));

  /* 5️⃣ EXPLANATION */
  let explanation = "Based on your team composition, ";

  if (prioritizedMissingRoles.length > 0) {
    explanation += `we recommend adding ${prioritizedMissingRoles.join(", ")}.`;
  } else {
    explanation += "your team already looks balanced.";
  }

  return {
    missingRoles: prioritizedMissingRoles,
    recommendedUsers,
    explanation
  };
}
