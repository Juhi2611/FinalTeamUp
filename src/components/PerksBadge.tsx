import { Sparkles } from 'lucide-react';
import { getPerkRank, PERK_RANKS } from '@/types/firestore.types';
import type { PerkRankInfo } from '@/types/firestore.types';

// ─── Header Badge ────────────────────────────────────────────────

interface PerksBadgeProps {
  perks?: number;
  totalPerksEarned?: number;
  onClick?: () => void;
}

export const PerksBadge = ({ perks = 0, totalPerksEarned = 0, onClick }: PerksBadgeProps) => {
  const rankInfo: PerkRankInfo = getPerkRank(totalPerksEarned);

  return (
    <button
      onClick={onClick}
      title={`${rankInfo.emoji} ${rankInfo.rank} · ${perks} Perks spendable`}
      className={`
        flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold
        transition-all hover:scale-105 active:scale-95 shadow-sm
        ${rankInfo.bg} ${rankInfo.border} ${rankInfo.color}
      `}
    >
      <Sparkles className="w-3.5 h-3.5" />
      <span>{perks.toLocaleString()}</span>
    </button>
  );
};

// ─── Rank Chip (for cards / sidebars) ────────────────────────────

interface PerkRankBadgeProps {
  totalPerksEarned?: number;
  size?: 'sm' | 'md';
}

export const PerkRankBadge = ({ totalPerksEarned = 0, size = 'sm' }: PerkRankBadgeProps) => {
  const rankInfo = getPerkRank(totalPerksEarned);
  const isSm = size === 'sm';

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider
        ${isSm ? 'text-[9px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1'}
        ${rankInfo.bg} ${rankInfo.border} ${rankInfo.color}
      `}
    >
      <span className="mr-0.5">{rankInfo.emoji}</span>
      <span>{rankInfo.rank}</span>
    </span>
  );
};

// ─── Progress bar toward next rank ───────────────────────────────

interface PerkProgressProps {
  totalPerksEarned: number;
}

export const PerkProgress = ({ totalPerksEarned }: PerkProgressProps) => {
  const currentRank = getPerkRank(totalPerksEarned);
  const currentIndex = PERK_RANKS.findIndex(r => r.rank === currentRank.rank);
  const nextRank = PERK_RANKS[currentIndex + 1];

  if (!nextRank) {
    return (
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
        <span>{currentRank.emoji}</span>
        Max rank — <span className={currentRank.color}>Legend</span>
      </div>
    );
  }

  // Calculate progress within the current stage range
  const range = nextRank.minPerks - currentRank.minPerks;
  const progressInStage = totalPerksEarned - currentRank.minPerks;
  const progressPercent = Math.min(Math.max((progressInStage / range) * 100, 2), 100);

  // Mapping Rank names to actual Tailwind classes so the line is visible
  const fillColors: Record<string, string> = {
    Pioneer: 'bg-slate-400',
    Contributor: 'bg-emerald-500',
    Builder: 'bg-blue-500',
    Elite: 'bg-amber-500',
    Legend: 'bg-rose-500'
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
        <span className={currentRank.color}>{currentRank.emoji} {currentRank.rank}</span>
        <span>→ {nextRank.emoji} {nextRank.rank} <span className="ml-1 opacity-60">({nextRank.minPerks - totalPerksEarned} pts)</span></span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary border border-border/10 overflow-hidden shadow-inner">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out shadow-sm ${fillColors[currentRank.rank]}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};