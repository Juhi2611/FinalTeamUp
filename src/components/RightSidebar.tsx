import { useState, useEffect } from 'react';
import { Flame, Users, Trophy, Loader2, ChevronRight, TrendingUp, Sparkles, Star } from 'lucide-react';
import { getSkillClass } from '../data/mockData';
import {
  getAvailableUsers,
  subscribeToAvailableTeams,
  getAvailableUsersCount,
  getAvailableTeamsCount,
  UserProfile,
  Team
} from '../services/firestore';
import { isFirebaseConfigured } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '@/lib/utils';

interface RightSidebarProps {
  onViewProfile: (userId: string) => void;
  onNavigate?: (page: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const RightSidebar = ({ onViewProfile, onNavigate, collapsed = false, onToggleCollapse }: RightSidebarProps) => {
  const { user } = useAuth();
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableUsersCount, setAvailableUsersCount] = useState(0);
  const [availableTeamsCount, setAvailableTeamsCount] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) {
      setLoading(false);
      return;
    }

    loadData();

    const unsubscribe = subscribeToAvailableTeams((teams) => {
      setAvailableTeams(teams.slice(0, 5));
      setAvailableTeamsCount(teams.length);
    });

    return () => unsubscribe();
  }, [user]);

  const loadData = async () => {
    try {
      const [available, usersCount, teamsCount] = await Promise.all([
        getAvailableUsers(user?.uid),
        getAvailableUsersCount(),
        getAvailableTeamsCount()
      ]);

      const shuffled = available.sort(() => 0.5 - Math.random());
      setSuggestedUsers(shuffled.slice(0, 4));
      setAvailableUsersCount(usersCount);
      setAvailableTeamsCount(teamsCount);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  // Collapsed view
  if (collapsed) {
    return (
      <aside className="flex-shrink-0 w-16 transition-all duration-300">
        <div className="space-y-3 pb-4">
          <div className="card-base p-2 flex flex-col items-center gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10" title="Teams">
              <Flame className="w-4 h-4 text-primary" />
            </div>
            <div className="p-1.5 rounded-lg bg-primary/10" title="Teammates">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="p-1.5 rounded-lg bg-accent/10" title="Rankings">
              <Trophy className="w-4 h-4 text-accent" />
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const getRankBadge = (index: number) => {
    const badges = ['badge-trending', 'badge-new', 'badge-funded', 'badge-new', 'badge-funded'];
    const labels = ['Trending', 'New', 'Funded', 'New', 'Funded'];
    const icons = ['🔥', '✨', '💚', '✨', '💚'];
    return { className: badges[index] || 'badge-new', label: labels[index] || 'New', icon: icons[index] || '✨' };
  };

  return (
    <aside className="flex-shrink-0 w-72 transition-all duration-300 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin">
      <div className="space-y-4 pb-4">

        {/* ──── Recommended Teams ──── */}
        <div id="tour-right-teams" className="sidebar-section">
          <div className="sidebar-section-header">
            <div className="sidebar-section-title">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>Recommended Teams</span>
            </div>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <MoreHorizontalIcon />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : availableTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No teams forming right now
            </p>
          ) : (
            <div className="space-y-3">
              {availableTeams.slice(0, 3).map((team) => (
                <div
                  key={team.id}
                  className="flex items-center gap-3 group cursor-pointer"
                  onClick={() => onNavigate?.('discover-teams')}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 border border-primary/10">
                    <span className="text-lg font-bold text-primary">{team.name?.charAt(0) || 'T'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {team.name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3 h-3 text-primary fill-primary/30" />
                      <span className="text-xs text-muted-foreground">
                        {team.members?.length || 0}/{team.maxMembers} members
                      </span>
                    </div>
                  </div>
                  <button className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5">
                    Join <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ──── Active Teammates ──── */}
        <div id="tour-right-teammates" className="sidebar-section">
          <div className="sidebar-section-header">
            <div className="sidebar-section-title">
              <Users className="w-4 h-4 text-primary" />
              <span>Active Teammates</span>
            </div>
            <button
              onClick={() => onNavigate?.('discover')}
              className="sidebar-link"
            >
              View all
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : suggestedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No available users yet
            </p>
          ) : (
            <div className="space-y-3">
              {suggestedUsers.map((u, index) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => onViewProfile(u.id)}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={u.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.fullName || 'User')}`}
                      alt={u.fullName}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <span className={cn(
                      "absolute -bottom-0.5 -right-0.5 status-dot",
                      index < 2 ? "status-online" : "status-away"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {u.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {index < 2 ? 'Online' : `${Math.floor(Math.random() * 10 + 1)} min`}
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    index < 2 ? "text-emerald-500" : "text-muted-foreground"
                  )}>
                    {index < 2 ? '● Online' : `● ${Math.floor(Math.random() * 10 + 1)} min`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ──── Daily Top 5 Teams ──── */}
        <div id="tour-right-stats" className="sidebar-section">
          <div className="sidebar-section-header">
            <div className="sidebar-section-title">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Daily Top 5 Teams</span>
            </div>
            <button
              onClick={() => onNavigate?.('discover-teams')}
              className="sidebar-link"
            >
              View all
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : availableTeams.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No teams ranked yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableTeams.slice(0, 5).map((team, index) => {
                const badge = getRankBadge(index);
                return (
                  <div
                    key={team.id}
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => onNavigate?.('discover-teams')}
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {team.name}
                      </p>
                    </div>
                    <span className={badge.className}>
                      {badge.icon} {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </aside>
  );
};

// Simple horizontal dots icon
function MoreHorizontalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13" cy="8" r="1.5" />
    </svg>
  );
}

export default RightSidebar;