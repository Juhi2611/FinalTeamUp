import { Home, Users, UserPlus, FolderKanban, User, Bell, Sparkles, Crown, Search, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { UserProfile } from '../services/firestore';
import { cn } from '@/lib/utils';

interface LeftSidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userProfile?: UserProfile | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const LeftSidebar = ({ currentPage, onNavigate, userProfile, collapsed = false, onToggleCollapse }: LeftSidebarProps) => {
  const navItems = [
    { id: 'feed', label: 'Home Feed', icon: Home },
    { id: 'discover', label: 'Discover People', icon: Users },
    { id: 'discover-teams', label: 'Discover Teams', icon: Search },
    { id: 'build', label: 'Build a Team', icon: UserPlus },
    { id: 'teams', label: 'My Teams', icon: FolderKanban },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'profile', label: 'My Profile', icon: User },
  ];

  const displayName = userProfile?.fullName || 'User';
  const displayRole = userProfile?.primaryRole || 'Team Member';
  const displayAvatar = userProfile?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`;

  return (
    <aside className={cn(
      "flex-shrink-0 transition-all duration-300 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
      collapsed ? "w-16" : "w-72"
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
            {collapsed ? "->" : "<-"}
          </button>
        )}

        {/* Profile Card */}
        <div className="card-base overflow-hidden">
          <div className={cn("bg-gradient-to-r from-primary to-primary/80", collapsed ? "h-8" : "h-16")} />
          <div className={cn("px-4 pb-4", collapsed && "px-2 pb-2")}>
            <div className={cn("-mt-8 flex flex-col items-center", collapsed && "-mt-4")}>
              <img 
                src={
                  userProfile?.avatar
                    ? `${userProfile.avatar}?t=${Date.now()}`
                    : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        userProfile?.fullName || 'User'
                      )}`
                }
                alt={displayName} 
                className={cn(
                  "avatar border-4 border-card transition-all",
                  collapsed ? "w-10 h-10" : "w-16 h-16"
                )} 
              />
              {!collapsed && (
                <>
                  <h3 className="mt-2 font-display font-bold text-foreground">{displayName}</h3>
                  <p className="text-sm text-muted-foreground">{displayRole}</p>
                  {userProfile?.isTeamLeader ? (
                    <div className="mt-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                      <Crown className="w-3 h-3" />
                      <span>Team Leader</span>
                    </div>
                  ) : userProfile?.teamId ? (
                    <div className="mt-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      <FolderKanban className="w-3 h-3" />
                      <span>In a Team</span>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-1 ai-badge">
                      <Sparkles className="w-3 h-3" />
                      <span>Available</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn("card-base", collapsed ? "p-1" : "p-2")}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "nav-item w-full",
                currentPage === item.id && 'nav-item-active',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Quote */}
        {!collapsed && (
          <div className="card-base p-4">
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              "Teams fail because of poor composition, not poor ideas."
            </p>
            <p className="mt-2 text-xs text-primary font-medium">— TeamUp Philosophy</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default LeftSidebar;