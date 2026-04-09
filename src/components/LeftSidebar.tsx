import { Home, Users, Search, FolderKanban, MessageCircle, Bell, Video } from 'lucide-react';
import { UserProfile } from '../services/firestore';
import { cn } from '@/lib/utils';
import { useActivityHeatmap } from '@/hooks/useActivityHeatmap';

interface LeftSidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userProfile?: UserProfile | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/* ─── Compact Activity Heatmap ─── */
function ActivityHeatmap({ userId }: { userId?: string }) {
  const { cells, loading } = useActivityHeatmap(userId);

  const colors = [
    'bg-muted/60',
    'bg-primary/20',
    'bg-primary/40',
    'bg-primary/60',
    'bg-primary',
  ];

  // 1. Generate Dynamic Month Labels for the X-axis
  const getMonthLabels = () => {
    const labels = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (2 - i), 1);
      labels.push(d.toLocaleString('default', { month: 'short' }));
    }
    return labels;
  };

  if (loading) return <div className="text-[10px] animate-pulse">Loading Activity...</div>;

  return (
    <div className="space-y-2">
      {/* X-AXIS: Dynamic Months */}
      <div className="flex justify-between px-7 text-[9px] font-medium text-muted-foreground/60 -mt-1">
        {getMonthLabels().map((month) => (
          <span key={month}>{month}</span>
        ))}
      </div>

      <div className="flex gap-1.5">
        {/* Y-AXIS: Fixed Day Labels */}
        <div className="flex flex-col justify-between text-[8px] font-medium text-muted-foreground/40 leading-none py-0.5 -ml-3">
          <span style={{ transform: 'rotate(-90deg)' }}>Mon</span>
          <span style={{ transform: 'rotate(-90deg)' }}>Wed</span>
          <span style={{ transform: 'rotate(-90deg)' }}>Fri</span>
        </div>

        {/* THE GRID */}
        <div 
          className="grid gap-[2.5px] -ml-1 -mt-1" 
          style={{ 
            gridTemplateRows: 'repeat(7, 1fr)', 
            gridAutoFlow: 'column' 
          }}
        >
          {cells.map((level, i) => (
            <div
              key={i}
              className={cn(
                'w-[14px] h-[15px] rounded-[1.5px] transition-all duration-300 hover:ring-1 hover:ring-primary/50', 
                colors[level]
              )}
              title={`Level ${level} activity`}
            />
          ))}
        </div>
      </div>

      {/* FOOTER: Legend */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] text-muted-foreground/40 italic">90d scroll</span>
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-muted-foreground/50">Less</span>
          {colors.map((c, i) => (
            <div key={i} className={cn('w-2 h-2 rounded-[1px]', c)} />
          ))}
          <span className="text-[8px] text-muted-foreground/50">More</span>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const LeftSidebar = ({ currentPage, onNavigate, userProfile, collapsed = false }: LeftSidebarProps) => {
  const navItems = [
    { id: 'feed', label: 'Home', icon: Home },
    { id: 'discover', label: 'My Network', icon: Users },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'discover-teams', label: 'Discover Teams', icon: Search },
    { id: 'teams', label: 'My Teams', icon: FolderKanban },
    { id: 'interviews', label: 'Interviews', icon: Video },
  ];

  const displayName = userProfile?.fullName?.split(' ')[0] || 'User';
  const userId = (userProfile as any)?.id || undefined;

  if (collapsed) {
    return (
      <aside className="flex-shrink-0 w-14 h-[calc(100vh-5rem)] flex flex-col transition-all duration-300">
        <nav className="space-y-0.5 flex-1">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn('nav-item w-full justify-center px-2', isActive && 'nav-item-active')}
                title={item.label}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
              </button>
            );
          })}
        </nav>
      </aside>
    );
  }

  return (
    /* Fixed height, no overflow scroll */
    <aside className="flex-shrink-0 w-60 h-[calc(100vh-5rem)] flex flex-col transition-all duration-300 gap-2.5">

      {/* ── Greeting + Profile Card ── */}
      <div className="card-base px-3 py-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <img
            src={
              userProfile?.avatar
                ? `${userProfile.avatar}?t=${Date.now()}`
                : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`
            }
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/15 flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">{getGreeting()} 👋</p>
            <p className="text-sm font-bold text-foreground truncate leading-tight">{displayName}</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="sidebar-nav-box flex-shrink-0">
        <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-3 py-1.5">
          Menu · {navItems.length}
        </p>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                id={`tour-nav-${item.id}`}
                onClick={() => onNavigate(item.id)}
                className={cn('nav-item w-full group relative', isActive && 'nav-item-active')}
              >
                <item.icon className={cn(
                  'w-[18px] h-[18px] flex-shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )} />
                <span className={cn(
                  'text-[12px] transition-colors',
                  isActive ? 'text-primary font-semibold' : 'text-muted-foreground group-hover:text-foreground'
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Compact Activity Heatmap ── */}
      <div className="card-base px-3 py-2.5 flex-shrink-0">
        <ActivityHeatmap userId={userId} />
      </div>
    </aside>
  );
};

export default LeftSidebar;