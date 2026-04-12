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

// Each cell is 14px wide + 2.5px gap = 16.5px per column
const CELL_W = 15;
const CELL_H = 15;
const CELL_GAP = 2.5;
const COL_STEP = CELL_W + CELL_GAP; // 16.5px

/* ─── Compact Activity Heatmap ─── */
function ActivityHeatmap({ userId }: { userId?: string }) {
  const { cells, loading, startDate } = useActivityHeatmap(userId);

  const colors = [
    'bg-muted/60',
    'bg-primary/20',
    'bg-primary/40',
    'bg-primary/60',
    'bg-primary',
  ];

  // Today at midnight — used for accurate future-cell detection
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  /**
   * Build month labels that are pinned to the EXACT column where a new month begins.
   * Uses the same COL_STEP math as the cell grid so labels sit over the right column.
   */
  const getMonthLabels = () => {
    if (!startDate) return [];

    const labels: { month: string; colIndex: number }[] = [];
    let lastSeenMonth = -1;

    for (let col = 0; col < 14; col++) {
      // The date of the Sunday that starts each column
      const colDate = new Date(startDate);
      colDate.setDate(startDate.getDate() + col * 7);

      const month = colDate.getMonth();
      if (month !== lastSeenMonth) {
        labels.push({
          month: colDate.toLocaleString('default', { month: 'short' }),
          colIndex: col,
        });
        lastSeenMonth = month;
      }
    }
    return labels;
  };

  if (loading || !startDate) return <div className="text-[10px] animate-pulse">Loading activity…</div>;

  return (
    <div className="space-y-1.5">

      {/* ── X-AXIS: Month labels, pixel-aligned to grid columns ── */}
      <div className="flex gap-1">
        {/* Spacer matching y-axis width */}
        <div className="w-[18px] flex-shrink-0" />
        <div className="relative flex-1" style={{ height: '10px' }}>
          {getMonthLabels().map((label, i) => (
            <span
              key={i}
              className="absolute top-0 text-[9px] font-medium text-muted-foreground/60 leading-none"
              style={{ left: `${label.colIndex * COL_STEP}px` }}
            >
              {label.month}
            </span>
          ))}
        </div>
      </div>

      {/* ── GRID ROW: Y-axis labels + cell grid ── */}
      <div className="flex gap-1">

        {/* Y-AXIS: Day labels, height-matched to cell rows */}
        <div
          className="w-[18px] flex-shrink-0 grid text-[8px] font-medium text-muted-foreground/40 leading-none text-right pr-0.5"
          style={{ gridTemplateRows: `repeat(7, ${CELL_H}px)`, gap: `${CELL_GAP}px` }}
        >
          {/* Row 0 = Sunday (blank), 1 = Mon, 2 = blank, 3 = Wed, 4 = blank, 5 = Fri, 6 = blank */}
          <div className="flex items-center justify-end" />
          <div className="flex items-center justify-end -translate-x-2"><span className="-rotate-90">Mon</span></div>
          <div className="flex items-center justify-end" />
          <div className="flex items-center justify-end -translate-x-2"><span className="-rotate-90">Wed</span></div>
          <div className="flex items-center justify-end" />
          <div className="flex items-center justify-end -translate-x-2.5"><span className="-rotate-90">Fri</span></div>
          <div className="flex items-center justify-end" />
        </div>

        {/* ── THE GRID ── 98 cells, column-first (Sun→Sat, week by week) */}
        <div
          className="grid -translate-x-2"
          style={{
            gridTemplateRows: `repeat(7, ${CELL_H}px)`,
            gridAutoFlow: 'column',
            gap: `${CELL_GAP}px`,
          }}
        >
          {cells.map((level, i) => {
            // Map linear index → calendar date
            // Index 0 = startDate (a Sunday), index 1 = startDate+1 (Monday), etc.
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);

            const isFuture = cellDate > todayMidnight;
            const isToday = cellDate.getTime() === todayMidnight.getTime();

            const tooltipText = isFuture
              ? ''
              : `${cellDate.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}: ${
                  level === 0 ? 'No activity' : `Level ${level} activity`
                }`;

            return (
              <div
                key={i}
                title={tooltipText}
                className={cn(
                  'rounded-[1.5px] transition-all duration-200',
                  isFuture
                    ? 'bg-transparent'
                    : cn(colors[level], 'hover:ring-1 hover:ring-primary/50'),
                  isToday && 'ring-1 ring-primary/70',
                )}
                style={{ width: `${CELL_W}px`, height: `${CELL_H}px` }}
              />
            );
          })}
        </div>
      </div>

      {/* ── FOOTER: Legend ── */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] text-muted-foreground/40 italic">14 weeks</span>
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
    { id: 'discover', label: 'Discover People', icon: Users },
    { id: 'discover-teams', label: 'Discover Teams', icon: Search },
    { id: 'teams', label: 'My Teams', icon: FolderKanban },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'interviews', label: 'Interviews', icon: Video },
  ];

  const displayName = userProfile?.fullName || 'User';
  const userId = (userProfile as any)?.id || undefined;

  if (collapsed) {
    return (
      <aside className="flex-shrink-0 w-14 h-[calc(100vh-4rem)] flex flex-col transition-all duration-300 pb-4">
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
    <aside className="flex-shrink-0 w-70 h-screen overflow-y-auto flex flex-col transition-all duration-300 gap-2.5">

      {/* ── Greeting + Profile Card ── */}
      <div className="card-base px-4 py-4 min-h-[60px] flex-shrink-0 flex items-center mt-2">
        <div className="flex items-center gap-2.5">
          <img
            src={
              userProfile?.avatar
                ? `${userProfile.avatar}?t=${Date.now()}`
                : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`
            }
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/15 flex-shrink-0"
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
                  'w-[22px] h-[22px] flex-shrink-0 transition-colors',
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