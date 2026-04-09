import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getProfile, getUserTeams, getTeamTasks, Team, UserProfile, TeamTask } from "@/services/firestore";
import { Loader2, ShieldCheck, ArrowLeft, CheckCircle, BarChart3, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type TeamWithTasks = Team & {
  verifiedTasks: TeamTask[];
};

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#6366f1", "#ec4899", "#8b5cf6"];

export default function VerifyCertificate() {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [teamsData, setTeamsData] = useState<TeamWithTasks[]>([]);
  const [chartData, setChartData] = useState<{ name: string; tasks: number }[]>([]);

  useEffect(() => {
    async function fetchVerificationData() {
      if (!userId) {
        setError("Invalid User ID.");
        setLoading(false);
        return;
      }

      try {
        const fetchedProfile = await getProfile(userId);
        if (!fetchedProfile) throw new Error("User Profile not found.");

        const teams = await getUserTeams(userId);

        const teamsWithTasksData: TeamWithTasks[] = await Promise.all(
          teams.map(async (team) => {
            const allTasks = await getTeamTasks(team.id);
            // Verify if task belongs to user AND is verified
            const verified = allTasks.filter(t =>
              t.status === 'verified' &&
              t.assignedTo?.includes(userId)
            );
            return { ...team, verifiedTasks: verified };
          })
        );

        setProfile(fetchedProfile);
        setTeamsData(teamsWithTasksData);

        // Prepare chart data
        const cData = teamsWithTasksData.map(t => ({
          name: t.name,
          tasks: t.verifiedTasks.length
        })).filter(t => t.tasks > 0);

        setChartData(cData);

      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to verify certificate.");
      } finally {
        setLoading(false);
      }
    }

    fetchVerificationData();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground text-lg">Verifying official portfolio record...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold text-destructive mb-2">Verification Failed</h1>
          <p className="text-muted-foreground mb-6">{error || "Record not found."}</p>
          <Link to="/" className="btn-primary flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Go Back Home
          </Link>
        </div>
      </div>
    );
  }

  const totalVerifiedTasks = teamsData.reduce((acc, team) => acc + team.verifiedTasks.length, 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-border py-4 px-6 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          <span className="font-bold text-xl tracking-tight">TeamUp</span>
        </div>
        <Link to="/" className="text-sm font-medium hover:underline text-muted-foreground transition">
          Back to TeamUp
        </Link>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-12">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-10 text-white flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 border-4 border-white/40">
              <ShieldCheck className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">Verified Portfolio</h1>
            <p className="text-emerald-50 font-medium text-lg max-w-lg opacity-90 delay-100 animate-in fade-in">
              Official verification of cross-team contributions and completed tasks on TeamUp.
            </p>
          </div>

          <div className="p-6 sm:p-10">
            {/* User Info */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 mb-10 pb-10 border-b border-slate-100">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <img
                  src={profile.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.fullName || 'User')}`}
                  className="w-20 h-20 rounded-full border border-slate-200 shadow-sm object-cover"
                  alt="Avatar"
                />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{profile.fullName}</p>
                  <p className="text-slate-600 font-medium text-lg">{profile.primaryRole}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-center sm:text-right">
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Teams</p>
                  <p className="text-3xl font-extrabold text-slate-900">{teamsData.length}</p>
                </div>
                <div className="w-px h-12 bg-slate-200" />
                <div className="text-center sm:text-right">
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Verified Tasks</p>
                  <p className="text-3xl font-extrabold text-emerald-600">{totalVerifiedTasks}</p>
                </div>
              </div>
            </div>

            {/* Chart Section */}
            {chartData.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-primary" />
                  Task Contributions Overview
                </h2>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="tasks" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Detailed Teams and Tasks Timeline */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
                Team Descriptions & verified Tasks
              </h2>

              {teamsData.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center flex flex-col items-center">
                  <AlertCircle className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-slate-500 font-medium">No team memberships found for this user.</p>
                </div>
              ) : (
                <div className="space-y-10">
                  {teamsData.map((team, tIdx) => (
                    <div key={team.id} className="relative pl-6 sm:pl-8 border-l-2 border-slate-200">
                      {/* Team Node */}
                      <div className="absolute w-4 h-4 rounded-full -left-[9px] top-1" style={{ backgroundColor: COLORS[tIdx % COLORS.length] }} />

                      <div className="mb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <h3 className="text-xl font-bold text-slate-900" style={{ color: COLORS[tIdx % COLORS.length] }}>
                            {team.name}
                          </h3>
                          <span className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold uppercase tracking-wide rounded-full self-start sm:self-auto">
                            {team.status === 'forming' ? 'Ideation' : team.status === 'active' ? 'Development' : 'Launched'}
                          </span>
                        </div>
                        <p className="text-slate-600 font-medium mb-4 bg-slate-50 p-4 rounded-lg border border-slate-100 leading-relaxed">
                          {team.description}
                        </p>
                      </div>

                      {/* Verified Tasks for this team */}
                      <div className="pl-4 sm:pl-6 border-l border-slate-200 space-y-4">
                        {team.verifiedTasks.length === 0 ? (
                          <p className="text-sm text-slate-400 italic">No verified tasks completed yet.</p>
                        ) : (
                          team.verifiedTasks.map((task, i) => (
                            <div key={task.id || i} className="flex gap-3">
                              <div className="mt-1.5 flex flex-col items-center flex-shrink-0">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20"></div>
                              </div>
                              <div className="flex-1">
                                <p className="text-slate-800 font-medium text-base">{task.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Verified</span>
                                  {task.perkValue && (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">+{task.perkValue} Perks</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm">
          Verified via TeamUp Distributed Ledger <br />
          &copy; {new Date().getFullYear()} TeamUp
        </p>
      </div>
    </div>
  );
}
