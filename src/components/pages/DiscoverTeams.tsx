import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Users, Loader2, UserPlus, Filter, ChevronDown,
  MapPin, RotateCcw, Sparkles, Check, X, Eye, ChevronRight,
  Zap, BadgeCheck, Clock,
  Crown
} from 'lucide-react';
import { motion, useMotionValue, useTransform, animate, AnimatePresence, PanInfo } from "framer-motion";
import { useAuth } from '@/contexts/AuthContext';
import { useBlocks } from '@/contexts/BlockContext';
import {
  subscribeToAvailableTeams,
  getProfile,
  sendInvitation,
  getAvailableTeamCities,
  Team,
  UserProfile
} from '@/services/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { toast } from 'sonner';
import JoinTeamModal from '../JoinTeamModal';
import DemoLockModal from "@/components/DemoLockModal";
import ProjectTimeline, { DEFAULT_STAGES } from '@/components/ProjectTimeline';
import CitySelect from "@/components/ui/CitySelect";
import { normalizeCityString, getCityById } from "@/utils/cityData";
import InstitutionSelect from "@/components/ui/InstitutionSelect";
import { normalizeInstitutionString, getInstitutionById } from "@/utils/institutionData";
import { useInstitutionName } from "@/utils/useInstitutionName";

// ─── Team Swipe Card Component ──────────────────────────────────────────────

interface TeamSwipeCardProps {
  team: Team;
  index: number;
  total: number;
  active: boolean;
  onSwipe: (id: string, dir: "left" | "right") => void;
  onViewProfile: (userId: string) => void;
  onRequestJoin: (team: Team) => void;
}

