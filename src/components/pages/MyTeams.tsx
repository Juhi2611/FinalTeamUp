import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import {
  MoreVertical, FolderKanban, Folder, Users, BarChart3,
  Sparkles, Settings, Edit, CheckCircle, LogOut, Trash2,
  Loader2, Plus, Crown, AlertTriangle, MapPin, Target
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import EditTeam from './EditTeam';
import {
  subscribeToUserTeams, subscribeToTeamMembers, subscribeToJoinRequests,
  getAvailableUsers, removeTeamMember, terminateTeam, respondToInvitation,
  Team, TeamMember, UserProfile, Invitation
} from '@/services/firestore';
import { declareTeamComplete, updateTeamTimeline } from '@/services/firestore';
import TeamManagementPanel from '../TeamManagementPanel';
import { isFirebaseConfigured } from '@/lib/firebase';
import { getTeamRecommendations } from '@/services/geminiService';
import { toast } from 'sonner';
import TeamProgressPanel from '@/components/TeamProgressPanel';
import ProjectTimeline, { DEFAULT_STAGES, ProjectStage } from '@/components/ProjectTimeline';
import DemoLockModal from "@/components/DemoLockModal";
import StarRating from '@/components/StarRating';
import { rateMember } from '@/services/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { getCityById } from '@/utils/cityData';
import { cn } from '@/lib/utils';
import { createPortal } from "react-dom";

interface MyTeamsProps {
  onNavigate: (page: string) => void;
  onViewWorkspace?: (teamId: string) => void;
  onViewProfile?: (userId: string) => void;
  onViewFiles?: (teamId: string) => void;
  openAuth: () => void;
  onViewDashboard?: (teamId: string) => void;
}

interface TeamWithMembers extends Team {
  loadedMembers: (TeamMember & { profile: UserProfile | null })[];
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  forming: {
    label: 'Forming',
    dot: 'bg-accent',
    badge: 'bg-accent/10 text-accent border-accent/20',
    bar: 'from-accent to-accent/60',
  },
  active: {
    label: 'Active',
    dot: 'bg-skill-mobile',
    badge: 'bg-skill-mobile/10 text-skill-mobile border-skill-mobile/20',
    bar: 'from-primary to-cyan-400',
  },
  complete: {
    label: 'Complete',
    dot: 'bg-muted-foreground/40',
    badge: 'bg-muted text-muted-foreground border-border',
    bar: 'from-muted-foreground/40 to-muted-foreground/20',
  },
} as const;

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.forming;
}

// ─── MyTeams ─────────────────────────────────────────────────────────────────

