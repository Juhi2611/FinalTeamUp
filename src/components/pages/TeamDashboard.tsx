import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, Users, CheckSquare, TrendingUp,
  Clock, Loader2, Crown, Calendar, Target, Activity
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getTeam, getTeamMembers, Team, TeamMember, UserProfile,
  subscribeToTeamTasks, subscribeToWorkspaceLogs, WorkspaceLog
} from '@/services/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface TaskTask {
  id: string;
  title: string;
  assignedTo?: string[];
  status?: 'inprogress' | 'submitted' | 'verified';
  verifiedAt?: any;
  createdAt?: any;
  [key: string]: any;
}

/* ─── Colors ─── */
const MEMBER_COLORS = [
  '#1CB0A3', '#3ABFB4', '#0D9488', '#2DD4BF',
  '#14B8A6', '#5EEAD4', '#06B6D4', '#22D3EE',
  '#0EA5E9', '#38BDF8', '#6366F1', '#818CF8',
];

/* ─── Timeline data from tasks ─── */
function buildTimelineData(tasks: TaskTask[]) {
  // Build last 7 days cumulative completed tasks
  const now = new Date();
  const days: { label: string; completed: number; total: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });

    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    const verifiedByDay = tasks.filter(t => {
      if (t.status !== 'verified' || !t.verifiedAt) return false;
      const vDate = t.verifiedAt.toDate ? t.verifiedAt.toDate() : new Date(t.verifiedAt.seconds * 1000);
      return vDate <= dayEnd;
    }).length;

    days.push({ label, completed: verifiedByDay, total: tasks.length });
  }
  return days;
}

