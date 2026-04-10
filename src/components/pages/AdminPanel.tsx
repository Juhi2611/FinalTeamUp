import { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  LayoutDashboard,
  Users,
  Users2,
  CheckCircle,
  AlertCircle,
  Bell,
  Shield,
  Settings,
  LogOut,
  Search,
  Save,
  X,
  Edit2,
  Trash2,
  Eye,
  User,
  Star,
  FileText,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Download,
} from "lucide-react";
import { format } from "date-fns";

const API_URL = "http://localhost:5000/admin";

// ─── Helper ─────────────────────────────────────────────────────────────────
const dash = "—";

function safeDate(val: any): string {
  if (!val) return dash;
  try {
    if (val._seconds) return format(new Date(val._seconds * 1000), "MMM d, yyyy");
    return format(new Date(val), "MMM d, yyyy");
  } catch {
    return dash;
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────
const AdminPanel = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Dashboard");

  // Reset pages when tab or search changes
  const handleSetTab = (tab: string) => {
    setActiveTab(tab);
    setUsersPage(1); setTeamsPage(1); setVerifsPage(1); setReportsPage(1); setPostsPage(1);
  };

  // Team detail modal state
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  // User detail modal state
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Pagination (15 per page per section)
  const PAGE_SIZE = 15;
  const [usersPage, setUsersPage] = useState(1);
  const [teamsPage, setTeamsPage] = useState(1);
  const [verifsPage, setVerifsPage] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const [postsPage, setPostsPage] = useState(1);

  // Settings state
  const [isEditing, setIsEditing] = useState(false);
  const [adminProfile, setAdminProfile] = useState({
    fullName: "Shweta Patil",
    email: "yashvisanghvi1812@gmail.com",
    role: "System Administrator",
    phone: "+91 98765 43210",
    location: "Mumbai, India",
    bio: "Platform administrator for TeamUp. Responsible for user management and platform health.",
  });
  const [draftProfile, setDraftProfile] = useState({ ...adminProfile });

  const token = localStorage.getItem("adminToken");

  // ── Fetch from backend (Admin SDK) ──────────────────────────────────────
  const fetchFullData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [usersRes, teamsRes, verifsRes, reportsRes, postsRes, ratingsRes] = await Promise.all([
        fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/teams`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/verifications`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/reports`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/posts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/ratings`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [userData, teamData, verifData, reportData, postData, ratingData] = await Promise.all([
        usersRes.json(),
        teamsRes.json(),
        verifsRes.json(),
        reportsRes.json(),
        postsRes.json(),
        ratingsRes.json(),
      ]);

      if (Array.isArray(userData)) setUsers(userData);
      if (Array.isArray(teamData)) setTeams(teamData);
      if (Array.isArray(verifData)) setVerifications(verifData);
      if (Array.isArray(reportData)) setReports(reportData);
      if (Array.isArray(postData)) setPosts(postData);
      if (Array.isArray(ratingData)) setRatings(ratingData);
    } catch (err) {
      console.error("Admin data fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchFullData();
  }, [token]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    totalUsers: users.length,
    totalTeams: teams.length,
    verifiedSkills: verifications.filter((v) => v.status === "verified").length,
    activeReports: reports.filter((r) => r.status === "pending").length,
  }), [users, teams, verifications, reports]);

  // ── Chart data: User growth (last 30 days) ───────────────────────────────
  const userGrowthData = useMemo(() => {
    const last30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return format(d, "MMM d");
    }).reverse();

    const growthMap: Record<string, number> = {};
    users.forEach((u) => {
      if (u.createdAt) {
        try { const d = format(new Date(u.createdAt), "MMM d"); growthMap[d] = (growthMap[d] || 0) + 1; } catch { }
      }
    });

    let cum = 0;
    return last30.map((date) => { cum += growthMap[date] || 0; return { name: date, users: cum }; });
  }, [users]);

  // ── Chart data: Post types (Pie) ─────────────────────────────────────────
  const postTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    posts.forEach((p) => { const t = p.type || "other"; map[t] = (map[t] || 0) + 1; });
    const labels: Record<string, string> = {
      user_post: "User Post",
      team_created: "Team Created",
      member_joined: "Member Joined",
    };
    return Object.entries(map).map(([key, value]) => ({ name: labels[key] || key, value }));
  }, [posts]);

  // ── Chart data: Team status (Bar) ────────────────────────────────────────
  const teamStatusData = useMemo(() => {
    const map: Record<string, number> = {};
    teams.forEach((t) => { const s = t.status || "unknown"; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).map(([status, count]) => ({ status: status.charAt(0).toUpperCase() + status.slice(1), count }));
  }, [teams]);

  // ── Chart data: Posts over last 30 days ──────────────────────────────────
  const postActivityData = useMemo(() => {
    const last14 = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return format(d, "MMM d");
    }).reverse();

    const map: Record<string, Record<string, number>> = {};
    last14.forEach((d) => { map[d] = { user_post: 0, team_created: 0, member_joined: 0 }; });
    posts.forEach((p) => {
      if (p.createdAt) {
        try {
          const d = format(new Date(p.createdAt._seconds * 1000), "MMM d");
          if (map[d] && p.type) map[d][p.type] = (map[d][p.type] || 0) + 1;
        } catch { }
      }
    });
    return last14.map((date) => ({ name: date, ...map[date] }));
  }, [posts]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to permanently delete this team?")) return;
    try {
      await fetch(`${API_URL}/team/${teamId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      setSelectedTeam(null);
    } catch (err) {
      console.error("Delete team failed:", err);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Permanently delete user "${userName || userId}"? This cannot be undone.`)) return;
    try {
      await fetch(`${API_URL}/user/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSelectedUser(null);
    } catch (err) {
      console.error("Delete user failed:", err);
    }
  };

  // Get teams a user belongs to
  const getUserTeams = (userId: string) =>
    teams.filter((t) =>
      (t.members || []).some((m: any) => m.userId === userId)
    );

  const handleSaveProfile = () => {
    setAdminProfile({ ...draftProfile });
    setIsEditing(false);
  };

  const handleSignOut = () => {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin-login";
  };

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          (u.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.username || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.email || "").toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [users, searchQuery]
  );

  const filteredTeams = useMemo(
    () =>
      teams.filter(
        (t) =>
          (t.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.leaderName || "").toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [teams, searchQuery]
  );

  // ── Render Sections ───────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      // ── Dashboard ──────────────────────────────────────────────────────
      case "Dashboard":
        return (
          <div className="p-8 space-y-8">
            <p className="text-gray-400 text-sm">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              <StatCard title="Total Users" value={stats.totalUsers} sub="Admin SDK Synced" color="purple" icon={<Users className="w-5 h-5" />} />
              <StatCard title="Total Teams" value={stats.totalTeams} sub="Active groups" color="emerald" icon={<Users2 className="w-5 h-5" />} />
              <StatCard title="Verified Skills" value={stats.verifiedSkills} sub="From skillVerifications" color="amber" icon={<CheckCircle className="w-5 h-5" />} />
              <StatCard title="Pending Reports" value={stats.activeReports} sub="Requires review" color="rose" icon={<AlertCircle className="w-5 h-5" />} />
            </div>

            {/* Chart + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#21233d] rounded-3xl p-6 border border-white/5">
                <h2 className="font-semibold mb-1">User Growth</h2>
                <p className="text-xs text-gray-500 mb-6">Last 30 days (Auth registry)</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={userGrowthData}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#4f46e5" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 11 }} dy={8} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ backgroundColor: "#1a1c2e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }} itemStyle={{ color: "#fff" }} />
                    <Line type="monotone" dataKey="users" stroke="url(#grad)" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "#8b5cf6" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-[#21233d] rounded-3xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">Recent Activity</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{posts.length} posts</span>
                    <button
                      onClick={() => handleSetTab("Posts")}
                      className="flex items-center gap-1 text-xs font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-2.5 py-1 rounded-lg transition-all"
                    >
                      View All <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3 overflow-y-auto max-h-64">
                  {posts.length === 0 && <p className="text-gray-600 text-sm text-center py-8">No posts yet</p>}
                  {posts.map((p) => {
                    const typeStyles: Record<string, string> = {
                      user_post: "text-purple-400 bg-purple-500/10",
                      team_created: "text-emerald-400 bg-emerald-500/10",
                      member_joined: "text-amber-400 bg-amber-500/10",
                    };
                    const style = typeStyles[p.type] || "text-gray-400 bg-white/5";
                    return (
                      <div key={p.id} className="flex gap-3">
                        {p.authorAvatar ? (
                          <img src={p.authorAvatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
                        ) : (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${style.split(" ")[1]}`}>
                            <Bell className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{p.title || p.description || "Activity"}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-gray-500">{p.authorName || "Unknown"}</span>
                            <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${style}`}>{p.type?.replace(/_/g, " ")}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );

      // ── Users ──────────────────────────────────────────────────────────
      case "Users": {
        const userTeamsCount = (userId: string) => getUserTeams(userId).length;
        return (
          <div className="p-8 space-y-6">
            {/* User Detail Modal */}
            {selectedUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedUser(null)}>
                <div className="bg-[#21233d] border border-white/10 rounded-3xl p-8 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      {selectedUser.avatar ? (
                        <img src={selectedUser.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-white/10 flex items-center justify-center">
                          <User className="w-7 h-7 text-purple-400" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-bold">{selectedUser.fullName || dash}</h3>
                        <p className="text-sm text-gray-400">@{selectedUser.username || dash}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{selectedUser.email || dash}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white p-1 shrink-0">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <InfoRow label="Role" value={selectedUser.role || dash} />
                    <InfoRow label="College" value={selectedUser.college || dash} />
                    <InfoRow label="Joined" value={safeDate(selectedUser.createdAt)} />
                    <InfoRow label="Last Login" value={safeDate(selectedUser.lastLogin)} />
                    <InfoRow label="Skill Verified" value={selectedUser.skillsVerified ? "Yes ✓" : "No"} />
                    <InfoRow label="Profile Verified" value={selectedUser.isVerified ? "Yes ✓" : "No"} />
                  </div>

                  {/* Teams */}
                  <div className="mb-6">
                    <h4 className="text-xs uppercase text-gray-500 font-bold mb-3">Teams ({getUserTeams(selectedUser.id).length})</h4>
                    {getUserTeams(selectedUser.id).length === 0 ? (
                      <p className="text-gray-600 text-sm bg-[#1a1c2e] rounded-xl px-4 py-3 border border-white/5">Not a member of any team.</p>
                    ) : (
                      <div className="space-y-2">
                        {getUserTeams(selectedUser.id).map((t: any) => {
                          const memberEntry = (t.members || []).find((m: any) => m.userId === selectedUser.id);
                          return (
                            <div key={t.id} className="flex items-center justify-between bg-[#1a1c2e] rounded-xl px-4 py-2.5 border border-white/5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold text-xs">{(t.name || "T")[0]}</div>
                                <div>
                                  <p className="text-sm font-medium">{t.name || dash}</p>
                                  <p className="text-[11px] text-gray-500">{t.city || dash}</p>
                                </div>
                              </div>
                              <span className="text-[10px] text-gray-500 font-medium uppercase bg-white/5 px-2 py-0.5 rounded-md">{memberEntry?.role || "Member"}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* User ID */}
                  <div className="bg-[#1a1c2e] rounded-xl px-4 py-2.5 border border-white/5 mb-5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">User ID</p>
                    <p className="text-xs font-mono text-gray-400 break-all">{selectedUser.id}</p>
                  </div>

                  {/* Ratings received */}
                  {(() => {
                    const userRatings = ratings.filter(r => r.ratedUserId === selectedUser.id);
                    const avgRating = userRatings.length
                      ? (userRatings.reduce((s, r) => s + (r.rating || 0), 0) / userRatings.length).toFixed(1)
                      : null;
                    return (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs uppercase text-gray-500 font-bold">Ratings Received ({userRatings.length})</h4>
                          {avgRating && (
                            <div className="flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 rounded-full">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span className="text-amber-400 font-bold text-sm">{avgRating}</span>
                              <span className="text-gray-500 text-xs">avg</span>
                            </div>
                          )}
                        </div>
                        {userRatings.length === 0 ? (
                          <p className="text-gray-600 text-sm bg-[#1a1c2e] rounded-xl px-4 py-3 border border-white/5">No ratings received yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {userRatings.map((r) => (
                              <div key={r.id} className="flex items-center justify-between bg-[#1a1c2e] rounded-xl px-4 py-2.5 border border-white/5">
                                <div className="flex items-center gap-2">
                                  {r.raterProfile?.avatar ? (
                                    <img src={r.raterProfile.avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-white/10" />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                                      <User className="w-3 h-3 text-gray-500" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs font-medium">{r.raterProfile?.fullName || r.raterProfile?.email || r.raterId?.slice(0, 8) || dash}</p>
                                    {r.teamId && <p className="text-[10px] text-gray-600">{teams.find(t => t.id === r.teamId)?.name || "Team"}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map(s => (
                                      <Star key={s} className={`w-3 h-3 ${s <= Math.round(r.rating) ? "text-amber-400 fill-amber-400" : "text-gray-600"}`} />
                                    ))}
                                  </div>
                                  <span className="text-xs font-bold text-amber-400">{r.rating}</span>
                                  <span className="text-[10px] text-gray-600">{safeDate(r.createdAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button onClick={() => setSelectedUser(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition-all">Close</button>
                    <button onClick={() => handleDeleteUser(selectedUser.id, selectedUser.fullName)} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm font-bold text-white transition-all flex items-center justify-center gap-2">
                      <Trash2 className="w-4 h-4" /> Delete User
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Manage Users</h2>
                <p className="text-sm text-gray-400 mt-0.5">{users.length} total accounts (Admin SDK — full roster)</p>
              </div>
              <button onClick={fetchFullData} className="text-xs font-bold px-4 py-2 rounded-xl bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 transition-all">↻ Refresh</button>
            </div>

            <div className="bg-[#21233d] rounded-3xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.03] text-gray-500 text-[10px] uppercase tracking-wider">
                      <th className="px-5 py-3.5 font-semibold">User</th>
                      <th className="px-5 py-3.5 font-semibold">Email</th>
                      <th className="px-5 py-3.5 font-semibold">Role</th>
                      <th className="px-5 py-3.5 font-semibold">Teams</th>
                      <th className="px-5 py-3.5 font-semibold">Joined</th>
                      <th className="px-5 py-3.5 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="w-9 h-9 rounded-full border border-white/10 object-cover shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#1a1c2e] border border-white/10 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-gray-500" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium">{u.fullName || dash}</p>
                              <p className="text-[11px] text-gray-500">@{u.username || dash}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-400">{u.email || dash}</td>
                        <td className="px-5 py-3.5">
                          {u.role ? (
                            <span className="bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md">{u.role}</span>
                          ) : (
                            <span className="text-gray-600 text-sm">{dash}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm text-gray-400">{userTeamsCount(u.id)}</span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-500">{safeDate(u.createdAt)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setSelectedUser(u)} className="flex items-center gap-1.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                              <Eye className="w-3 h-3" /> View
                            </button>
                            <button onClick={() => handleDeleteUser(u.id, u.fullName)} className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }

      // ── Teams ──────────────────────────────────────────────────────────
      case "Teams":
        return (
          <div className="p-8 space-y-6">
            {/* Team Detail Modal */}
            {selectedTeam && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="bg-[#21233d] border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold">{selectedTeam.name}</h3>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md mt-1 inline-block ${selectedTeam.status === "complete" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                        }`}>
                        {selectedTeam.status || dash}
                      </span>
                    </div>
                    <button onClick={() => setSelectedTeam(null)} className="text-gray-400 hover:text-white p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-sm text-gray-400 leading-relaxed mb-6">{selectedTeam.description || dash}</p>

                  <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
                    <InfoRow label="Leader" value={selectedTeam.leaderName || dash} />
                    <InfoRow label="City" value={selectedTeam.city || dash} />
                    <InfoRow label="Members" value={`${selectedTeam.members?.length ?? 0} / ${selectedTeam.maxMembers ?? dash}`} />
                    <InfoRow label="Roles Needed" value={(selectedTeam.rolesNeeded || []).join(", ") || dash} />
                  </div>

                  {/* Member list */}
                  <div className="mb-6">
                    <h4 className="text-xs uppercase text-gray-500 font-bold mb-3">Members</h4>
                    {(!selectedTeam.members || selectedTeam.members.length === 0) ? (
                      <p className="text-gray-600 text-sm">No members listed.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedTeam.members.map((m: any, i: number) => (
                          <div key={i} className="flex items-center justify-between bg-[#1a1c2e] rounded-xl px-4 py-2.5 border border-white/5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center">
                                <User className="w-3.5 h-3.5 text-purple-400" />
                              </div>
                              <span className="text-sm">{m.userName || m.userId || dash}</span>
                            </div>
                            <span className="text-[10px] text-gray-500 font-medium uppercase">{m.role || dash}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setSelectedTeam(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition-all">
                      Close
                    </button>
                    <button onClick={() => handleDeleteTeam(selectedTeam.id)} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm font-bold transition-all text-white flex items-center justify-center gap-2">
                      <Trash2 className="w-4 h-4" /> Delete Team
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Manage Teams</h2>
                <p className="text-sm text-gray-400 mt-0.5">{teams.length} active groups</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTeams.map((team) => (
                <div key={team.id} className="bg-[#21233d] border border-white/5 rounded-3xl p-5 hover:border-purple-500/20 transition-all group flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold text-lg uppercase">
                      {(team.name || "T")[0]}
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${team.status === "complete" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                      }`}>
                      {team.status || dash}
                    </span>
                  </div>

                  <h3 className="font-bold text-base mb-1">{team.name || dash}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 flex-1 mb-4">
                    {team.description || "No description provided."}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-3 border-t border-white/5 mb-4">
                    <span><Users className="w-3 h-3 inline mr-1" />{team.members?.length ?? 0}/{team.maxMembers ?? "?"}</span>
                    <span>{team.city || dash}</span>
                  </div>

                  <button
                    onClick={() => setSelectedTeam(team)}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Team
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      // ── Skill Verifications ────────────────────────────────────────────
      case "Skill Verifications":
        const verified = verifications.filter((v) => v.status === "verified");
        return (
          <div className="p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Skill Verifications</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {verified.length} users have verified their skills on the platform.
              </p>
            </div>

            {verified.length === 0 ? (
              <div className="py-24 text-center bg-[#21233d] rounded-3xl border border-dashed border-white/10">
                <CheckCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">No verified users found in the skillVerifications collection.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {verified.map((v) => {
                  const u = v.resolvedUser;
                  return (
                    <div key={v.id} className="bg-[#21233d] border border-emerald-500/10 rounded-3xl p-5 flex items-start gap-5 hover:border-emerald-500/25 transition-all">
                      {/* Avatar */}
                      {u?.avatar ? (
                        <img src={u.avatar} alt="" className="w-12 h-12 rounded-full object-cover border border-emerald-500/20 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                          <CheckCircle className="w-6 h-6 text-emerald-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Name row */}
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-bold text-sm">{u?.fullName || dash}</p>
                          {u?.username && <span className="text-[11px] text-gray-500">@{u.username}</span>}
                          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md">Verified</span>
                          {u?.primaryRole && <span className="bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md">{u.primaryRole}</span>}
                        </div>

                        {/* ID + email + date */}
                        <p className="text-[11px] text-gray-600 mb-3">
                          <span>{u?.email || v.userId || dash}</span>
                          {" · "} Verified: {safeDate(v.verifiedAt)}
                        </p>

                        {/* Verified Skills */}
                        {v.verifiedSkills?.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1.5">Verified Skills</p>
                            <div className="flex flex-wrap gap-1.5">
                              {v.verifiedSkills.map((s: string) => (
                                <span key={s} className="bg-emerald-600/15 text-emerald-400 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/20">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* GitHub info if available */}
                        {v.sources?.github && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                            <Shield className="w-3 h-3" />
                            <span>GitHub: <span className="text-gray-300">@{v.sources.github.username || dash}</span></span>
                            {v.sources.github.repoCount != null && <span>· {v.sources.github.repoCount} repos</span>}
                            {v.overallScore != null && <span>· Score: <span className="text-purple-400 font-bold">{v.overallScore}</span></span>}
                          </div>
                        )}

                        {/* Certificate info if available */}
                        {v.sources?.certificates?.length > 0 && (
                          <div className="mt-2 text-[11px] text-gray-500">
                            <span>Certificates verified: {v.sources.certificates.length}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      // ── Reports ────────────────────────────────────────────────────────
      case "Reports":
        return (
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">User Reports</h2>
                <p className="text-sm text-gray-400 mt-0.5">{reports.length} total reports · {reports.filter((r) => r.status === "pending").length} pending review</p>
              </div>
              <button onClick={fetchFullData} className="text-xs font-bold px-4 py-2 rounded-xl bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 transition-all">
                ↻ Refresh
              </button>
            </div>

            {reports.length === 0 ? (
              <div className="py-24 text-center bg-[#21233d] rounded-3xl border border-dashed border-white/10">
                <AlertCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">No reports filed yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((r) => {
                  const reporter = r.reporterProfile;
                  const reported = r.reportedProfile;

                  // Best display name: fullName > email > id
                  const reportedDisplay = reported?.fullName || reported?.email || r.reportedId || dash;
                  const reporterDisplay = reporter?.fullName || reporter?.email || r.reporterId || dash;

                  return (
                    <div key={r.id} className="bg-[#21233d] rounded-3xl border border-white/5 p-5 hover:border-rose-500/20 transition-all">

                      {/* Header: Reported user */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {reported?.avatar ? (
                            <img src={reported.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-rose-500/20 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                              <AlertCircle className="w-4.5 h-4.5 text-rose-400" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-bold">
                              Reported:{" "}
                              <span className="text-rose-400">
                                {reportedDisplay}
                                {reported?.username && (
                                  <span className="text-rose-300 font-normal"> @{reported.username}</span>
                                )}
                              </span>
                            </p>
                            <p className="text-[11px] text-gray-600 font-mono mt-0.5">{r.reportedId || dash}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg shrink-0 ${r.status === "pending" ? "bg-rose-500/15 text-rose-400" :
                            r.status === "reviewed" ? "bg-amber-500/15 text-amber-400" :
                              "bg-emerald-500/15 text-emerald-400"
                          }`}>
                          {r.status || dash}
                        </span>
                      </div>

                      {/* Reporter info row */}
                      <div className="flex items-center gap-2 mb-4 text-[11px] text-gray-500 bg-[#1a1c2e] px-3 py-2 rounded-xl border border-white/[0.04]">
                        {reporter?.avatar ? (
                          <img src={reporter.avatar} alt="" className="w-5 h-5 rounded-full object-cover border border-white/10 shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                            <User className="w-2.5 h-2.5 text-gray-500" />
                          </div>
                        )}
                        <span className="text-gray-500">Reported by:</span>
                        <span className="text-gray-200 font-medium">
                          {reporterDisplay}
                          {reporter?.username && (
                            <span className="text-gray-500 font-normal"> @{reporter.username}</span>
                          )}
                        </span>
                        <span className="text-gray-700 font-mono ml-1">({r.reporterId?.slice(0, 8) || dash}…)</span>
                        <span className="ml-auto text-gray-600">{safeDate(r.createdAt)}</span>
                      </div>

                      {/* Reason + Description */}
                      <div className="bg-[#1a1c2e] rounded-2xl p-4 border border-white/[0.04]">
                        <p className="text-[11px] text-purple-400 font-bold uppercase mb-1">{r.reason || "No reason specified"}</p>
                        <p className="text-sm text-gray-400 leading-relaxed">{r.description || dash}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      // ── Settings ───────────────────────────────────────────────────────
      case "Settings":
        return (
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Settings</h2>
                <p className="text-sm text-gray-400 mt-0.5">Manage your admin profile and preferences.</p>
              </div>
              {isEditing ? (
                <div className="flex gap-2">
                  <button onClick={() => { setDraftProfile({ ...adminProfile }); setIsEditing(false); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition-all">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button onClick={handleSaveProfile} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-bold text-white transition-all shadow-lg shadow-emerald-600/20">
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                </div>
              ) : (
                <button onClick={() => { setDraftProfile({ ...adminProfile }); setIsEditing(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-bold text-white transition-all shadow-lg shadow-purple-600/20">
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Profile Card */}
              <div className="bg-[#21233d] border border-white/5 rounded-3xl p-7 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Shield className="w-8 h-8 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{adminProfile.fullName}</p>
                    <p className="text-sm text-gray-400">{adminProfile.role}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { label: "Full Name", key: "fullName", type: "text" },
                    { label: "Email Address", key: "email", type: "email" },
                    { label: "Role / Title", key: "role", type: "text" },
                    { label: "Phone Number", key: "phone", type: "tel" },
                    { label: "Location", key: "location", type: "text" },
                  ].map(({ label, key, type }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase font-bold px-0.5">{label}</label>
                      <input
                        type={type}
                        value={isEditing ? (draftProfile as any)[key] : (adminProfile as any)[key]}
                        onChange={(e) => setDraftProfile({ ...draftProfile, [key]: e.target.value })}
                        disabled={!isEditing}
                        className={`w-full bg-[#1a1c2e] border rounded-xl px-4 py-2.5 text-sm outline-none transition-all ${isEditing
                            ? "border-purple-500/40 ring-1 ring-purple-500/20 text-white"
                            : "border-white/5 text-gray-300 cursor-default"
                          }`}
                      />
                    </div>
                  ))}

                  {/* Bio textarea */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold px-0.5">Bio</label>
                    <textarea
                      value={isEditing ? draftProfile.bio : adminProfile.bio}
                      onChange={(e) => setDraftProfile({ ...draftProfile, bio: e.target.value })}
                      disabled={!isEditing}
                      rows={3}
                      className={`w-full bg-[#1a1c2e] border rounded-xl px-4 py-2.5 text-sm outline-none transition-all resize-none ${isEditing
                          ? "border-purple-500/40 ring-1 ring-purple-500/20 text-white"
                          : "border-white/5 text-gray-300 cursor-default"
                        }`}
                    />
                  </div>
                </div>
              </div>

              {/* System Status */}
              <div className="bg-[#21233d] border border-white/5 rounded-3xl p-7 space-y-4">
                <h3 className="font-semibold">System Status</h3>
                <div className="space-y-3">
                  {[
                    { label: "Admin SDK Backend", val: "Operational", sub: "Running on port 5000" },
                    { label: "Full Auth Sync", val: "Operational", sub: `${users.length} users tracked` },
                    { label: "Skill Verifications", val: "Healthy", sub: `${verifications.filter(v => v.status === "verified").length} verified records` },
                    { label: "Reports Queue", val: reports.filter(r => r.status === "pending").length > 0 ? "Attention Needed" : "Clear", sub: `${reports.filter(r => r.status === "pending").length} pending` },
                    { label: "Real-time Stream", val: "Active", sub: "Firebase onSnapshot" },
                  ].map(({ label, val, sub }) => (
                    <div key={label} className="flex items-center justify-between p-3.5 bg-[#1a1c2e] rounded-2xl border border-white/[0.04]">
                      <div>
                        <p className="text-xs font-medium">{label}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] text-gray-400">{val}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-white/5">
                  <button onClick={handleSignOut} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 font-bold text-sm transition-all">
                    <LogOut className="w-4 h-4" /> Sign Out Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      // ── Posts ──────────────────────────────────────────────────────────
      case "Posts": {
        const postTypeStyles: Record<string, { label: string; cls: string }> = {
          user_post: { label: "User Post", cls: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
          team_created: { label: "Team Created", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
          member_joined: { label: "Member Joined", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
        };

        const filteredPosts = posts.filter((p) => {
          const q = searchQuery.toLowerCase();
          return (
            (p.title || "").toLowerCase().includes(q) ||
            (p.description || "").toLowerCase().includes(q) ||
            (p.authorName || "").toLowerCase().includes(q) ||
            (p.type || "").toLowerCase().includes(q)
          );
        });

        return (
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">All Posts</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {filteredPosts.length} of {posts.length} posts from the platform activity feed
                </p>
              </div>
              <button
                onClick={fetchFullData}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 transition-all"
              >
                ↻ Refresh
              </button>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="py-24 text-center bg-[#21233d] rounded-3xl border border-dashed border-white/10">
                <FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">No posts found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPosts.map((p) => {
                  const typeInfo = postTypeStyles[p.type] || { label: p.type || "Unknown", cls: "text-gray-400 bg-white/5 border-white/10" };
                  return (
                    <div
                      key={p.id}
                      className="bg-[#21233d] border border-white/5 rounded-2xl p-4 flex items-start gap-4 hover:border-purple-500/20 transition-all group"
                    >
                      {/* Avatar */}
                      {p.authorAvatar ? (
                        <img
                          src={p.authorAvatar}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0 mt-0.5"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#1a1c2e] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                      )}

                      {/* Body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {p.title || p.description || "Untitled Post"}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              by{" "}
                              <span className="text-gray-300 font-medium">{p.authorName || "Unknown"}</span>
                              {p.authorUsername && (
                                <span className="text-gray-600"> @{p.authorUsername}</span>
                              )}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border ${typeInfo.cls}`}
                          >
                            {typeInfo.label}
                          </span>
                        </div>

                        {/* Description (if separate from title) */}
                        {p.title && p.description && (
                          <p className="text-xs text-gray-400 mt-2 leading-relaxed line-clamp-2">{p.description}</p>
                        )}

                        {/* Footer meta */}
                        <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-600">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {p.commentsCount ?? 0} comments
                          </span>
                          {p.likesCount != null && (
                            <span>❤ {p.likesCount} likes</span>
                          )}
                          <span className="ml-auto font-mono">{safeDate(p.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      // ── Analysis ───────────────────────────────────────────────────────
      case "Analysis": {
        // ── Date helpers ──────────────────────────────────────────────────
        const parseAnyDate = (val: any): Date | null => {
          if (!val) return null;
          try {
            if (val._seconds) return new Date(val._seconds * 1000);
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
          } catch { return null; }
        };

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6);
        const monthStart = new Date(todayStart); monthStart.setDate(monthStart.getDate() - 29);

        const inRange = (val: any, from: Date) => {
          const d = parseAnyDate(val);
          return d !== null && d >= from;
        };

        // ── Filter per period ─────────────────────────────────────────────
        const dailyUsers = users.filter(u => inRange(u.createdAt, todayStart));
        const weeklyUsers = users.filter(u => inRange(u.createdAt, weekStart));
        const monthlyUsers = users.filter(u => inRange(u.createdAt, monthStart));

        const dailyTeams = teams.filter(t => inRange(t.createdAt, todayStart));
        const weeklyTeams = teams.filter(t => inRange(t.createdAt, weekStart));
        const monthlyTeams = teams.filter(t => inRange(t.createdAt, monthStart));

        const dailyPosts = posts.filter(p => inRange(p.createdAt, todayStart));
        const weeklyPosts = posts.filter(p => inRange(p.createdAt, weekStart));
        const monthlyPosts = posts.filter(p => inRange(p.createdAt, monthStart));

        // ── Chart data builders ───────────────────────────────────────────
        // Daily: group by hour (show all 24h, non-zero only if any activity)
        const dailyChartData = (() => {
          const hours = Array.from({ length: 24 }, (_, h) => {
            const u = dailyUsers.filter(x => { const d = parseAnyDate(x.createdAt); return d && d.getHours() === h; }).length;
            const t = dailyTeams.filter(x => { const d = parseAnyDate(x.createdAt); return d && d.getHours() === h; }).length;
            const p = dailyPosts.filter(x => { const d = parseAnyDate(x.createdAt); return d && d.getHours() === h; }).length;
            return { name: `${h}h`, Users: u, Teams: t, Posts: p };
          });
          const hasAny = hours.some(h => h.Users > 0 || h.Teams > 0 || h.Posts > 0);
          // If nothing today, show a single placeholder bar so chart isn't empty
          return hasAny ? hours.filter(h => h.Users > 0 || h.Teams > 0 || h.Posts > 0) :
            [{ name: 'Today', Users: 0, Teams: 0, Posts: 0 }];
        })();

        // Weekly: one bar per day for last 7 days
        const weeklyChartData = Array.from({ length: 7 }, (_, i) => {
          const day = new Date(weekStart); day.setDate(day.getDate() + i);
          const key = format(day, 'yyyy-MM-dd');
          const label = format(day, 'EEE d');
          const sameDay = (val: any) => { const d = parseAnyDate(val); return d && format(d, 'yyyy-MM-dd') === key; };
          return {
            name: label,
            Users: weeklyUsers.filter(u => sameDay(u.createdAt)).length,
            Teams: weeklyTeams.filter(t => sameDay(t.createdAt)).length,
            Posts: weeklyPosts.filter(p => sameDay(p.createdAt)).length,
          };
        });

        // Monthly: group into 4 weeks
        const monthlyChartData = Array.from({ length: 4 }, (_, i) => {
          const wStart = new Date(monthStart); wStart.setDate(wStart.getDate() + i * 7);
          const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 7);
          const inWeek = (val: any) => { const d = parseAnyDate(val); return d && d >= wStart && d < wEnd; };
          return {
            name: `Week ${i + 1}\n${format(wStart, 'MMM d')}`,
            Users: monthlyUsers.filter(u => inWeek(u.createdAt)).length,
            Teams: monthlyTeams.filter(t => inWeek(t.createdAt)).length,
            Posts: monthlyPosts.filter(p => inWeek(p.createdAt)).length,
          };
        });

        // ── Activity type badge styles (all types) ────────────────────────
        const activityBadge = (type: string) => {
          const map: Record<string, string> = {
            user_post: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
            team_created: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
            team_completed: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
            member_joined: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
            member_left: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
          };
          return map[type] || 'bg-white/5 text-gray-400 border-white/10';
        };

        // ── CSV Download ──────────────────────────────────────────────────
        const downloadCSV = (period: string, uData: any[], tData: any[], pData: any[]) => {
          const sep = ',';
          const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
          const lines: string[] = [
            `TeamUp ${period} Analysis Report`,
            `Generated: ${format(new Date(), 'PPPp')}`,
            `Period: ${period}`,
            ``,
            `=== NEW USERS (${uData.length}) ===`,
            ['Name', 'Email', 'Username', 'Role', 'Joined'].map(q).join(sep),
            ...uData.map(u => [u.fullName, u.email, u.username, u.role, u.createdAt].map(q).join(sep)),
            ``,
            `=== NEW TEAMS (${tData.length}) ===`,
            ['Team Name', 'Leader', 'Members', 'Status', 'City', 'Created'].map(q).join(sep),
            ...tData.map(t => [t.name, t.leaderName, t.members?.length ?? 0, t.status, t.city, safeDate(t.createdAt)].map(q).join(sep)),
            ``,
            `=== ACTIVITIES / POSTS (${pData.length}) ===`,
            ['Title/Description', 'Author', 'Type', 'Comments', 'Date'].map(q).join(sep),
            ...pData.map(p => [p.title || p.description, p.authorName, p.type, p.commentsCount ?? 0, safeDate(p.createdAt)].map(q).join(sep)),
          ];
          const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `teamup_${period.toLowerCase()}_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        };

        // ── PDF Download (print-to-PDF via styled new window) ────────────
        const downloadPDF = (period: string, uData: any[], tData: any[], pData: any[]) => {
          const typeLabel = (t: string) => (t || 'post').replace(/_/g, ' ');
          const row = (...cells: string[]) =>
            `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
            <title>TeamUp ${period} Report</title>
            <style>
              *{box-sizing:border-box;margin:0;padding:0}
              body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111;padding:48px}
              h1{font-size:22px;color:#7c3aed;margin-bottom:4px}
              .meta{color:#6b7280;font-size:12px;margin-bottom:32px}
              h2{font-size:14px;font-weight:700;color:#374151;border-bottom:2px solid #f3f4f6;padding-bottom:6px;margin:28px 0 10px}
              table{width:100%;border-collapse:collapse;font-size:12px}
              th{background:#f9fafb;text-align:left;padding:7px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid #e5e7eb}
              td{padding:7px 10px;border-bottom:1px solid #f3f4f6;color:#374151}
              tr:last-child td{border-bottom:none}
              .badge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;background:#f3f4f6;color:#374151}
              .stats{display:flex;gap:16px;margin-bottom:24px}
              .stat{flex:1;background:#f9fafb;border-radius:10px;padding:14px;text-align:center}
              .stat-n{font-size:28px;font-weight:800;color:#7c3aed}
              .stat-l{font-size:11px;color:#6b7280;margin-top:2px}
              @media print{body{padding:24px}}
            </style></head><body>
            <h1>TeamUp ${period} Analysis Report</h1>
           <p class="meta">Generated: ${format(new Date(), 'PPPp')} &nbsp;|&nbsp; Period: ${period}</p>
            <div class="stats">
              <div class="stat"><div class="stat-n">${uData.length}</div><div class="stat-l">New Users</div></div>
              <div class="stat"><div class="stat-n" style="color:#10b981">${tData.length}</div><div class="stat-l">New Teams</div></div>
              <div class="stat"><div class="stat-n" style="color:#f59e0b">${pData.length}</div><div class="stat-l">Activities</div></div>
            </div>
            <h2>New Users (${uData.length})</h2>
            <table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Username</th><th>Role</th><th>Joined</th></tr></thead><tbody>
            ${uData.map((u, i) => row(`${i + 1}`, u.fullName || '—', u.email || '—', u.username ? '@' + u.username : '—', u.role || '—', u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—')).join('')}
            </tbody></table>
            <h2>New Teams (${tData.length})</h2>
            <table><thead><tr><th>#</th><th>Team</th><th>Leader</th><th>Members</th><th>Status</th><th>City</th></tr></thead><tbody>
            ${tData.map((t, i) => row(`${i + 1}`, t.name || '—', t.leaderName || '—', `${t.members?.length ?? 0}`, t.status || '—', t.city || '—')).join('')}
            </tbody></table>
            <h2>All Activities (${pData.length})</h2>
            <table><thead><tr><th>#</th><th>Title / Description</th><th>Author</th><th>Type</th><th>Date</th></tr></thead><tbody>
            ${pData.map((p, i) => row(`${i + 1}`, p.title || p.description || '—', p.authorName || '—', `<span class="badge">${typeLabel(p.type)}</span>`, safeDate(p.createdAt))).join('')}
            </tbody></table>
            </body></html>`;
          const win = window.open('', '_blank', 'width=900,height=700');
          if (!win) return;
          win.document.write(html);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 600);
        };

        // ── Section renderer ──────────────────────────────────────────────
        const renderAnalysisSection = (
          title: string,
          subtitle: string,
          chartData: any[],
          uData: any[],
          tData: any[],
          pData: any[],
          period: string,
        ) => (
          <div className="bg-[#21233d] rounded-3xl border border-white/5 overflow-hidden">
            <style>{`
              .analysis-scroll::-webkit-scrollbar{width:3px}
              .analysis-scroll::-webkit-scrollbar-track{background:transparent}
              .analysis-scroll::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.35);border-radius:99px}
              .analysis-scroll::-webkit-scrollbar-thumb:hover{background:rgba(139,92,246,0.65)}
            `}</style>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div>
                <h3 className="font-bold text-base">{title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadCSV(period, uData, tData, pData)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-purple-600/15 text-gray-400 hover:text-purple-300 text-xs font-bold transition-all border border-white/[0.06] hover:border-purple-500/20"
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
                <button
                  onClick={() => downloadPDF(period, uData, tData, pData)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-600/15 text-gray-400 hover:text-rose-300 text-xs font-bold transition-all border border-white/[0.06] hover:border-rose-500/20"
                >
                  <FileText className="w-3 h-3" /> PDF
                </button>
              </div>
            </div>

            {/* Stat pills */}
            <div className="grid grid-cols-3 gap-3 px-6 pb-5">
              <div className="rounded-2xl p-4 text-center bg-purple-500/10">
                <p className="text-2xl font-bold text-purple-400">{uData.length}</p>
                <p className="text-[11px] text-gray-400 mt-1">New Users</p>
              </div>
              <div className="rounded-2xl p-4 text-center bg-emerald-500/10">
                <p className="text-2xl font-bold text-emerald-400">{tData.length}</p>
                <p className="text-[11px] text-gray-400 mt-1">New Teams</p>
              </div>
              <div className="rounded-2xl p-4 text-center bg-amber-500/10">
                <p className="text-2xl font-bold text-amber-400">{pData.length}</p>
                <p className="text-[11px] text-gray-400 mt-1">Activities</p>
              </div>
            </div>

            {/* Chart */}
            <div className="px-6 pb-6">
              <p className="text-[10px] text-gray-600 uppercase font-bold mb-3 tracking-wider">Activity Breakdown</p>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={chartData} barSize={10} barGap={3} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} dy={6} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1c2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }} itemStyle={{ color: '#e5e7eb' }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }} />
                  <Bar dataKey="Users" name="Users" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Teams" name="Teams" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Posts" name="Activities" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detail lists — ALL items, no truncation, thin scrollbar */}
            {(uData.length > 0 || tData.length > 0 || pData.length > 0) && (
              <div className="border-t border-white/[0.04] px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-5">

                {/* Users */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-2.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
                    New Users ({uData.length})
                  </p>
                  <div
                    className="analysis-scroll space-y-1.5 overflow-y-auto pr-2"
                    style={{ maxHeight: '11rem', scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.35) transparent' }}
                  >
                    {uData.length === 0 ? (
                      <p className="text-gray-600 text-xs italic">None in this period</p>
                    ) : uData.map((u, i) => (
                      <div key={i} className="flex items-center gap-2 py-0.5">
                        {u.avatar ? (
                          <img src={u.avatar} className="w-6 h-6 rounded-full object-cover border border-white/10 shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 text-[9px] font-bold text-purple-300">
                            {(u.fullName || u.email || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs text-gray-200 truncate leading-tight">{u.fullName || '—'}</p>
                          <p className="text-[10px] text-gray-600 truncate leading-tight">{u.email || ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Teams */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-2.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    New Teams ({tData.length})
                  </p>
                  <div
                    className="analysis-scroll space-y-1.5 overflow-y-auto pr-2"
                    style={{ maxHeight: '11rem', scrollbarWidth: 'thin', scrollbarColor: 'rgba(16,185,129,0.35) transparent' }}
                  >
                    {tData.length === 0 ? (
                      <p className="text-gray-600 text-xs italic">None in this period</p>
                    ) : tData.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 py-0.5">
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0 text-emerald-300 font-bold text-[10px] border border-emerald-500/20">
                          {(t.name || 'T')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-200 truncate leading-tight">{t.name || 'Unnamed'}</p>
                          <p className="text-[10px] text-gray-600 truncate leading-tight">{t.leaderName ? `by ${t.leaderName}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activities — all types, color-coded badges */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-2.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    All Activities ({pData.length})
                  </p>
                  <div
                    className="analysis-scroll space-y-1.5 overflow-y-auto pr-2"
                    style={{ maxHeight: '11rem', scrollbarWidth: 'thin', scrollbarColor: 'rgba(245,158,11,0.35) transparent' }}
                  >
                    {pData.length === 0 ? (
                      <p className="text-gray-600 text-xs italic">None in this period</p>
                    ) : pData.map((p, i) => (
                      <div key={i} className="flex items-start gap-2 py-0.5">
                        <span className={`shrink-0 mt-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${activityBadge(p.type)}`}>
                          {(p.type || 'post').replace(/_/g, ' ')}
                        </span>
                        <p className="text-xs text-gray-300 truncate">{p.title || p.description || 'Activity'}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        );

        return (
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Analysis</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Platform-wide analytics · users, teams &amp; activities
                </p>
              </div>
              <button
                onClick={fetchFullData}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 transition-all"
              >
                ↻ Refresh Data
              </button>
            </div>

            {/* Monthly — first */}
            {renderAnalysisSection(
              'Monthly Analysis',
              `Last 30 days — ${format(monthStart, 'MMM d')} to ${format(now, 'MMM d, yyyy')}`,
              monthlyChartData,
              monthlyUsers, monthlyTeams, monthlyPosts,
              'Monthly',
            )}

            {/* Weekly */}
            {renderAnalysisSection(
              'Weekly Analysis',
              `Last 7 days — ${format(weekStart, 'MMM d')} to ${format(now, 'MMM d, yyyy')}`,
              weeklyChartData,
              weeklyUsers, weeklyTeams, weeklyPosts,
              'Weekly',
            )}

            {/* Daily — last */}
            {renderAnalysisSection(
              'Daily Analysis',
              `Today — ${format(new Date(), 'MMMM d, yyyy')}`,
              dailyChartData,
              dailyUsers, dailyTeams, dailyPosts,
              'Daily',
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-[#15172b] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar — fixed height, never scrolls */}
      <aside className="w-60 bg-[#1e2038] border-r border-white/[0.06] flex flex-col shrink-0 h-screen overflow-hidden">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-bold tracking-tight">TeamUp Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {[
            { id: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, badge: null },
            { id: "Analysis", icon: <TrendingUp className="w-4 h-4" />, badge: null },
            { id: "Users", icon: <Users className="w-4 h-4" />, badge: users.length > 0 ? users.length : null },
            { id: "Teams", icon: <Users2 className="w-4 h-4" />, badge: teams.length > 0 ? teams.length : null },
            { id: "Skill Verifications", icon: <CheckCircle className="w-4 h-4" />, badge: verifications.filter(v => v.status === "verified").length > 0 ? verifications.filter(v => v.status === "verified").length : null },
            { id: "Reports", icon: <AlertCircle className="w-4 h-4" />, badge: reports.filter(r => r.status === "pending").length > 0 ? reports.filter(r => r.status === "pending").length : null },
            { id: "Posts", icon: <FileText className="w-4 h-4" />, badge: posts.length > 0 ? posts.length : null },
            { id: "Settings", icon: <Settings className="w-4 h-4" />, badge: null },
          ].map(({ id, icon, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === id
                  ? "bg-purple-600/15 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
            >
              <div className="flex items-center gap-3">
                {icon}
                {id}
              </div>
              {badge != null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === id ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400"
                  }`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-white/5 hover:text-white text-sm transition-all">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main — scrolls independently */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-[#15172b]/80 backdrop-blur border-b border-white/[0.06] flex items-center justify-between px-8 shrink-0">
          <h1 className="text-lg font-semibold capitalize">{activeTab}</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#1e2038] border border-white/[0.06] rounded-full py-1.5 pl-9 pr-4 w-56 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/40 text-gray-300 placeholder-gray-600"
              />
            </div>
            <div className="flex items-center gap-2.5 bg-[#1e2038] px-3 py-1.5 rounded-full border border-white/[0.06]">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Shield className="w-3 h-3 text-purple-400" />
              </div>
              <span className="text-sm text-gray-300">{adminProfile.fullName}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="space-y-3 text-center">
                <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500">Loading admin data…</p>
              </div>
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </main>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const StatCard = ({ title, value, sub, color, icon }: any) => {
  const colors: Record<string, string> = {
    purple: "from-purple-500/15 to-purple-500/0 border-purple-500/10",
    emerald: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/10",
    amber: "from-amber-500/15 to-amber-500/0 border-amber-500/10",
    rose: "from-rose-500/15 to-rose-500/0 border-rose-500/10",
  };
  const iconColors: Record<string, string> = {
    purple: "bg-purple-500/10 text-purple-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    rose: "bg-rose-500/10 text-rose-400",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} bg-[#21233d] rounded-3xl p-5 border hover:-translate-y-0.5 transition-all duration-200`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${iconColors[color]}`}>
        {icon}
      </div>
      <p className="text-gray-500 text-xs font-medium mb-0.5">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-[11px] text-gray-600 mt-1">{sub}</p>
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[#1a1c2e] rounded-xl p-3 border border-white/5">
    <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">{label}</p>
    <p className="text-sm text-gray-200">{value}</p>
  </div>
);

export default AdminPanel;