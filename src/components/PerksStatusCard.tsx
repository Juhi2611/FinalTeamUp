/**
 * PerksStatusCard.tsx
 * ───────────────────
 * Displayed at the very top of the Home feed (before "Create Post").
 * Shows the user's Perk balance, current rank, progress to next rank,
 * and whether the join fee applies.
 *
 * Usage in HomeFeed / Index:
 *   <PerksStatusCard profile={profile} onViewLeaderboard={() => handleNavigate('leaderboard')} />
 */

import { Sparkles, Trophy, Zap } from 'lucide-react';
import { getPerkRank, getJoinFee, JOIN_FEE_THRESHOLD } from '@/types/firestore.types';
import type { UserProfile } from '@/types/firestore.types';
import { PerkProgress } from './PerksBadge';

interface PerksStatusCardProps {
  profile: UserProfile | null;
  onViewLeaderboard?: () => void;
}

const PerksStatusCard = ({ profile, onViewLeaderboard }: PerksStatusCardProps) => {
  if (!profile) return null;

  const totalEarned = profile.totalPerksEarned ?? 0;
  const balance = profile.perks ?? 0;
  const rankInfo = getPerkRank(totalEarned);
  const fee = getJoinFee(totalEarned);
  const isPioneer = totalEarned < JOIN_FEE_THRESHOLD;

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
              {isPioneer && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 border border-green-200 text-green-700 font-semibold">
                  FREE JOIN
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mt-0.5">
              <Sparkles className="w-3 h-3" />
              <span><span className="font-semibold text-foreground">{balance.toLocaleString()}</span> Perks available</span>
              {totalEarned !== balance && (
                <span className="text-muted-foreground/60">· {totalEarned.toLocaleString()} earned total</span>
              )}
            </div>
          </div>
        </div>

        {/* Right — join fee info + leaderboard button */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="text-right hidden sm:block">
            {isPioneer ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-green-600">Pioneer phase</span> — join teams for free!
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Join fee: <span className="font-semibold text-foreground">{fee} Perks</span> per request
              </p>
            )}
          </div>
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
    </div>
  );
};

export default PerksStatusCard;