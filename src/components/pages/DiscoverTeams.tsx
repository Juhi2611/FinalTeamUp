import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Users, Loader2, Filter, ChevronDown,
  MapPin, RotateCcw, Sparkles, Check, X, Eye, ChevronRight,
  Zap, BadgeCheck, Clock, Crown, Coffee, LayoutGrid, List, Layers, MoreHorizontal
} from 'lucide-react';
import {
  motion, useMotionValue, useTransform,
  animate, AnimatePresence, PanInfo,
} from "framer-motion";
import { useAuth } from '@/contexts/AuthContext';
import { useBlocks } from '@/contexts/BlockContext';
import {
  subscribeToAvailableTeams,
  getProfile,
  sendInvitation,
  getAvailableTeamCities,
  Team,
  UserProfile,
} from '@/services/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { toast } from 'sonner';
import JoinTeamModal from '../JoinTeamModal';
import DemoLockModal from "@/components/DemoLockModal";
import ProjectTimeline, { DEFAULT_STAGES } from '@/components/ProjectTimeline';
import CitySelect from "@/components/ui/CitySelect";
import { normalizeCityString, getCityById } from "@/utils/cityData";
import InstitutionSelect from "@/components/ui/InstitutionSelect";
import { useInstitutionName } from "@/utils/useInstitutionName";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface DiscoverTeamsProps {
  onNavigate: (p: string) => void;
  openAuth: () => void;
  onViewProfile: (userId: string) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Deterministic pastel avatar background from team id */
const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#0ea5e9", "#84cc16",
];
function avatarBg(id: string) {
  const code = id ? id.charCodeAt(0) + id.charCodeAt(id.length - 1) : 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

/** Team strength score — deterministic, 0-99 */
function computeTeamScore(team: Team): number {
  const base = 60;
  const memberBonus = Math.min((team.members?.length ?? 0) * 5, 20);
  const roleBonus = Math.min((team.rolesNeeded?.length ?? 0) * 2, 10);
  const hash = (team.id?.charCodeAt(0) ?? 0) % 11;
  return Math.min(base + memberBonus + roleBonus + hash, 99);
}

function scoreColor(s: number) {
  return s >= 85 ? "#f97316" : s >= 70 ? "#14b8a6" : "#94a3b8";
}

function getWhyReasons(team: Team): string[] {
  const r: string[] = [];
  if (team.rolesNeeded && team.rolesNeeded.length > 0) {
    r.push(`Looking for ${team.rolesNeeded[0]} — matches your profile`);
  }
  r.push("Open to new members and early-stage collaborations");
  if ((team.maxMembers - team.members.length) > 0)
    r.push(`${team.maxMembers - team.members.length} open slot${team.maxMembers - team.members.length !== 1 ? "s" : ""} — apply now`);
  return r.slice(0, 3);
}

interface BadgeDef { label: string; icon: JSX.Element; bg: string; color: string; border: string; }
function getTeamBadges(team: Team): BadgeDef[] {
  const b: BadgeDef[] = [];
  const openSlots = team.maxMembers - team.members.length;
  if (openSlots > 0)
    b.push({ label: "Slots Open", icon: <Zap size={12} />, bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" });
  if ((team.rolesNeeded?.length ?? 0) >= 2)
    b.push({ label: "Active Project", icon: <BadgeCheck size={12} />, bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" });
  if (team.hackathon)
    b.push({ label: "Hackathon", icon: <Crown size={12} />, bg: "#fef9c3", color: "#b45309", border: "#fde68a" });
  return b.slice(0, 2);
}

// ─── Score Ring (same as DiscoverPeople) ──────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const size = 72, r = 28, circ = 2 * Math.PI * r;
  const off = circ - (score / 100) * circ;
  const col = scoreColor(score);
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="5" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={col} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontSize: 22, fontWeight: 800, color: col, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1, marginTop: 2 }}>fit</span>
      </div>
    </div>
  );
}

// ─── MemberAvatar ──────────────────────────────────────────────────────────────

function MemberAvatar({ userId, fallbackName, size = "w-8 h-8", isLeader = false }: {
  userId: string; fallbackName: string; size?: string; isLeader?: boolean;
}) {
  const [avatar, setAvatar] = useState<string | null>(null);
  useEffect(() => {
    if (userId) getProfile(userId).then(p => setAvatar(p?.avatar || null));
  }, [userId]);

  return (
    <div className="relative group flex-shrink-0">
      <img
        src={avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackName)}`}
        className={`${size} rounded-full object-cover transition-transform group-hover:scale-110 ${
          isLeader ? 'ring-2 ring-teal-500 ring-offset-1' : 'ring-1 ring-white/60'
        }`}
        alt={fallbackName}
      />
      {isLeader && (
        <div className="absolute -top-1 -right-1 bg-teal-500 text-white rounded-full p-0.5 shadow-sm">
          <Crown size={8} fill="currentColor" />
        </div>
      )}
    </div>
  );
}

// ─── Glassmorphism Team Swipe Card ─────────────────────────────────────────────

interface TeamSwipeCardProps {
  team: Team;
  index: number;
  total: number;
  active: boolean;
  onSwipe: (id: string, dir: "left" | "right" | "up") => void;
  onExpand: (team: Team) => void;
  onRequestJoin: (team: Team) => void;
  onViewProfile: (userId: string) => void;
}

function TeamSwipeCard({
  team, index, total, active, onSwipe, onExpand, onRequestJoin, onViewProfile,
}: TeamSwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-12, 12]);
  const connOp = useTransform(x, [40, 130], [0, 1]);
  const skipOp = useTransform(x, [-130, -40], [1, 0]);
  const viewOp = useTransform(y, [-100, -30], [1, 0]);

  const STACK_GAP = 14;
  const STACK_SCALE = 0.045;
  const stackY = index * STACK_GAP;
  const stackSc = 1 - index * STACK_SCALE;
  const stackRot = index * 1.5 * (index % 2 === 0 ? 1 : -1);

  const score = computeTeamScore(team);
  const badges = getTeamBadges(team);
  const reasons = getWhyReasons(team);
  const collegeName = useInstitutionName(team.college);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;
      const swX = Math.abs(offset.x) > 90 || Math.abs(velocity.x) > 400;
      const swU = offset.y < -80 || velocity.y < -400;
      if (swU) {
        animate(y, -800, { duration: 0.25, ease: "easeOut" });
        setTimeout(() => onSwipe(team.id, "up"), 100);
      } else if (swX && offset.x > 0) {
        animate(x, 700, { duration: 0.3 });
        setTimeout(() => onSwipe(team.id, "right"), 240);
      } else if (swX && offset.x < 0) {
        animate(x, -700, { duration: 0.3 });
        setTimeout(() => onSwipe(team.id, "left"), 240);
      } else {
        animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
        animate(y, 0, { type: "spring", stiffness: 400, damping: 30 });
      }
    },
    [x, y, onSwipe, team.id]
  );

  return (
    <motion.div
      style={{
        x: active ? x : 0,
        y: active ? y : stackY,
        rotate: active ? rotate : stackRot,
        scale: stackSc,
        zIndex: total - index,
        position: "absolute",
        inset: 0,
      }}
      drag={active}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.55}
      onDragEnd={handleDragEnd}
      animate={{ y: stackY, scale: stackSc, rotate: active ? 0 : stackRot }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className={`absolute inset-0 transition-shadow ${active
          ? "cursor-grab active:cursor-grabbing z-50"
          : "pointer-events-none z-0"
        }`}
    >
      <div
        className="w-full h-full rounded-3xl overflow-hidden relative"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.82) 0%, rgba(240,253,250,0.75) 50%, rgba(224,242,254,0.72) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1.5px solid rgba(255,255,255,0.70)",
          boxShadow: "none",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 70% 60% at 80% 100%, rgba(20,184,166,0.10) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 10% 10%, rgba(14,116,144,0.07) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-4 min-w-0 flex-1 mr-3">
              <div
                className="rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black"
                style={{
                  width: 64, height: 64,
                  background: avatarBg(team.id),
                  fontSize: 26,
                  overflow: "hidden",
                }}
              >
                {(team.name?.[0] ?? "T").toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-slate-900 text-xl leading-tight truncate">{team.name}</h2>
                <p className="font-bold text-base truncate" style={{ color: "#0d9488" }}>
                  {team.hackathon || "Open Collaboration"}
                </p>
              </div>
            </div>
            <ScoreRing score={score} />
          </div>

          {badges.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {badges.map((b, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}
                >
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          )}

          <p
            className="mb-3 leading-snug line-clamp-2"
            style={{ color: "#475569", fontSize: 14 }}
          >
            {team.description || "A team looking for talented collaborators to build something great."}
          </p>

          {(team.rolesNeeded?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {team.rolesNeeded!.slice(0, 4).map((role, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full text-sm font-semibold"
                  style={{
                    background: "rgba(255,255,255,0.70)",
                    border: "1px solid rgba(148,163,184,0.40)",
                    color: "#334155",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {role}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {team.city && (
              <span className="flex items-center gap-1 text-sm font-medium" style={{ color: "#64748b" }}>
                <MapPin size={13} style={{ color: "#ec4899" }} />
                {getCityById(team.city || '')?.name || team.city}
              </span>
            )}
            <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: "#f3e8ff", color: "#7c3aed", border: "1px solid #e9d5ff" }}
            >
              {team.members.length}/{team.maxMembers} members
            </span>
            {collegeName && (
              <span className="text-sm" style={{ color: "#64748b" }}>
                · {collegeName}
              </span>
            )}
          </div>

          <div
            className="rounded-2xl px-4 py-3 mb-4 flex-1"
            style={{
              background: "linear-gradient(135deg, rgba(240,253,250,0.80) 0%, rgba(224,242,254,0.70) 100%)",
              border: "1px solid rgba(153,246,228,0.60)",
              backdropFilter: "blur(12px)",
            }}
          >
            <p className="flex items-center gap-1.5 mb-2 font-bold uppercase tracking-wider" style={{ fontSize: 11, color: "#0d9488" }}>
              <Sparkles size={12} /> Team Fit
            </p>
            <div className="space-y-1.5">
              {reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#0d9488" }} />
                  <span className="text-sm leading-snug font-medium" style={{ color: "#1e293b" }}>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {active && (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => onExpand(team)}
                className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 text-slate-500 font-bold"
              >
                <Eye size={15} />
                View details
                <ChevronRight size={15} />
              </button>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onRequestJoin(team)}
                className="flex items-center gap-2 font-bold text-white shadow-xl"
                style={{
                  padding: "10px 24px",
                  borderRadius: 99,
                  background: "linear-gradient(135deg, #0d9488, #0891b2)",
                  boxShadow: "0 4px 18px rgba(13,148,136,0.38)",
                  fontSize: 14,
                }}
              >
                Join Team
                <ChevronRight size={15} />
              </motion.button>
            </div>
          )}
        </div>

        {active && (
          <>
            <motion.div style={{ opacity: connOp }} className="absolute inset-0 rounded-3xl pointer-events-none">
              <div className="absolute inset-0 rounded-3xl" style={{ border: "3px solid #0d9488", background: "rgba(13,148,136,0.08)" }} />
              <div
                className="absolute top-5 right-6 font-black rounded-2xl px-4 py-2 text-white"
                style={{ background: "#0d9488", fontSize: 15, transform: "rotate(-5deg)", letterSpacing: "-0.01em" }}
              >
                JOIN ✓
              </div>
            </motion.div>
            <motion.div style={{ opacity: skipOp }} className="absolute inset-0 rounded-3xl pointer-events-none">
              <div className="absolute inset-0 rounded-3xl" style={{ border: "3px solid #ef4444", background: "rgba(239,68,68,0.08)" }} />
              <div
                className="absolute top-5 left-6 font-black rounded-2xl px-4 py-2 text-white"
                style={{ background: "#ef4444", fontSize: 15, transform: "rotate(5deg)", letterSpacing: "-0.01em" }}
              >
                SKIP ✗
              </div>
            </motion.div>
            <motion.div style={{ opacity: viewOp }} className="absolute inset-0 rounded-3xl pointer-events-none">
              <div className="absolute inset-0 rounded-3xl" style={{ border: "3px solid #3b82f6", background: "rgba(59,130,246,0.08)" }} />
              <div
                className="absolute top-5 left-1/2 -translate-x-1/2 font-black rounded-2xl px-4 py-2 text-white"
                style={{ background: "#3b82f6", fontSize: 15 }}
              >
                VIEW DETAILS ↑
              </div>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Team Drawer ──────────────────────────────────────────────────────────────

function TeamDrawer({
  team, onClose, onJoin, onSkip, onViewProfile,
}: {
  team: Team;
  onClose: () => void;
  onJoin: () => void;
  onSkip: () => void;
  onViewProfile: (userId: string) => void;
}) {
  const score = computeTeamScore(team);
  const badges = getTeamBadges(team);
  const reasons = getWhyReasons(team);
  const collegeName = useInstitutionName(team.college);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="w-full max-w-2xl bg-white rounded-t-3xl overflow-auto max-h-[90vh] pb-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-slate-200" />
        </div>

        <div className="px-7 pt-5 pb-6 border-b border-slate-100">
          <div className="flex items-start gap-5">
            <div
              className="rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black text-3xl"
              style={{ width: 80, height: 80, background: avatarBg(team.id) }}
            >
              {(team.name?.[0] ?? "T").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-slate-900 text-2xl truncate mb-1">{team.name}</h2>
              <p className="font-bold text-teal-600">{team.hackathon || "Open Collaboration"}</p>
              <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                {team.city && <span className="flex items-center gap-1"><MapPin size={14} />{getCityById(team.city || '')?.name || team.city}</span>}
                {collegeName && <span>· {collegeName}</span>}
              </div>
            </div>
            <ScoreRing score={score} />
          </div>
        </div>

        <div className="px-7 py-6 space-y-6">
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">About Team</h4>
            <p className="text-slate-600 leading-relaxed text-sm">{team.description || "No description provided."}</p>
          </div>

          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Roles Needed</h4>
            <div className="flex flex-wrap gap-2">
              {team.rolesNeeded?.map((r, i) => (
                <span key={i} className="px-3 py-1.5 rounded-xl bg-slate-50 text-slate-700 text-sm font-semibold border border-slate-200">{r}</span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Current Members ({team.members.length}/{team.maxMembers})</h4>
            <div className="grid grid-cols-2 gap-3">
              {team.members.map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <MemberAvatar userId={m.userId} fallbackName={m.userName} size="w-8 h-8" isLeader={m.userId === team.leaderId} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{m.userName}</p>
                    <p className="text-[10px] text-slate-500">{m.userId === team.leaderId ? "Founder" : "Member"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-4 bg-teal-50 border border-teal-100">
            <h4 className="text-xs font-black text-teal-700 uppercase tracking-widest mb-3">Why fits your profile?</h4>
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5 mb-2 last:mb-0">
                <Check size={14} className="text-teal-600 mt-0.5" />
                <span className="text-sm text-slate-700 font-medium">{r}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={onSkip} className="flex-1 py-3.5 rounded-2xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Skip</button>
            <button onClick={onJoin} className="flex-[2] py-3.5 rounded-2xl font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/25">Join Team</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Toast Banner ─────────────────────────────────────────────────────────────

function ToastBanner({ msg, type }: { msg: string; type: "join" | "skip" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-2xl font-bold text-white shadow-xl ${
        type === "join" ? "bg-teal-600" : "bg-slate-800"
      }`}
    >
      {msg}
    </motion.div>
  );
}

