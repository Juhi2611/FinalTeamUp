/**
 * PerksStatusCard.tsx
 * ───────────────────
 * Displayed at the top of the Home feed.
 * Shows the user's perk balance, rank, progress to next rank,
 * join/create costs, and an expandable transaction history.
 */

import { useState } from 'react';
import { Sparkles, Trophy, History, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import {
  getPerkRank,
  TEAM_JOIN_COST,
  TEAM_CREATE_COST,
} from '@/types/firestore.types';
import type { UserProfile } from '@/types/firestore.types';
import { PerkProgress } from './PerksBadge';
import { PerkTransactionLog } from './PerkTransactionLog';

interface PerksStatusCardProps {
  profile: UserProfile | null;
  onViewLeaderboard?: () => void;
}

const PerksStatusCard = ({ profile, onViewLeaderboard }: PerksStatusCardProps) => {
  const [showHistory, setShowHistory] = useState(false);

  if (!profile) return null;

  const totalEarned = profile.totalPerksEarned ?? 0;
  const balance     = profile.perks ?? 0;
  const rankInfo    = getPerkRank(totalEarned);

  return (
    <div className={`card-base p-4 border ${rankInfo.border} relative overflow-hidden`}>
      {/* Background glow */}
      <div className={`absolute inset-0 ${rankInfo.bg} opacity-30 pointer-events-none`} />

      <div className="relative flex items-center justify-between gap-4 flex-wrap">
        {/* Left — rank + balance */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${rankInfo.bg} border ${rankInfo.border}`}>
            {rankInfo.emoji}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-bold ${rankInfo.color}`}>{rankInfo.rank}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mt-0.5">
              <Sparkles className="w-3 h-3" />
              <span>
                <span className="font-semibold text-foreground">{balance.toLocaleString()}</span> Perks available
              </span>
              {totalEarned !== balance && (
                <span className="text-muted-foreground/60">· {totalEarned.toLocaleString()} earned total</span>
              )}
            </div>
          </div>
        </div>

        {/* Right — costs + buttons */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Cost info chips */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[10px] bg-amber-50 border border-amber-200 text-amber-700 font-semibold px-2 py-1 rounded-full">
              <Zap className="w-2.5 h-2.5" />Join: {TEAM_JOIN_COST} pts
            </span>
            <span className="flex items-center gap-1 text-[10px] bg-amber-50 border border-amber-200 text-amber-700 font-semibold px-2 py-1 rounded-full">
              <Zap className="w-2.5 h-2.5" />Create: {TEAM_CREATE_COST} pts
            </span>
          </div>

          {/* History toggle */}
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-foreground"
          >
            <History className="w-3.5 h-3.5" />
            History
            {showHistory
              ? <ChevronUp className="w-3 h-3 opacity-60" />
              : <ChevronDown className="w-3 h-3 opacity-60" />
            }
          </button>

          {/* Leaderboard */}
          {onViewLeaderboard && (
            <button
              onClick={onViewLeaderboard}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-foreground"
            >
              <Trophy className="w-3.5 h-3.5" />
              Leaderboard
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mt-3">
        <PerkProgress totalPerksEarned={totalEarned} />
      </div>

      {/* Expandable Transaction History */}
      {showHistory && profile.id && (
        <div className="relative mt-4 pt-4 border-t border-border/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Perk History
          </p>
          <PerkTransactionLog userId={profile.id} maxItems={15} />
        </div>
      )}
    </div>
  );
};

export default PerksStatusCard;