function MemberAvatar({ userId, fallbackName, size = "w-9 h-9", isLeader = false }: {
  userId: string; fallbackName: string; size?: string; isLeader?: boolean
}) {
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      getProfile(userId).then(profile => setAvatar(profile?.avatar || null));
    }
  }, [userId]);

  return (
    <div className="relative group">
      <img
        src={avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackName)}`}
        className={`${size} rounded-full border-2 ${isLeader ? 'border-primary' : 'border-white'} shadow-sm bg-white object-cover transition-transform group-hover:scale-110`}
        alt={fallbackName}
      />
      {isLeader && (
        <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-0.5 shadow-sm">
          <Crown size={10} fill="currentColor" />
        </div>
      )}
    </div>
  );
}

function TeamSwipeCard({ team, index, total, active, onSwipe, onViewProfile, onRequestJoin }: TeamSwipeCardProps) {
  const collegeName = useInstitutionName(team.college);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-12, 12]);
  const connOp = useTransform(x, [40, 130], [0, 1]);
  const skipOp = useTransform(x, [-130, -40], [1, 0]);

  const STACK_GAP = 14;
  const STACK_SCALE = 0.045;
  const stackY = index * STACK_GAP;
  const stackSc = 1 - index * STACK_SCALE;
  const stackRot = index * 1.5 * (index % 2 === 0 ? 1 : -1);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const { offset, velocity } = info;
    const swX = Math.abs(offset.x) > 90 || Math.abs(velocity.x) > 400;
    if (swX && offset.x > 0) {
      animate(x, 700, { duration: 0.3 });
      setTimeout(() => onSwipe(team.id, "right"), 240);
    } else if (swX && offset.x < 0) {
      animate(x, -700, { duration: 0.3 });
      setTimeout(() => onSwipe(team.id, "left"), 240);
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  return (
    <motion.div
      style={{
        x: active ? x : 0,
        y: stackY,
        rotate: active ? rotate : stackRot,
        scale: stackSc,
        zIndex: total - index,
        position: "absolute",
        inset: 0,
      }}
      drag={active}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      animate={{ y: stackY, scale: stackSc, rotate: active ? 0 : stackRot }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className={`absolute inset-0 ${active ? "z-50 cursor-grab active:cursor-grabbing" : "z-0 pointer-events-none"}`}
    >
      <div
        className="w-full h-full rounded-3xl p-7 relative overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(240,253,250,0.80) 100%)",
          backdropFilter: "blur(20px)",
          border: "1.5px solid rgba(255,255,255,0.7)",
          boxShadow: "none",
        }}
      >
        <div className="relative z-10 flex flex-col h-full">
          {/* TOP SECTION: Branding & Score */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center text-white text-3xl font-black shadow-lg">
                {team.name ? team.name[0] : 'T'}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{team.name}</h2>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                    <Zap size={10} fill="currentColor" /> High Momentum
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                  </span>
                </div>
                <p className="text-sm font-bold text-cyan-600">{team.hackathon || "Innovation Project"}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-500 leading-relaxed mb-4 line-clamp-2">
            {team.description || "No description provided."}
          </p>

          {/* Roles Badges */}
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1 no-scrollbar">
            {team.rolesNeeded?.slice(0, 3).map((role, i) => (
              <span key={i} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100">
                <BadgeCheck size={14} fill="currentColor" className="text-blue-500" /> {role}
              </span>
            ))}
          </div>

          {/* MAIN CONTENT GRID */}
          <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
            {/* Left: "Why This Team?" Box */}
            <div className="col-span-7 bg-cyan-50/40 border border-cyan-100/50 rounded-2xl p-4">
              <p className="flex items-center gap-2 text-[10px] font-black text-cyan-700 uppercase tracking-widest mb-3">
                <Sparkles size={12} /> Why this team?
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Check size={14} className="text-cyan-600" /> {getCityById(team.city || '')?.name || team.city || "Ahmedabad Based"}
                </div>
                {collegeName && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Check size={14} className="text-cyan-600" /> {collegeName}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Users size={14} className="text-cyan-600" /> {team.members.length} Active Members
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Zap size={14} className="text-cyan-600" /> {team.maxMembers - team.members.length} Slots Open
                </div>
              </div>
            </div>

            {/* Right: Interactive Timeline Box */}
            <div className="col-span-5 bg-white/40 border border-slate-100 rounded-2xl p-4 flex flex-col overflow-hidden">
              <p className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tight mb-3">
                <Clock size={12} /> Project Timeline
              </p>
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {/* ✅ Integrating your ProjectTimeline component */}
                <ProjectTimeline
                  stages={DEFAULT_STAGES}
                  teamId={team.id}
                  compact
                />
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: Leader, Members & Action */}
          {active && (
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100/50">
              <div className="flex items-center gap-6">
                {/* 👑 PROJECT LEADER SECTION */}
                <div className="flex items-center gap-2.5 pr-4 border-r border-slate-200">
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewProfile(team.leaderId); }}
                    className="flex items-center gap-2.5 pr-4 border-r border-slate-200"
                  >
                    {/* ✅ Use the helper to fetch the leader's actual avatar */}
                    <MemberAvatar
                      userId={team.leaderId}
                      fallbackName={team.leaderName}
                      size="w-10 h-10"
                      isLeader={true}
                    />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400 leading-none text-left">Founder</p>
                      <p className="text-sm font-black text-slate-900 leading-tight">{team.leaderName}</p>
                    </div>
                  </button>
                </div>

                {/* TEAM SQUAD SECTION */}
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {team.members.filter(m => m.userId !== team.leaderId).slice(0, 3).map((m, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); onViewProfile(m.userId); }}
                        className="z-0 hover:z-10"
                      >
                        {/* ✅ Use the helper to fetch each member's actual avatar */}
                        <MemberAvatar
                          userId={m.userId}
                          fallbackName={m.userName || 'User'}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    +{team.members.length - 1} members
                  </span>
                </div>
              </div>

              {/* CONNECT BUTTON */}
              <button
                onClick={() => onRequestJoin(team)}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-teal-600 to-cyan-700 text-white rounded-full font-black text-base shadow-xl shadow-teal-600/20 hover:opacity-90 transition-all"
              >
                Connect <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Swipe Overlays */}
        {active && (
          <>
            <motion.div style={{ opacity: connOp }} className="absolute inset-0 rounded-3xl pointer-events-none">
              <div className="absolute inset-0 rounded-3xl border-4 border-teal-600 bg-teal-600/5" />
              <div className="absolute top-6 right-6 bg-teal-600 text-white px-4 py-2 rounded-2xl font-black rotate-[-5deg]">JOIN ✓</div>
            </motion.div>
            <motion.div style={{ opacity: skipOp }} className="absolute inset-0 rounded-3xl pointer-events-none">
              <div className="absolute inset-0 rounded-3xl border-4 border-red-500 bg-red-500/5" />
              <div className="absolute top-6 left-6 bg-red-500 text-white px-4 py-2 rounded-2xl font-black rotate-[5deg]">SKIP ✗</div>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main DiscoverTeams Component ───────────────────────────────────────────

const DiscoverTeams = ({ onNavigate, openAuth, onViewProfile }: { onNavigate: (p: string) => void, openAuth: () => void, onViewProfile: (userId: string) => void }) => {
  const { user, isDemoUser } = useAuth();
  const { wasBlockedByThem } = useBlocks();

  const [teams, setTeams] = useState<Team[]>([]);
  const [queue, setQueue] = useState<Team[]>([]);
  const [skipped, setSkipped] = useState<string[]>(() => JSON.parse(sessionStorage.getItem("teamup:teams_skipped") || "[]"));

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [showDemoLock, setShowDemoLock] = useState(false);

  // Sync session storage
  useEffect(() => {
    sessionStorage.setItem("teamup:teams_skipped", JSON.stringify(skipped));
  }, [skipped]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) { setLoading(false); return; }
    getProfile(user.uid).then(setCurrentUserProfile);
    getAvailableTeamCities().then(setAvailableCities);

    const unsub = subscribeToAvailableTeams((availableTeams) => {
      const filtered = availableTeams.filter(team =>
        team.leaderId !== user.uid && !wasBlockedByThem(team.leaderId)
      );
      setTeams(filtered);
      setLoading(false);
    }, user.uid);

    return () => unsub();
  }, [user, wasBlockedByThem]);

  // Handle local queue filtering
  const filteredTeams = teams.filter((team) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = team.name.toLowerCase().includes(term) || team.description.toLowerCase().includes(term);
    let matchesCity = true;
    if (cityFilter) {
      matchesCity = team.city === cityFilter || normalizeCityString(team.city || '')?.id === cityFilter;
    }
    const matchesCollege = !collegeFilter || team.college === collegeFilter;
    return matchesSearch && matchesCity && matchesCollege;
  });

  useEffect(() => {
    const seen = new Set(skipped);
    setQueue(filteredTeams.filter(t => !seen.has(t.id)));
  }, [filteredTeams, skipped]);

  const handleSwipe = useCallback((id: string, dir: "left" | "right") => {
    if (dir === "right") {
      const team = teams.find(t => t.id === id);
      if (team) setSelectedTeam(team);
    }
    setSkipped(prev => [...prev, id]);
    setQueue(prev => prev.filter(t => t.id !== id));
  }, [teams]);

  const handleJoinRequest = async (team: Team, message: string) => {
    if (!user || !currentUserProfile) return;
    try {
      await sendInvitation({
        teamId: team.id, teamName: team.name,
        fromUserId: user.uid, fromUserName: currentUserProfile.fullName || 'User',
        toUserId: team.leaderId, toUserName: team.leaderName || 'Team Leader',
        message, type: 'join_request'
      });
      toast.success(`Join request sent to ${team.name}!`);
      // Dispatch feedback trigger
      window.dispatchEvent(new CustomEvent('teamup:feedback_trigger', { detail: { type: 'team_joined' } }));
      setSelectedTeam(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send join request');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[calc(100vh-160px)]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      {/* Header & Filters */}
      <div className="flex-shrink-0 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-foreground">Discover Teams</h1>
              <p className="text-muted-foreground text-sm">Browse open projects · swipe right to join</p>
            </div>
          </div>
        </div>

        {/* Main Search Row */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search teams, projects, or hackathons..."
              className="input-field pl-12 h-12 w-full text-base shadow-sm border-border/60 hover:border-primary/40 focus:border-primary/60 transition-all rounded-2xl"
            />
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="min-w-0">
            <CitySelect
              value={cityFilter}
              onChange={(cityId) => setCityFilter(cityId)}
              placeholder="All Cities"
              className="h-full"
            />
          </div>
          <div className="min-w-0">
            <InstitutionSelect
              value={collegeFilter}
              onChange={(collegeId) => setCollegeFilter(collegeId)}
              placeholder="All Colleges"
              className="h-full"
            />
          </div>
        </div>
      </div>

      {/* Stack Container */}
      <div className="flex-1 relative min-h-0 flex flex-col justify-center items-center pb-8">
        {queue.length === 0 ? (
          <div className="text-center space-y-4">
            <RotateCcw className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="font-display font-bold text-xl text-foreground">No teams left to explore</h3>
            <button
              onClick={() => { setSkipped([]); sessionStorage.removeItem("teamup:teams_skipped"); }}
              className="btn-primary"
            >
              Refresh Stack
            </button>
          </div>
        ) : (
          <div className="relative w-full max-w-4xl h-[520px] mx-auto">
            {queue.slice(0, 3).map((team, idx) => (
              <TeamSwipeCard
                key={team.id}
                team={team}
                index={idx}
                total={Math.min(queue.length, 3)}
                active={idx === 0}
                onSwipe={handleSwipe}
                onRequestJoin={(t) => {
                  if (isDemoUser) { setShowDemoLock(true); return; }
                  setSelectedTeam(t);
                }}
                onViewProfile={onViewProfile}
              />
            )).reverse()}
          </div>
        )}
      </div>

      {selectedTeam && (
        <JoinTeamModal
          team={selectedTeam}
          userProfile={currentUserProfile}
          onClose={() => setSelectedTeam(null)}
          onSend={(message) => handleJoinRequest(selectedTeam, message)}
        />
      )}

      <DemoLockModal
        open={showDemoLock}
        onClose={() => setShowDemoLock(false)}
        onSignup={() => { setShowDemoLock(false); openAuth(); }}
      />
    </div>
  );
};

export default DiscoverTeams;