// ─── Swipe Indicator ──────────────────────────────────────────────────────────
function SwipeIndicator({ text = "join" }: { text?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="swipe-indicator-container"
    >
      <div className="swipe-indicator-rotating-line" />
      <div className="swipe-indicator-content">
        <span className="flex items-center gap-1.5 leading-none">
          <span className="opacity-60">←</span> skip
        </span>
        <span className="w-1 h-1 rounded-full bg-slate-300" />
        <span className="flex items-center gap-1.5 leading-none">
          <span className="opacity-60">→</span> {text}
        </span>
        <span className="w-1 h-1 rounded-full bg-slate-300" />
        <span className="flex items-center gap-1.5 leading-none">
          <span className="opacity-60">↑</span> profile
        </span>
      </div>
    </motion.div>
  );
}

// ─── View Switcher ────────────────────────────────────────────────────────────

type ViewMode = "swipe" | "grid" | "detail";

function ViewSwitcher({ current, onChange }: { current: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
      {(["swipe", "grid", "detail"] as ViewMode[]).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`p-2 rounded-xl transition-all ${
            current === v ? "bg-white text-teal-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {v === "swipe" && <Layers size={18} />}
          {v === "grid" && <LayoutGrid size={18} />}
          {v === "detail" && <List size={18} />}
        </button>
      ))}
    </div>
  );
}

// ─── Teams Grid Card ─────────────────────────────────────────────────────────────

function TeamsGridCard({
  team, onSwipe, onExpand, onRequestJoin
}: {
  team: Team;
  onSwipe: (id: string, dir: "left" | "right" | "up") => void;
  onExpand: (team: Team) => void;
  onRequestJoin: (team: Team) => void;
}) {
  const score = computeTeamScore(team);
  const collegeName = useInstitutionName(team.college);
  const reasons = getWhyReasons(team);

  return (
    <motion.div
      layout
      whileHover={{ y: -4 }}
      className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl"
            style={{ background: avatarBg(team.id) }}
          >
            {(team.name?.[0] ?? "T").toUpperCase()}
          </div>
          <div>
            <h3 className="font-black text-slate-900 leading-tight">{team.name}</h3>
            <p className="text-teal-600 text-sm font-bold mt-1">{team.hackathon || "Open Collab"}</p>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase">Match</span>
          <span className="text-lg font-black" style={{ color: scoreColor(score) }}>{score}%</span>
        </div>
      </div>

      <p className="text-slate-500 text-sm line-clamp-2 mb-4 leading-relaxed">
        {team.description || "Building something amazing."}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {team.rolesNeeded?.slice(0, 3).map((r, i) => (
          <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 text-[11px] font-bold border border-slate-100">{r}</span>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">{team.members.length}/{team.maxMembers} members</span>
          <div className="flex -space-x-1.5">
            {team.members.slice(0, 3).map((m, i) => (
              <div key={i} className="w-5 h-5 rounded-full border border-white bg-slate-100 overflow-hidden">
                <MemberAvatar userId={m.userId} fallbackName={m.userName} size="w-full h-full" />
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => onExpand(team)}
          className="text-xs font-black text-teal-600 hover:text-teal-700"
        >
          Details →
        </button>
      </div>

      <button
        onClick={() => onRequestJoin(team)}
        className="mt-4 w-full py-2.5 rounded-2xl bg-teal-50 text-teal-700 text-sm font-bold hover:bg-teal-100 transition-all border border-teal-100"
      >
        Quick Join
      </button>
    </motion.div>
  );
}

// ─── Teams Detail Row ───────────────────────────────────────────────────────────

function TeamsDetailRow({ team, onClick }: { team: Team, onClick: () => void }) {
  const score = computeTeamScore(team);
  const collegeName = useInstitutionName(team.college);

  return (
    <motion.div
      layout
      onClick={onClick}
      className="group flex items-center p-3 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer border border-transparent hover:border-slate-100"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
          style={{ background: avatarBg(team.id) }}
        >
          {(team.name?.[0] ?? "T").toUpperCase()}
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-slate-900 text-sm truncate">{team.name}</h4>
          <p className="text-teal-600 text-[10px] font-bold">{team.hackathon || "Open Collab"}</p>
        </div>
      </div>

      <div className="flex-1 px-4 hidden md:block min-w-0 text-slate-500 text-xs truncate">
        {collegeName || team.city || "Global"}
      </div>

      <div className="flex-1 px-4 hidden sm:block">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">{team.members.length}/{team.maxMembers}</span>
          <div className="flex -space-x-1.5">
            {team.members.slice(0, 3).map((m, i) => (
              <div key={i} className="w-4 h-4 rounded-full border border-white bg-slate-100 overflow-hidden">
                <MemberAvatar userId={m.userId} fallbackName={m.userName} size="w-full h-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-16 text-right">
        <span className="text-sm font-black" style={{ color: scoreColor(score) }}>{score}%</span>
      </div>
    </motion.div>
  );
}

// ─── Main DiscoverTeams ────────────────────────────────────────────────────────

const DiscoverTeams = ({ onNavigate, openAuth, onViewProfile }: DiscoverTeamsProps) => {
  const { user, isDemoUser } = useAuth();
  const { wasBlockedByThem } = useBlocks();

  const [teams, setTeams] = useState<Team[]>([]);
  const [queue, setQueue] = useState<Team[]>([]);
  const [joined, setJoined] = useState<string[]>(() => JSON.parse(sessionStorage.getItem("teamup:teams_joined") || "[]"));
  const [skipped, setSkipped] = useState<string[]>(() => JSON.parse(sessionStorage.getItem("teamup:teams_skipped") || "[]"));
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<Team | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("teamup:teams_view") as ViewMode) || "swipe");

  // Persist view mode
  useEffect(() => { localStorage.setItem("teamup:teams_view", viewMode); }, [viewMode]);

  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [showDemoLock, setShowDemoLock] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: "join" | "skip" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { sessionStorage.setItem("teamup:teams_joined", JSON.stringify(joined)); }, [joined]);
  useEffect(() => { sessionStorage.setItem("teamup:teams_skipped", JSON.stringify(skipped)); }, [skipped]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) { setLoading(false); return; }
    getProfile(user.uid).then(setCurrentUserProfile);
    const unsub = subscribeToAvailableTeams((availableTeams) => {
      const filtered = availableTeams.filter(t => t.leaderId !== user.uid && !wasBlockedByThem(t.leaderId));
      setTeams(filtered);
      setLoading(false);
    }, user.uid);
    return () => unsub();
  }, [user, wasBlockedByThem]);

  const filteredTeams = teams.filter((team) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      team.name.toLowerCase().includes(term) ||
      team.description.toLowerCase().includes(term) ||
      (team.rolesNeeded?.some(r => r.toLowerCase().includes(term)) ?? false);
    let matchesCity = true;
    if (cityFilter) matchesCity = team.city === cityFilter || normalizeCityString(team.city || '')?.id === cityFilter;
    const matchesCollege = !collegeFilter || team.college === collegeFilter;
    return matchesSearch && matchesCity && matchesCollege;
  });

  useEffect(() => {
    const seen = new Set([...joined, ...skipped]);
    setQueue(filteredTeams.filter(t => !seen.has(t.id)));
  }, [filteredTeams.length, joined.length, skipped.length, searchTerm, cityFilter, collegeFilter]);

  const showToast = (msg: string, type: "join" | "skip") => {
    setToastMsg({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  };

  const handleSwipe = useCallback((id: string, dir: "left" | "right" | "up") => {
    if (dir === "up") {
      const target = teams.find(t => t.id === id);
      if (target) setExpandedTeam(target);
      return;
    }
    if (dir === "right") {
      if (isDemoUser) { setShowDemoLock(true); return; }
      const target = teams.find(t => t.id === id);
      if (target) {
        setSelectedTeam(target);
        setJoined(prev => [...prev, id]);
        showToast("🚀 Join request sent!", "join");
      }
    } else {
      setSkipped(prev => [...prev, id]);
      showToast("Skipped", "skip");
    }
    setQueue(prev => prev.filter(t => t.id !== id));
  }, [teams, isDemoUser]);

  const handleJoinRequest = async (team: Team, message: string) => {
    if (!user || !currentUserProfile) return;
    try {
      await sendInvitation({
        teamId: team.id, teamName: team.name,
        fromUserId: user.uid, fromUserName: currentUserProfile.fullName || 'User',
        toUserId: team.leaderId, toUserName: team.leaderName || 'Team Leader',
        message, type: 'join_request',
      });
      toast.success(`Request sent to ${team.name}!`);
      window.dispatchEvent(new CustomEvent('teamup:feedback_trigger', { detail: { type: 'team_joined' } }));
      setSelectedTeam(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send request');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      <div className="flex-shrink-0 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-teal-50 p-2.5 rounded-2xl text-teal-600">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Discover Teams</h1>
              <p className="text-slate-500 text-sm font-medium mt-0.5">{filteredTeams.length} active projects</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {viewMode === "swipe" && queue.length > 0 && <SwipeIndicator text="join" />}
            <ViewSwitcher current={viewMode} onChange={setViewMode} />
            <button
              onClick={() => { setJoined([]); setSkipped([]); }}
              className="p-2.5 rounded-2xl text-slate-400 hover:text-teal-600 hover:bg-slate-50 transition-all"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by team name, project, roles, or hackathon..."
              className="input-field pl-12 h-12 w-full text-base shadow-sm border-border/60 hover:border-primary/40 focus:border-primary/60 transition-all rounded-2xl"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Filters Grid */}
        <div id="tour-teams-filters" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CitySelect value={cityFilter} onChange={setCityFilter} placeholder="All Cities" className="h-full" />
          <InstitutionSelect value={collegeFilter} onChange={setCollegeFilter} placeholder="All Colleges" className="h-full" />
        </div>
      </div>

      <div className="flex-1 relative min-h-0">

        {/* SWIPE VIEW — fills full remaining height, no scroll */}
        {viewMode === "swipe" && (
          <>
            <AnimatePresence mode="wait">
            {queue.length === 0 ? (
              <motion.div
                key="empty-swipe"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
              >
                <Sparkles size={40} className="text-teal-400 mb-6" />
                <h3 className="text-2xl font-black text-slate-800 mb-2">That's all for now!</h3>
                <p className="text-slate-500 max-w-sm mb-8">Try adjusting your filters or check back later.</p>
                <button
                  onClick={() => { setCityFilter(""); setCollegeFilter(""); setSearchTerm(""); }}
                  className="px-8 py-3.5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all"
                >
                  Clear Filters
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="swipe-cards"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
                style={{ paddingBottom: 28 }}
              >
                {queue.slice(0, 3).reverse().map((t, i) => (
                  <TeamSwipeCard
                    key={t.id}
                    team={t}
                    index={Math.min(queue.length, 3) - 1 - i}
                    total={Math.min(queue.length, 3)}
                    active={i === Math.min(queue.length, 3) - 1}
                    onSwipe={handleSwipe}
                    onExpand={setExpandedTeam}
                    onRequestJoin={() => {
                      if (isDemoUser) setShowDemoLock(true);
                      else setSelectedTeam(t);
                    }}
                    onViewProfile={onViewProfile}
                  />
                ))}
              </motion.div>
            )}
            </AnimatePresence>
          </>
        )}

        {/* GRID & DETAIL VIEWS — scrollable */}
        {viewMode !== "swipe" && (
          <div className="absolute inset-0 overflow-y-auto no-scrollbar pb-10 pr-1">
            <AnimatePresence mode="wait">
              {queue.length === 0 ? (
                <motion.div
                  key="empty"
                  className="flex flex-col items-center justify-center py-20 px-6 text-center"
                >
                  <Sparkles size={40} className="text-teal-400 mb-6" />
                  <h3 className="text-2xl font-black text-slate-800 mb-2">That's all for now!</h3>
                  <p className="text-slate-500 max-w-sm mb-8">Try adjusting your filters or check back later.</p>
                  <button
                    onClick={() => { setCityFilter(""); setCollegeFilter(""); setSearchTerm(""); }}
                    className="px-8 py-3.5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all"
                  >
                    Clear Filters
                  </button>
                </motion.div>
              ) : viewMode === "grid" ? (
                <motion.div key="grid" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {queue.map(t => (
                    <TeamsGridCard
                      key={t.id}
                      team={t}
                      onSwipe={handleSwipe}
                      onExpand={setExpandedTeam}
                      onRequestJoin={() => {
                        if (isDemoUser) setShowDemoLock(true);
                        else setSelectedTeam(t);
                      }}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div key="detail" className="flex flex-col gap-2 mt-4">
                  <div className="flex items-center px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-2">
                    <div className="flex-1">Team / Hackathon</div>
                    <div className="flex-1 hidden md:block">Location</div>
                    <div className="flex-1 hidden sm:block">Members</div>
                    <div className="w-16 text-right">Match</div>
                  </div>
                  {queue.map(t => (
                    <TeamsDetailRow key={t.id} team={t} onClick={() => setExpandedTeam(t)} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </div>

      <AnimatePresence>
        {expandedTeam && (
          <TeamDrawer
            team={expandedTeam}
            onClose={() => setExpandedTeam(null)}
            onJoin={() => {
              if (isDemoUser) { setShowDemoLock(true); setExpandedTeam(null); return; }
              setSelectedTeam(expandedTeam);
              setJoined(prev => [...prev, expandedTeam.id]);
              setQueue(prev => prev.filter(t => t.id !== expandedTeam.id));
              showToast("🚀 Join request sent!", "join");
              setExpandedTeam(null);
            }}
            onSkip={() => {
              setSkipped(prev => [...prev, expandedTeam.id]);
              setQueue(prev => prev.filter(t => t.id !== expandedTeam.id));
              showToast("Skipped", "skip");
              setExpandedTeam(null);
            }}
            onViewProfile={onViewProfile}
          />
        )}
      </AnimatePresence>

      {selectedTeam && (
        <JoinTeamModal
          team={selectedTeam}
          userProfile={currentUserProfile}
          onClose={() => setSelectedTeam(null)}
          onSend={(msg) => handleJoinRequest(selectedTeam, msg)}
        />
      )}

      <DemoLockModal open={showDemoLock} onClose={() => setShowDemoLock(false)} onSignup={() => { setShowDemoLock(false); openAuth(); }} />
      <AnimatePresence>{toastMsg && <ToastBanner msg={toastMsg.msg} type={toastMsg.type} />}</AnimatePresence>
    </div>
  );
};

export default DiscoverTeams;