/* ─── Main Component ─── */
const TeamDashboard = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<(TeamMember & { profile: UserProfile | null })[]>([]);
  const [tasks, setTasks] = useState<TaskTask[]>([]);
  const [logs, setLogs] = useState<WorkspaceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !isFirebaseConfigured()) { setLoading(false); return; }
    const load = async () => {
      try {
        const [teamData, teamMembers] = await Promise.all([getTeam(teamId), getTeamMembers(teamId)]);
        setTeam(teamData);
        setMembers(teamMembers);
      } catch (err) {
        console.error('TeamDashboard: load error', err);
      }
      setLoading(false);
    };
    load();
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    const unsub = subscribeToTeamTasks(teamId, (t) => setTasks(t as TaskTask[]));
    return () => unsub();
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    const unsub = subscribeToWorkspaceLogs(teamId, setLogs);
    return () => unsub();
  }, [teamId]);

  /* ── Derived data ── */
  const totalTasks = tasks.length;
  const verifiedTasks = tasks.filter(t => t.status === 'verified');
  const verifiedCount = verifiedTasks.length;
  const inProgressCount = tasks.filter(t => t.status === 'inprogress').length;
  const overallProgress = totalTasks > 0 ? Math.round((verifiedCount / totalTasks) * 100) : 0;

  const memberProgress = members.map((m, idx) => {
    const mt = tasks.filter(t => t.assignedTo?.includes(m.userId));
    const mv = mt.filter(t => t.status === 'verified').length;
    return {
      ...m,
      total: mt.length,
      verified: mv,
      progress: mt.length > 0 ? Math.round((mv / mt.length) * 100) : 0,
      color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
    };
  });

  const donutData = memberProgress
    .filter(m => m.verified > 0)
    .map(m => ({ name: m.profile?.fullName || 'Member', value: m.verified, color: m.color }));

  const timelineData = buildTimelineData(tasks);

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="card-base p-12 text-center max-w-md">
          <p className="text-muted-foreground mb-4">Team not found</p>
          <button onClick={() => navigate(-1)} className="btn-primary">Go Back</button>
        </div>
      </div>
    );
  }

  const statusBadge = team.status === 'active'
    ? 'bg-skill-mobile/10 text-skill-mobile'
    : team.status === 'complete'
    ? 'bg-muted text-muted-foreground'
    : 'bg-accent/10 text-accent';

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="w-full max-w-5xl mx-auto px-4 py-5 space-y-5">

        {/* ═══ Header ═══ */}
        <div className="card-base p-5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors flex-shrink-0">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="p-2.5 rounded-xl bg-primary/10 flex-shrink-0">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display font-bold text-xl text-foreground">{team.name}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${statusBadge}`}>
                  {team.status ? team.status.charAt(0).toUpperCase() + team.status.slice(1) : 'Forming'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground truncate">{team.description}</p>
            </div>
          </div>
        </div>

        {/* ═══ Stats Row — 4 cards like Panze ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card-base p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <CheckSquare className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{verifiedCount}<span className="text-sm font-normal text-muted-foreground">/{totalTasks}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">Tasks Done</p>
          </div>

          <div className="card-base p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-accent/10">
                <Activity className="w-4 h-4 text-accent" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{overallProgress}<span className="text-sm font-normal text-muted-foreground">%</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">Progress</p>
          </div>

          <div className="card-base p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-skill-mobile/10">
                <Target className="w-4 h-4 text-skill-mobile" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{inProgressCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">In Progress</p>
          </div>

          <div className="card-base p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-secondary">
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{members.length}<span className="text-sm font-normal text-muted-foreground">/{team.maxMembers}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">Members</p>
          </div>
        </div>

        {/* ═══ Timeline + Donut ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Timeline Progress — tasks completed over 7 days + per-member bars */}
          <div className="card-base p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Team Progress Timeline
              </h2>
              <span className="text-xs text-muted-foreground">Last 7 days</span>
            </div>

            {/* 7-day line chart */}
            <div className="mb-4" style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '0.7rem' }}
                    formatter={(v: number) => [`${v} tasks`, 'Completed']}
                  />
                  <Line type="monotone" dataKey="completed" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--primary))' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Overall bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Overall Completion</span>
                <span className="text-xs font-bold text-foreground">{overallProgress}%</span>
              </div>
              <div className="timeline-bar">
                <div className="timeline-bar-fill" style={{ width: `${overallProgress}%` }} />
              </div>
            </div>

            {/* Per-member bars */}
            <div className="space-y-2.5 pt-3 border-t border-border/40">
              <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">By Member</p>
              {memberProgress.map((m) => (
                <div key={m.userId}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                      <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                        {m.profile?.fullName || 'Member'}
                      </span>
                      {team.leaderId === m.userId && <Crown className="w-3 h-3 text-accent flex-shrink-0" />}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{m.verified}/{m.total}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.progress}%`, background: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Donut — work done by each member */}
          <div className="card-base p-5">
            <h2 className="font-display font-semibold text-base text-foreground flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              Work Distribution
            </h2>

            {donutData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48">
                <CheckSquare className="w-10 h-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No verified tasks yet</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-full" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {donutData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value} tasks`, name]}
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem', fontSize: '0.75rem' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Center label */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 w-full">
                  {donutData.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                      <span className="text-xs text-foreground truncate">{entry.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Member Table ═══ */}
        <div className="card-base p-5">
          <h2 className="font-display font-semibold text-base text-foreground flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            Team Members
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                  <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned</th>
                  <th className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Done</th>
                  <th className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress</th>
                </tr>
              </thead>
              <tbody>
                {memberProgress.map((m) => (
                  <tr key={m.userId} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={m.profile?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.profile?.fullName || 'User')}`}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-medium text-foreground text-sm">{m.profile?.fullName || 'Member'}</p>
                          {team.leaderId === m.userId && (
                            <span className="text-[10px] text-accent font-semibold flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5" /> Leader
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground text-xs">{m.role}</td>
                    <td className="py-2.5 px-2 text-center font-medium text-sm">{m.total}</td>
                    <td className="py-2.5 px-2 text-center font-medium text-primary text-sm">{m.verified}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${m.progress}%`, background: m.color }} />
                        </div>
                        <span className="text-xs font-semibold text-foreground w-8">{m.progress}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ Recent Activity ═══ */}
        <div className="card-base p-5">
          <h2 className="font-display font-semibold text-base text-foreground flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-primary" />
            Recent Activity
          </h2>

          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">No activity yet</p>
          ) : (
            <div className="space-y-2.5">
              {logs.slice(0, 15).map((log) => (
                <div key={log.id} className="flex gap-3 p-3 rounded-xl bg-secondary/30 border border-border/40">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-primary">{log.userName?.charAt(0).toUpperCase() || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm text-foreground">{log.userName}</span>
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />{formatTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{log.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TeamDashboard;