const MyTeams = ({ onNavigate, onViewWorkspace, onViewProfile, onViewFiles, openAuth, onViewDashboard }: MyTeamsProps) => {
  const [openRecommendationTeamId, setOpenRecommendationTeamId] = useState<string | null>(null);
  const { isDemoUser } = useAuth();
  const blockDemo = () => { if (isDemoUser) { setShowDemoLock(true); return true; } return false; };
  const [showDemoLock, setShowDemoLock] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'forming' | 'active' | 'complete'>('all');
  const [recommendationsByTeam, setRecommendationsByTeam] = useState<Record<string, any>>({});
  const [loadingRecommendationsByTeam, setLoadingRecommendationsByTeam] = useState<Record<string, boolean>>({});
  const [joinRequests, setJoinRequests] = useState<Invitation[]>([]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<string | null>(null);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showProgress, setShowProgress] = useState<string | null>(null);
  const [showRatingTeam, setShowRatingTeam] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    if (!showRatingTeam || !user) return;
    const fetchRatings = async () => {
      const team = teams.find(t => t.id === showRatingTeam);
      if (!team) return;
      const newRatings: Record<string, number> = {};
      for (const member of team.loadedMembers) {
        const ratingId = `${team.id}_${user.uid}_${member.userId}`;
        const snap = await getDoc(doc(db, 'ratings', ratingId));
        if (snap.exists()) newRatings[member.userId] = snap.data().rating;
      }
      setRatings(newRatings);
    };
    fetchRatings();
  }, [showRatingTeam, user, teams]);

  const [showTeamManagement, setShowTeamManagement] = useState<string | null>(null);

  const handleDeclareComplete = async (teamId: string) => {
    if (!user) return;
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, status: 'complete' } : t));
    try {
      await declareTeamComplete(teamId, user.uid);
      toast.success('Team marked as complete');
    } catch {
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, status: 'active' } : t));
      toast.error('Failed to declare team complete');
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) { setLoading(false); return; }
    const memberUnsubscribers = new Map<string, () => void>();
    const unsubscribe = subscribeToUserTeams(user.uid, async (userTeams) => {
      const currentTeamIds = new Set(userTeams.map(t => t.id));
      memberUnsubscribers.forEach((unsub, teamId) => {
        if (!currentTeamIds.has(teamId)) { unsub(); memberUnsubscribers.delete(teamId); }
      });
      setTeams(prevTeams => {
        const prevTeamIds = new Set(prevTeams.map(t => t.id));
        const hasChanged = prevTeamIds.size !== currentTeamIds.size || Array.from(prevTeamIds).some(id => !currentTeamIds.has(id));
        if (!hasChanged) return prevTeams;
        return [];
      });
      userTeams.forEach((team) => {
        if (!memberUnsubscribers.has(team.id)) {
          const unsubMembers = subscribeToTeamMembers(team.id, (members) => {
            setTeams(prevTeams => {
              const updated = prevTeams.map(t => t.id === team.id ? { ...t, loadedMembers: members } : t);
              if (!updated.find(t => t.id === team.id)) updated.push({ ...team, loadedMembers: members });
              return updated;
            });
          });
          memberUnsubscribers.set(team.id, unsubMembers);
        }
      });
      setLoading(false);
      userTeams.forEach(team => {
        if (team.leaderId === user.uid) subscribeToJoinRequests(team.id, setJoinRequests);
      });
    });
    return () => { unsubscribe(); memberUnsubscribers.forEach(unsub => unsub()); };
  }, [user]);

  const loadRecommendations = async (team: TeamWithMembers) => {
    setLoadingRecommendationsByTeam(prev => ({ ...prev, [team.id]: true }));
    try {
      const availableUsers = await getAvailableUsers(user?.uid);
      const currentMembers = team.loadedMembers.map(m => ({ role: m.role, userId: m.userId }));
      const recs = await getTeamRecommendations(team, currentMembers, availableUsers);
      setRecommendationsByTeam(prev => ({ ...prev, [team.id]: recs }));
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
    setLoadingRecommendationsByTeam(prev => ({ ...prev, [team.id]: false }));
  };

  const handleLeaveTeam = async (teamId: string) => {
    if (!user) return;
    setActionLoading(true);
    setTeams(prevTeams => prevTeams.filter(t => t.id !== teamId));
    setShowLeaveConfirm(null);
    try {
      await removeTeamMember(teamId, user.uid);
      toast.success('You have left the team');
    } catch (error: any) {
      toast.error(error.message || 'Failed to leave team');
    }
    setActionLoading(false);
  };

  const handleTerminateTeam = async (teamId: string) => {
    if (!user) return;
    setActionLoading(true);
    setTeams(prevTeams => prevTeams.filter(t => t.id !== teamId));
    setShowTerminateConfirm(null);
    try {
      await terminateTeam(teamId, user.uid);
      toast.success('Team terminated successfully');
    } catch {
      toast.success('Team terminated successfully');
    }
    setActionLoading(false);
  };

  const handleRespondToJoinRequest = async (request: Invitation, status: 'accepted' | 'rejected') => {
    setActionLoading(true);
    try {
      await respondToInvitation(request.id, status);
      toast.success(status === 'accepted' ? `${request.fromUserName} has joined the team!` : 'Request declined');
    } catch (error: any) {
      toast.error(error.message || 'Failed to respond to request');
    }
    setActionLoading(false);
  };

  const filteredTeams = statusFilter === 'all' ? teams : teams.filter(t => t.status === statusFilter);
  const statusCounts = {
    all: teams.length,
    forming: teams.filter(t => t.status === 'forming').length,
    active: teams.filter(t => t.status === 'active').length,
    complete: teams.filter(t => t.status === 'complete').length,
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
    </div>
  );

  if (editingTeamId) return (
    <EditTeam
      teamId={editingTeamId}
      onNavigate={onNavigate}
      openAuth={openAuth}
      onBack={() => setEditingTeamId(null)}
      onTeamUpdated={(updatedTeam) => {
        setTeams(prevTeams => prevTeams.map(t => t.id === updatedTeam.id ? { ...t, ...updatedTeam } : t));
      }}
    />
  );

  return (
    <div className="space-y-5">

      {/* ═══ HEADER ═══ */}
      <div className="card-base p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <FolderKanban className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-foreground">My Teams</h1>
              <p className="text-xs text-muted-foreground">Manage your hackathon teams</p>
            </div>
          </div>
          <button onClick={() => onNavigate('build')} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> New Team
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="segment-control mt-4">
          {(['all', 'forming', 'active', 'complete'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn('segment-control-item', statusFilter === status && 'active')}
            >
              {status === 'all' ? 'All' : STATUS_CONFIG[status].label}
              {statusCounts[status] > 0 && (
                <span className={cn(
                  'ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full',
                  statusFilter === status ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {statusCounts[status]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ JOIN REQUESTS BANNER ═══ */}
      {joinRequests.length > 0 && (
        <div className="card-base p-5 border-l-4 border-accent">
          <h2 className="font-display font-bold text-base text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            Join Requests
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent font-semibold">{joinRequests.length}</span>
          </h2>
          <div className="space-y-2">
            {joinRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/50">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(request.fromUserName)}`}
                    alt={request.fromUserName}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{request.fromUserName}</p>
                    <p className="text-xs text-muted-foreground truncate">{request.message || 'Wants to join your team'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <button
                    onClick={() => handleRespondToJoinRequest(request, 'rejected')}
                    disabled={actionLoading}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleRespondToJoinRequest(request, 'accepted')}
                    disabled={actionLoading}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TEAM CARDS GRID ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredTeams.map((team) => {
          const isLeader = team.leaderId === user?.uid;
          const isCompleted = team.status === 'complete';
          const progressPercent = Math.round((team.loadedMembers.length / team.maxMembers) * 100);
          const cfg = getStatusCfg(team.status);
          const cityName = getCityById(team.city || '')?.name || team.city;

          return (
            <div
              key={team.id}
              className="card-base group relative overflow-hidden cursor-pointer hover:border-primary/30 transition-all duration-200 hover:shadow-md"
              onClick={() => navigate(`/team/${team.id}/dashboard`)}
            >
              {/* Status accent bar */}
              <div className={`h-[3px] w-full bg-gradient-to-r from-primary via-cyan-400 to-blue-500`} />

              <div className="p-4 pt-4">

                {/* ── Header row: name + status + menu ── */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex-1 min-w-0">
                    {/* Name + leader badge */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="font-display font-bold text-base text-foreground truncate leading-tight">{team.name}</h3>
                      {isLeader && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-accent/10 text-accent flex-shrink-0">
                          <Crown className="w-2.5 h-2.5" /> Leader
                        </span>
                      )}
                    </div>
                    {/* Status pill */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Three-dot menu */}
                  <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenu(openMenu === team.id ? null : team.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenu === team.id && (() => {
                      const rect = (document.activeElement as HTMLElement)?.getBoundingClientRect();
                      return createPortal(
                        <div
                          className="fixed z-[9999] w-52 bg-card border border-border rounded-xl shadow-lg py-1"
                          style={{ top: (rect?.bottom ?? 0) + 8, left: (rect?.right ?? 0) - 208 }}
                        >
                          <button onClick={() => { setOpenMenu(null); onViewWorkspace?.(team.id); }} className="menu-item"><FolderKanban className="w-4 h-4" /> View Workspace</button>
                          <button onClick={() => { setOpenMenu(null); navigate(`/team/${team.id}/dashboard`); }} className="menu-item"><BarChart3 className="w-4 h-4" /> View Dashboard</button>
                          <button onClick={() => { setOpenMenu(null); navigate(`/teams/${team.id}/files`); }} className="menu-item"><Folder className="w-4 h-4" /> View Files</button>
                          <button onClick={() => { setOpenMenu(null); setShowProgress(team.id); }} className="menu-item"><BarChart3 className="w-4 h-4" /> Progress</button>
                          {!isCompleted && (
                            <>
                              <button onClick={() => { setOpenMenu(null); sessionStorage.setItem('inviteForTeamId', team.id); sessionStorage.setItem('inviteForTeamName', team.name); onNavigate('discover'); }} className="menu-item"><Users className="w-4 h-4" /> Find Teammates</button>
                              <button onClick={() => { setOpenMenu(null); setOpenRecommendationTeamId(team.id); loadRecommendations(team); }} className="menu-item"><Sparkles className="w-4 h-4" /> AI Suggestions</button>
                            </>
                          )}
                          <button onClick={() => { setOpenMenu(null); setShowTeamManagement(team.id); }} className="menu-item"><Settings className="w-4 h-4" /> Team Management</button>
                          {isLeader && isCompleted && <button onClick={() => { setOpenMenu(null); setShowRatingTeam(team.id); }} className="menu-item">⭐ Rate Members</button>}
                          {isLeader && <button onClick={() => { setOpenMenu(null); if (!blockDemo()) setEditingTeamId(team.id); }} className="menu-item"><Edit className="w-4 h-4" /> Edit Team</button>}
                          {isLeader && !isCompleted && <button onClick={() => { setOpenMenu(null); if (!blockDemo()) handleDeclareComplete(team.id); }} className="menu-item text-skill-mobile"><CheckCircle className="w-4 h-4" /> Declare Complete</button>}
                          {!isLeader && <button onClick={() => { setOpenMenu(null); if (!blockDemo()) setShowLeaveConfirm(team.id); }} className="menu-item text-destructive hover:bg-destructive/10"><LogOut className="w-4 h-4" /> Leave Team</button>}
                          {isLeader && <button onClick={() => { setOpenMenu(null); if (!blockDemo()) setShowTerminateConfirm(team.id); }} className="menu-item text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /> Terminate Team</button>}
                        </div>,
                        document.body
                      );
                    })()}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">{team.description}</p>

                {/* Meta chips: hackathon + city */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {team.hackathon && (
                    <span className="flex items-center gap-1 text-[11px] text-primary bg-primary/6 px-2 py-0.5 rounded-md border border-primary/12 font-medium">
                      <Target className="w-3 h-3" />{team.hackathon}
                    </span>
                  )}
                  {cityName && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-md border border-border/50">
                      <MapPin className="w-3 h-3" />{cityName}
                    </span>
                  )}
                </div>

                {/* Roles needed */}
                {team.rolesNeeded && team.rolesNeeded.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {team.rolesNeeded.slice(0, 3).map((role, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/8 text-primary border border-primary/12">
                        {role}
                      </span>
                    ))}
                    {team.rolesNeeded.length > 3 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                        +{team.rolesNeeded.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Members progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Members</span>
                    <span className="text-[10px] font-bold text-foreground">{team.loadedMembers.length} / {team.maxMembers}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--gradient-hero)] relative overflow-hidden"
                      style={{ width: `${progressPercent}%`, background: "var(--gradient-hero)" }}

                    >
                      <div className="absolute inset-0 opacity-30 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.6),transparent)] animate-[shine_2s_infinite]" />
                    </div>
                  </div>
                </div>

                {/* Member avatars + fill % */}
                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <div className="flex -space-x-2">
                    {team.loadedMembers.slice(0, 5).map((member) => (
                      <img
                        key={member.id}
                        src={
                          member.profile?.avatar
                            ? `${member.profile.avatar}?t=${member.profile.updatedAt instanceof Timestamp ? member.profile.updatedAt.toMillis() : ''}`
                            : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.profile?.fullName || 'User')}`
                        }
                        alt={member.profile?.fullName || 'Member'}
                        title={`${member.profile?.fullName} · ${member.role}`}
                        onClick={(e) => { e.stopPropagation(); onViewProfile?.(member.userId); }}
                        className="w-7 h-7 rounded-full border-2 border-card cursor-pointer hover:scale-110 transition-transform object-cover"
                      />
                    ))}
                    {team.loadedMembers.length > 5 && (
                      <div className="w-7 h-7 rounded-full border-2 border-card bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        +{team.loadedMembers.length - 5}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-primary">{progressPercent}% full</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ EMPTY STATE ═══ */}
      {filteredTeams.length === 0 && (
        <div className="card-base p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-primary/50" />
          </div>
          <h3 className="font-display font-bold text-lg text-foreground mb-2">
            {statusFilter === 'all' ? 'No teams yet' : `No ${statusFilter} teams`}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            {statusFilter === 'all'
              ? 'Start your hackathon journey by creating a team or joining one'
              : `You don't have any teams with "${statusFilter}" status`}
          </p>
          {statusFilter === 'all' && (
            <div className="flex justify-center gap-3">
              <button onClick={() => { if (blockDemo()) return; onNavigate('build'); }} className="btn-primary">Create a Team</button>
              <button onClick={() => onNavigate('discover-teams')} className="btn-secondary">Find a Team</button>
            </div>
          )}
        </div>
      )}

      {/* ═══ AI RECOMMENDATIONS OVERLAY ═══ */}
      {openRecommendationTeamId && (
        <div className="modal-overlay" onClick={() => setOpenRecommendationTeamId(null)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="font-display font-bold text-lg">AI Recommendations</h3>
              </div>
              <button onClick={() => setOpenRecommendationTeamId(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors text-xs">✕</button>
            </div>
            {loadingRecommendationsByTeam?.[openRecommendationTeamId] ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading AI suggestions…</span>
              </div>
            ) : recommendationsByTeam[openRecommendationTeamId] ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{recommendationsByTeam[openRecommendationTeamId].explanation}</p>
                {recommendationsByTeam[openRecommendationTeamId].missingRoles?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">Missing Roles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recommendationsByTeam[openRecommendationTeamId].missingRoles.map((role: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent border border-accent/20">{role}</span>
                      ))}
                    </div>
                  </div>
                )}
                {recommendationsByTeam[openRecommendationTeamId].recommendedUsers?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">Recommended People</p>
                    <div className="space-y-2">
                      {recommendationsByTeam[openRecommendationTeamId].recommendedUsers.map((rec: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50">
                          <img
                            src={rec.user.avatar ? `${rec.user.avatar}?t=${rec.user.updatedAt instanceof Timestamp ? rec.user.updatedAt.toMillis() : ''}` : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(rec.user.fullName || 'User')}`}
                            alt={rec.user.fullName}
                            className="w-9 h-9 rounded-full flex-shrink-0 object-cover"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{rec.user.fullName}</p>
                            <p className="text-xs text-muted-foreground truncate">{rec.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Leave confirm */}
      {showLeaveConfirm && (
        <div className="modal-overlay" onClick={() => setShowLeaveConfirm(null)}>
          <div className="modal-content animate-scale-in max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-destructive/10 flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-foreground">Leave Team?</h2>
                <p className="text-xs text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Are you sure you want to leave this team? You will need to request to join again if you change your mind.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowLeaveConfirm(null)} className="btn-secondary" disabled={actionLoading}>Cancel</button>
              <button onClick={() => handleLeaveTeam(showLeaveConfirm)} disabled={actionLoading} className="btn-primary bg-destructive hover:bg-destructive/90 flex items-center gap-2">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                Leave Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate confirm */}
      {showTerminateConfirm && (
        <div className="modal-overlay" onClick={() => setShowTerminateConfirm(null)}>
          <div className="modal-content animate-scale-in max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-destructive/10 flex-shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-foreground">Terminate Team?</h2>
                <p className="text-xs text-muted-foreground">This action is permanent</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">All members will be removed and the team will be deleted permanently.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowTerminateConfirm(null)} className="btn-secondary" disabled={actionLoading}>Cancel</button>
              <button onClick={() => handleTerminateTeam(showTerminateConfirm)} disabled={actionLoading} className="btn-primary bg-destructive hover:bg-destructive/90 flex items-center gap-2">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Terminate Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress modal */}
      {showProgress && (
        <div className="modal-overlay" onClick={() => setShowProgress(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {(() => {
              const team = teams.find(t => t.id === showProgress);
              if (!team) return null;
              return <TeamProgressPanel teamId={showProgress} members={team.loadedMembers} isLeader={team.leaderId === user?.uid} onClose={() => setShowProgress(null)} />;
            })()}
          </div>
        </div>
      )}

      {/* Rating modal */}
      {showRatingTeam && (
        <div className="modal-overlay" onClick={() => setShowRatingTeam(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-bold text-lg text-foreground mb-4">Rate Team Members</h2>
            {(() => {
              const team = teams.find(t => t.id === showRatingTeam);
              if (!team) return null;
              return (
                <div className="space-y-3">
                  {team.loadedMembers.map(member => {
                    if (member.userId === user?.uid) return null;
                    const submitRating = async (userId: string, rating: number, teamId: string) => {
                      if (!user) return;
                      try {
                        await rateMember(teamId, user.uid, userId, rating);
                        setRatings(prev => ({ ...prev, [userId]: rating }));
                        toast.success('Rating submitted');
                      } catch (error: any) {
                        toast.error(error.message || 'Failed');
                      }
                    };
                    return (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/50">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={member.profile?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.profile?.fullName || 'User')}`}
                            alt={member.profile?.fullName || ''}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <p className="text-sm font-medium text-foreground">{member.profile?.fullName}</p>
                        </div>
                        <StarRating rating={ratings[member.userId] || 0} onChange={(val) => submitRating(member.userId, val, team.id)} size="sm" />
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Team management modal */}
      {showTeamManagement && (
        <div className="modal-overlay" onClick={() => setShowTeamManagement(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const team = teams.find(t => t.id === showTeamManagement);
              if (!team) return null;
              return <TeamManagementPanel team={team} currentUserId={user!.uid} isLeader={team.leaderId === user?.uid} onClose={() => setShowTeamManagement(null)} />;
            })()}
          </div>
        </div>
      )}

      <DemoLockModal open={showDemoLock} onClose={() => setShowDemoLock(false)} onSignup={() => { setShowDemoLock(false); openAuth(); }} />
    </div>
  );
};

export default MyTeams;