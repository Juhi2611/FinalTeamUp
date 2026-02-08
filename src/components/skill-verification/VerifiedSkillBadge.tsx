// Verified Skill Badge Components
// Display skills with verification status
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  VerifiedSkillBadgeProps, 
  VerifiedSkillsListProps 
} from '@/types/skillVerification.types';
// Single skill badge with optional verification icon
export function VerifiedSkillBadge({ 
  skill, 
  isVerified, 
  showIcon = true 
}: VerifiedSkillBadgeProps) {
  return (
    <Badge
      variant={isVerified ? "default" : "secondary"}
      className={cn(
        "gap-1 transition-all",
        isVerified && "bg-teal-500/10 text-teal-600 border-teal-500/30 hover:bg-teal-500/20 dark:text-teal-400"
      )}
    >
      {isVerified && showIcon && (
        <ShieldCheck className="h-3 w-3" />
      )}
      {skill}
    </Badge>
  );
}
// List of skills with verified ones highlighted and sorted first
export function VerifiedSkillsList({ 
  skills, 
  verifiedSkills, 
  showVerifiedFirst = true 
}: VerifiedSkillsListProps) {
  // Create a set of verified skills for quick lookup (case-insensitive)
  const verifiedSet = new Set(
    verifiedSkills.map(s => s.toLowerCase().trim())
  );
  
  // Check if a skill is verified
  const isSkillVerified = (skill: string): boolean => {
    return verifiedSet.has(skill.toLowerCase().trim());
  };
  
  // Sort skills: verified first if enabled
  const sortedSkills = showVerifiedFirst
    ? [...skills].sort((a, b) => {
        const aVerified = isSkillVerified(a);
        const bVerified = isSkillVerified(b);
        if (aVerified && !bVerified) return -1;
        if (!aVerified && bVerified) return 1;
        return 0;
      })
    : skills;
  
  return (
    <div className="flex flex-wrap gap-2">
      {sortedSkills.map((skill, index) => (
        <VerifiedSkillBadge
          key={`${skill}-${index}`}
          skill={skill}
          isVerified={isSkillVerified(skill)}
        />
      ))}
    </div>
  );
}
// Compact verification summary badge
export function VerificationSummaryBadge({ 
  verifiedCount, 
  totalCount,
  className,
}: { 
  verifiedCount: number; 
  totalCount: number;
  className?: string;
}) {
  if (verifiedCount === 0) return null;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1 bg-teal-500/10 text-teal-600 border-teal-500/30 dark:text-teal-400",
        className
      )}
    >
      <ShieldCheck className="h-3 w-3" />
      {verifiedCount} of {totalCount} verified
    </Badge>
  );
}
// "Skills Verified" badge for profile header
export function SkillsVerifiedBadge({ 
  className 
}: { 
  className?: string;
}) {
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1 bg-teal-500/10 text-teal-600 border-teal-500/30 dark:text-teal-400",
        className
      )}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      Skills Verified
    </Badge>
  );
}
export default VerifiedSkillBadge;