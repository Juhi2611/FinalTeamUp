/**
 * LeaderboardPage.tsx
 * ────────────────────
 * Wrapper page with two top-level tabs:
 *   • Leaderboard  — Global Top-50 + optional Team leaderboard
 *   • Perk Shop    — Referral codes, rank ladder & ways to earn
 *
 * Props:
 *   currentUserId  — to highlight the logged-in user's row
 *   userProfile    — full profile of the current user (for Perk Shop)
 *   teamId         — optional; shows the Team sub-tab by default
 *   teamMemberIds  — member user IDs for the team leaderboard
 *   onProfileRefresh — callback to refresh parent profile after referral
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Sparkles, Users, Globe, Loader2, Medal, ShoppingBag
} from 'lucide-react';
import { getGlobalLeaderboard, getTeamLeaderboard } from '@/services/perksService';
import type { LeaderboardEntry } from '@/types/firestore.types';
import PerkShopPage from './PerkShopPage';
import type { UserProfile } from '@/types/firestore.types';

interface LeaderboardPageProps {
  currentUserId?: string;
  userProfile?: UserProfile | null;
  teamId?: string;
  teamName?: string;
  teamMemberIds?: string[];
  onProfileRefresh?: () => void;
}

type TopTab = 'leaderboard' | 'perkshop';
type SubTab = 'global' | 'team';

const PositionIcon = ({ position }: { position: number }) => {
  if (position === 1) return <span className="text-yellow-500 text-lg">🥇</span>;
  if (position === 2) return <span className="text-slate-400 text-lg">🥈</span>;
  if (position === 3) return <span className="text-amber-600 text-lg">🥉</span>;
  return (
    <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
      {position}
    </span>
  );
};

const LeaderboardRow = ({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}) => (
  <div
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
      isCurrentUser
        ? 'bg-primary/10 border border-primary/30'
        : 'hover:bg-secondary/60'
    }`}
  >
    {/* Position */}
    <div className="w-8 flex justify-center shrink-0">
      <PositionIcon position={entry.position} />
    </div>

    {/* Avatar */}
    <img
      src={
        entry.avatar
          ? `${entry.avatar}?t=1`
          : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(entry.fullName)}`
      }
      alt={entry.fullName}
      className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
    />

    {/* Name + role */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-semibold text-sm text-foreground truncate">
          {entry.fullName}
        </span>
        {isCurrentUser && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
            You
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${entry.rank.bg} ${entry.rank.border} ${entry.rank.color}`}
        >
          {entry.rank.emoji} {entry.rank.rank}
        </span>
        {entry.primaryRole && (
          <span className="text-[10px] text-muted-foreground truncate">{entry.primaryRole}</span>
        )}
      </div>
    </div>

    {/* Perks */}
    <div className="text-right shrink-0">
      <div className="flex items-center gap-1 justify-end">
        <Sparkles className={`w-3.5 h-3.5 ${entry.rank.color}`} />
        <span className="font-bold text-sm text-foreground">
          {entry.totalPerksEarned.toLocaleString()}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">total earned</p>
    </div>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────

const LeaderboardPage = ({
  currentUserId,
  userProfile,
  teamId,
  teamName,
  teamMemberIds = [],
  onProfileRefresh,
}: LeaderboardPageProps) => {
  const [topTab, setTopTab] = useState<TopTab>('leaderboard');
  const [subTab, setSubTab] = useState<SubTab>(teamId ? 'team' : 'global');
  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntry[]>([]);
  const [teamEntries, setTeamEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    if (topTab === 'leaderboard' && subTab === 'global' && globalEntries.length === 0) {
      setLoadingGlobal(true);
      getGlobalLeaderboard()
        .then(setGlobalEntries)
        .finally(() => setLoadingGlobal(false));
    }
  }, [topTab, subTab]);

  useEffect(() => {
    if (topTab === 'leaderboard' && subTab === 'team' && teamMemberIds.length > 0 && teamEntries.length === 0) {
      setLoadingTeam(true);
      getTeamLeaderboard(teamMemberIds)
        .then(setTeamEntries)
        .finally(() => setLoadingTeam(false));
    }
  }, [topTab, subTab, teamMemberIds]);

  const entries = subTab === 'global' ? globalEntries : teamEntries;
  const loading = subTab === 'global' ? loadingGlobal : loadingTeam;

  return (
    <div className="space-y-5">
      {/* ── Top-level Tab Switcher ── */}
      <div className="card-base p-1.5 flex gap-1">
        <button
          id="tab-leaderboard"
          onClick={() => setTopTab('leaderboard')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
            topTab === 'leaderboard'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Leaderboard
        </button>
        <button
          id="tour-leaderboard-shop"
          onClick={() => setTopTab('perkshop')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
            topTab === 'perkshop'
              ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Perk Shop
        </button>
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {topTab === 'leaderboard' ? (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Header */}
            <div className="card-base p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-amber-100 border border-amber-200">
                  <Trophy className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h1 className="font-display font-bold text-2xl text-foreground">Leaderboard</h1>
                  <p className="text-muted-foreground text-sm">Ranked by lifetime Perks earned</p>
                </div>
              </div>

              {/* Sub-Tabs (Global / Team) */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSubTab('global')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    subTab === 'global'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                  }`}
                >
                  <Globe className="w-4 h-4" /> Global Top 50
                </button>
                {teamId && (
                  <button
                    onClick={() => setSubTab('team')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      subTab === 'team'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    <Users className="w-4 h-4" /> {teamName ?? 'Team'}
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div id="tour-leaderboard-list" className="card-base p-4">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Medal className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No data yet — complete tasks to earn Perks!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {entries.map((entry) => (
                    <LeaderboardRow
                      key={entry.userId}
                      entry={entry}
                      isCurrentUser={entry.userId === currentUserId}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="perkshop"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <PerkShopPage
              userProfile={userProfile}
              onProfileRefresh={onProfileRefresh}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeaderboardPage;