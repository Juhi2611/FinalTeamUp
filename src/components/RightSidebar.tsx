import { useState, useEffect } from 'react';
import { Sparkles, Users, Zap, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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
    
    // Subscribe to available teams
    const unsubscribe = subscribeToAvailableTeams((teams) => {
      setAvailableTeams(teams.slice(0, 3)); // Show top 3
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
      
      // Get top 3 random available users as suggestions
      const shuffled = available.sort(() => 0.5 - Math.random());
      setSuggestedUsers(shuffled.slice(0, 3));
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
      <aside className={cn(
      "flex-shrink-0 transition-all duration-300 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
      collapsed ? "w-16" : "w-80"
    )}>
        <div className="space-y-4 pb-4">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center p-4 rounded-lg transition-all duration-300 sticky top-0 z-10
              bg-white border border-gray-300 text-gray-700 hover:bg-gray-50
              shadow-sm text-2xl font-bold"
              title="Expand sidebar"
            >
              &lt;-
            </button>
          )}

          
          <div className="card-base p-2 flex flex-col items-center gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10" title="AI Matches">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="p-1.5 rounded-lg bg-accent/10" title="Teams">
              <Users className="w-4 h-4 text-accent" />
            </div>
            <div className="p-1.5 rounded-lg bg-secondary" title="Stats">
              <Zap className="w-4 h-4 text-accent" />
            </div>
          </div>

          <div className="card-base p-2 text-center">
            <p className="text-lg font-bold text-primary">{availableUsersCount}</p>
            <p className="text-lg font-bold text-accent">{availableTeamsCount}</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className={cn(
      "flex-shrink-0 transition-all duration-300 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
      collapsed ? "w-16" : "w-80"
    )}>
      <div className="space-y-4 pb-4">
        {/* Collapse Toggle Button */}
        {onToggleCollapse && (
            <button
            onClick={onToggleCollapse}
            className={cn(
              "w-full flex items-center justify-center p-4 rounded-lg transition-all duration-200 sticky top-0 z-10",
              "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
              "shadow-sm text-2xl font-bold"
            )}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
            {collapsed ? "<-" : "->"}
            </button>
        )}

        {/* AI Recommendations */}
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <h3 className="section-title text-sm">AI-Powered Matches</h3>
          </div>
          <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-primary">Pro tip:</span> Create a team and use AI Suggestions to find the best matches for your project!
            </p>
          </div>
        </div>

        {/* Suggested Teammates */}
        <div className="card-base p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title text-sm">Available Teammates</h3>
            <span className="text-xs text-muted-foreground">Real-time</span>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : suggestedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No available users yet
            </p>
          ) : (
            <div className="space-y-3">
              {suggestedUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => onViewProfile(u.id)}
                >
                  <img
                    src={u.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.fullName || 'User')}`}
                    alt={u.fullName}
                    className="avatar w-10 h-10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {u.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.primaryRole}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {u.skills?.slice(0, 2).map((skill) => (
                        <span
                          key={skill.name}
                          className={`skill-tag text-[10px] ${getSkillClass(skill.name)}`}
                        >
                          {skill.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {availableUsersCount > suggestedUsers.length && (
                <button
                  onClick={() => onNavigate?.('discover')}
                  className="w-full text-xs text-primary text-primary hover:underline text-center mt-2"
                >
                  View all teammates →
                </button>
              )}
            </div>
          )}
        </div>
        

        {/* Available Teams */}
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-accent" />
            <h3 className="section-title text-sm">Available Teams</h3>
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
              {availableTeams.map((team) => (
                <div 
                  key={team.id} 
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => onNavigate?.('discover-teams')}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground truncate">{team.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      by {team.leaderName || 'Unknown'}
                    </p>
                  </div>
                  <span className="text-xs text-primary font-medium whitespace-nowrap ml-2">
                    {team.members?.length || 0}/{team.maxMembers}
                  </span>
                </div>
              ))}
              {availableTeams.length >= 3 && (
                <button 
                  onClick={() => onNavigate?.('discover-teams')}
                  className="w-full text-xs text-primary hover:underline text-center mt-2"
                >
                  View all teams →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Platform Stats */}
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-accent" />
            <h3 className="section-title text-sm">Platform Stats</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-lg bg-secondary/50">
              <p className="text-2xl font-bold text-primary">{availableUsersCount}</p>
              <p className="text-xs text-muted-foreground">Active Users</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary/50">
              <p className="text-2xl font-bold text-accent">{availableTeamsCount}</p>
              <p className="text-xs text-muted-foreground">Available Teams</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default RightSidebar;