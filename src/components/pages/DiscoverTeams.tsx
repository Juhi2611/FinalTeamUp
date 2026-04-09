import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Users, Loader2, Filter, ChevronDown,
  MapPin, RotateCcw, Sparkles, Check, X, Eye, ChevronRight,
  Zap, BadgeCheck, Clock, Crown, Coffee,
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
    r.push(`Looking for ${team.rolesNeeded[0]} — matches your profile`);
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
  const openSlots = team.maxMembers - team.members.length;
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
      {/* ── GLASSMORPHISM CARD ── */}
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
        {/* Subtle teal shimmer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 70% 60% at 80% 100%, rgba(20,184,166,0.10) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 10% 10%, rgba(14,116,144,0.07) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-6">

          {/* ── ROW 1: Team Avatar + Name + Score Ring ── */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-4 min-w-0 flex-1 mr-3">
              {/* Team Avatar */}
              <div
                className="rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black"
                style={{
                  width: 64, height: 64,
                  background: avatarBg(team.id),
                  fontSize: 26,
                  boxShadow: "none",
                }}
              >
                {(team.name?.[0] ?? "T").toUpperCase()}
              </div>

              {/* Name + hackathon + availability */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <h2 className="font-black text-slate-900 text-xl leading-tight truncate">{team.name}</h2>
                  {/* Open slots chip */}
                  {openSlots > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0"
                      style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                      {openSlots} slot{openSlots !== 1 ? "s" : ""} open
                    </span>
                  )}
                  {openSlots === 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0"
                      style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}
                    >
                      Full
                    </span>
                  )}
                </div>
                {/* Hackathon / project subtitle */}
                <p className="font-bold text-base truncate" style={{ color: "#0d9488" }}>
                  {team.hackathon || "Open Collaboration"}
                </p>
              </div>
            </div>

            {/* Score ring */}
            <ScoreRing score={score} />
          </div>

          {/* ── ROW 2: Badges ── */}
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

          {/* ── ROW 3: Description ── */}
          <p
            className="mb-3 leading-snug line-clamp-2"
            style={{ color: "#475569", fontSize: 14 }}
          >
            {team.description || "A team looking for talented collaborators to build something great."}
          </p>

          {/* ── ROW 4: Roles Needed Tags ── */}
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
              {(team.rolesNeeded?.length ?? 0) > 4 && (
                <span
                  className="px-3 py-1 rounded-full text-sm font-semibold"
                  style={{ background: "rgba(255,255,255,0.60)", border: "1px solid rgba(148,163,184,0.35)", color: "#64748b" }}
                >
                  +{team.rolesNeeded!.length - 4}
                </span>
              )}
            </div>
          )}

          {/* ── ROW 5: Meta (city · college · members) ── */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {team.city && (
              <span className="flex items-center gap-1 text-sm" style={{ color: "#64748b" }}>
                <MapPin size={13} style={{ color: "#ec4899" }} />
                {getCityById(team.city || '')?.name || team.city}
              </span>
            )}
            {collegeName && (
              <span className="text-sm" style={{ color: "#64748b" }}>
                · {collegeName}
              </span>
            )}
            <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: "#f3e8ff", color: "#7c3aed", border: "1px solid #e9d5ff" }}
            >
              {team.members.length}/{team.maxMembers} members
            </span>
          </div>

          {/* ── ROW 6: Why this team? box ── */}
          <div
            className="rounded-2xl px-4 py-3 mb-4 flex-1"
            style={{
              background: "linear-gradient(135deg, rgba(240,253,250,0.80) 0%, rgba(224,242,254,0.70) 100%)",
              border: "1px solid rgba(153,246,228,0.60)",
              backdropFilter: "blur(12px)",
            }}
          >
            <p
              className="flex items-center gap-1.5 mb-2 font-bold uppercase tracking-wider"
              style={{ fontSize: 11, color: "#0d9488" }}
            >
              <Sparkles size={12} /> Why this team?
            </p>
            <div className="space-y-1.5">
              {reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  {i === 2
                    ? <Clock size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#0d9488" }} />
                    : <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#0d9488" }} />
                  }
                  <span className="text-sm leading-snug" style={{ color: "#1e293b" }}>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── ROW 7: Leader + members strip + Request to Join ── */}
          {active && (
            <div className="flex items-center justify-between gap-2">
              {/* Left: leader + member avatars */}
              <div className="flex items-center gap-3 min-w-0">
                {/* "View details" hint */}
                <button
                  onClick={() => onExpand(team)}
                  className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 flex-shrink-0"
                  style={{ color: "#64748b" }}
                >
                  <Eye size={15} />
                  View details
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Request to Join CTA */}
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onRequestJoin(team)}
                className="flex items-center gap-2 font-bold text-white flex-shrink-0"
                style={{
                  padding: "10px 20px",
                  borderRadius: 99,
                  background: "linear-gradient(135deg, #0d9488 0%, #0891b2 100%)",
                  boxShadow: "0 4px 18px rgba(13,148,136,0.38)",
                  fontSize: 14,
                  letterSpacing: "-0.01em",
                }}
              >
                Request to Join
                <ChevronRight size={15} />
              </motion.button>
            </div>
          )}
        </div>

        {/* ── SWIPE OVERLAYS (same as DiscoverPeople) ── */}
        {active && (
          <>
            {/* Right → JOIN */}
            <motion.div style={{ opacity: connOp }} className="absolute inset-0 rounded-3xl pointer-events-none">
              <div className="absolute inset-0 rounded-3xl" style={{ background: "rgba(13,148,136,0.08)", border: "3px solid #0d9488" }} />
              <div
                className="absolute top-5 right-6 font-black rounded-2xl px-4 py-2 text-white"
                style={{ background: "#0d9488", fontSize: 15, transform: "rotate(-5deg)", letterSpacing: "-0.01em" }}
              >
                JOIN ✓
              </div>
            </motion.div>
            {/* Left → SKIP */}
            <motion.div style={{ opacity: skipOp }} className="absolute inset-0 rounded-3xl pointer-events-none">
              <div className="absolute inset-0 rounded-3xl" style={{ background: "rgba(239,68,68,0.08)", border: "3px solid #ef4444" }} />
              <div
                className="absolute top-5 left-6 font-black rounded-2xl px-4 py-2 text-white"
                style={{ background: "#ef4444", fontSize: 15, transform: "rotate(5deg)", letterSpacing: "-0.01em" }}
              >
                SKIP ✗
              </div>
            </motion.div>
            {/* Up → VIEW TEAM */}
            <motion.div style={{ opacity: viewOp }} className="absolute inset-0 rounded-3xl pointer-events-none">
              <div className="absolute inset-0 rounded-3xl" style={{ background: "rgba(59,130,246,0.08)", border: "3px solid #3b82f6" }} />
              <div
                className="absolute top-5 left-1/2 -translate-x-1/2 font-black rounded-2xl px-4 py-2 text-white"
                style={{ background: "#3b82f6", fontSize: 15 }}
              >
                VIEW TEAM ↑
              </div>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Team Detail Drawer (mirrors ProfileDrawer) ────────────────────────────────

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
  const openSlots = team.maxMembers - team.members.length;
  const collegeName = useInstitutionName(team.college);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(15,23,42,0.50)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="w-full max-w-2xl rounded-t-3xl overflow-auto"
        style={{
          background: "linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(240,253,250,0.96) 100%)",
          backdropFilter: "blur(20px)",
          maxHeight: "88vh",
          border: "1.5px solid rgba(255,255,255,0.80)",
          borderBottom: "none",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full" style={{ background: "#cbd5e1" }} />
        </div>

        {/* Header */}
        <div className="px-7 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(203,213,225,0.50)" }}>
          <div className="flex items-start gap-5">
            <div
              className="rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black text-3xl"
              style={{ width: 80, height: 80, background: avatarBg(team.id), overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}
            >
              {(team.name?.[0] ?? "T").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-slate-900 text-2xl mb-0.5 truncate">{team.name}</h2>
              <p className="font-bold text-base mb-2 truncate" style={{ color: "#0d9488" }}>{team.hackathon || "Open Collaboration"}</p>
              <div className="flex items-center gap-2 flex-wrap text-sm" style={{ color: "#64748b" }}>
                {openSlots > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" }}>
                    🟢 {openSlots} slot{openSlots !== 1 ? "s" : ""} open
                  </span>
                )}
                {team.city && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} style={{ color: "#ec4899" }} />
                    {getCityById(team.city || '')?.name || team.city}
                  </span>
                )}
                {collegeName && <span>· {collegeName}</span>}
              </div>
            </div>
            <ScoreRing score={score} />
          </div>
        </div>

        <div className="px-7 py-5 space-y-5">
          {/* Badges */}
          {badges.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {badges.map((b, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                  style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {team.description && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#94a3b8" }}>About</p>
              <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>{team.description}</p>
            </div>
          )}

          {/* Roles needed */}
          {(team.rolesNeeded?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: "#94a3b8" }}>Roles Needed</p>
              <div className="flex flex-wrap gap-2">
                {team.rolesNeeded!.map((role, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full text-sm font-semibold"
                    style={{ background: "rgba(255,255,255,0.70)", border: "1px solid rgba(148,163,184,0.40)", color: "#334155" }}>
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Team members */}
          {team.members.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: "#94a3b8" }}>Team ({team.members.length}/{team.maxMembers})</p>
              <div className="flex flex-wrap gap-3">
                {team.members.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => onViewProfile(m.userId)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:opacity-80 transition-opacity"
                    style={{ background: "rgba(241,245,249,0.80)", border: "1px solid #e2e8f0" }}
                  >
                    <MemberAvatar userId={m.userId} fallbackName={m.userName || "User"} size="w-7 h-7" isLeader={m.userId === team.leaderId} />
                    <div className="text-left">
                      <p className="text-xs font-semibold text-slate-800 leading-none">{m.userName || "User"}</p>
                      {m.userId === team.leaderId && (
                        <p className="text-[10px] text-teal-600 font-medium mt-0.5">Founder</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Why this team box */}
          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(240,253,250,0.90) 0%, rgba(224,242,254,0.80) 100%)", border: "1px solid rgba(153,246,228,0.60)" }}>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#0d9488" }}>
              <Sparkles size={12} /> Why this team?
            </p>
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5 mb-2">
                <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#0d9488" }} />
                <span className="text-sm leading-snug" style={{ color: "#1e293b" }}>{r}</span>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: "#94a3b8" }}>Project Timeline</p>
            <ProjectTimeline stages={DEFAULT_STAGES} teamId={team.id} compact />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pb-4">
            <button
              onClick={onSkip}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm"
              style={{ background: "rgba(241,245,249,0.90)", color: "#64748b", border: "1.5px solid #e2e8f0" }}
            >
              <X size={16} /> Skip
            </button>
            <button
              onClick={onJoin}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white"
              style={{ flex: 2.5, background: "linear-gradient(135deg,#0d9488,#0891b2)", boxShadow: "0 4px 16px rgba(13,148,136,0.30)" }}
            >
              <Check size={16} /> Request to Join
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Toast (same as DiscoverPeople) ───────────────────────────────────────────

function ToastBanner({ msg, type }: { msg: string; type: "join" | "skip" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 rounded-full text-white font-semibold shadow-2xl pointer-events-none"
      style={{
        background: type === "join"
          ? "linear-gradient(135deg,#0d9488,#0891b2)"
          : "linear-gradient(135deg,#64748b,#475569)",
        fontSize: 14,
      }}
    >
      {msg}
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
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [showDemoLock, setShowDemoLock] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: "join" | "skip" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Persist ─────────────────────────────────────────────────────────────────
  useEffect(() => { sessionStorage.setItem("teamup:teams_joined", JSON.stringify(joined)); }, [joined]);
  useEffect(() => { sessionStorage.setItem("teamup:teams_skipped", JSON.stringify(skipped)); }, [skipped]);

  // ── Load ────────────────────────────────────────────────────────────────────
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

  // ── Filter ──────────────────────────────────────────────────────────────────
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

  // Sync queue
  useEffect(() => {
    const seen = new Set([...joined, ...skipped]);
    setQueue(filteredTeams.filter(t => !seen.has(t.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTeams.length, joined.length, skipped.length, searchTerm, cityFilter, collegeFilter]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const showToast = (msg: string, type: "join" | "skip") => {
    setToastMsg({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  };

  // ── Swipe ────────────────────────────────────────────────────────────────────
  const handleSwipe = useCallback((id: string, dir: "left" | "right" | "up") => {
    if (dir === "up") {
      const target = teams.find(t => t.id === id);
      if (target) setExpandedTeam(target);
      return; // don't remove from queue — user can return to card
    }
    if (dir === "right") {
      if (isDemoUser) { setShowDemoLock(true); return; }
      const target = teams.find(t => t.id === id);
      if (target) setSelectedTeam(target);
      setJoined(prev => [...prev, id]);
      showToast("🚀 Join request sent!", "join");
    } else {
      setSkipped(prev => [...prev, id]);
      showToast("Skipped", "skip");
    }
    setQueue(prev => prev.filter(t => t.id !== id));
  }, [teams, isDemoUser]);

  // ── Join request ─────────────────────────────────────────────────────────────
  const handleJoinRequest = async (team: Team, message: string) => {
    if (!user || !currentUserProfile) return;
    try {
      await sendInvitation({
        teamId: team.id, teamName: team.name,
        fromUserId: user.uid, fromUserName: currentUserProfile.fullName || 'User',
        toUserId: team.leaderId, toUserName: team.leaderName || 'Team Leader',
        message, type: 'join_request',
      });
      toast.success(`Join request sent to ${team.name}!`);
      window.dispatchEvent(new CustomEvent('teamup:feedback_trigger', { detail: { type: 'team_joined' } }));
      setSelectedTeam(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send join request');
    }
  };

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (expandedTeam || selectedTeam) return;
      const top = queue[0];
      if (!top) return;
      if (e.key === "ArrowRight") handleSwipe(top.id, "right");
      if (e.key === "ArrowLeft") handleSwipe(top.id, "left");
      if (e.key === "ArrowUp") { e.preventDefault(); handleSwipe(top.id, "up"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [queue, expandedTeam, selectedTeam, handleSwipe]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "calc(100vh - 80px)" }}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const cardCount = queue.length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100vh - 80px)", overflow: "hidden" }}
    >
      {/* ── HEADER ────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-foreground leading-tight">Discover Teams</h1>
              <p className="text-muted-foreground text-sm">Find your next team · swipe right to join</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {joined.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-primary/10 text-primary border border-primary/20">
                <Check size={13} /> {joined.length} requested
              </span>
            )}
            <span className="hidden lg:block text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
              ← skip · → join · ↑ details
            </span>
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

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CitySelect value={cityFilter} onChange={setCityFilter} placeholder="All Cities" className="h-full" />
          <InstitutionSelect value={collegeFilter} onChange={setCollegeFilter} placeholder="All Colleges" className="h-full" />
        </div>
      </div>

      {/* ── CARD STACK ─────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col">
        {cardCount === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Coffee className="w-12 h-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="font-display font-bold text-xl text-foreground mb-1">
                {filteredTeams.length === 0 && (searchTerm || cityFilter || collegeFilter)
                  ? "No teams match your filters"
                  : "You've seen all teams!"}
              </h3>
              <p className="text-muted-foreground text-sm mb-5">
                {filteredTeams.length === 0 && (searchTerm || cityFilter || collegeFilter)
                  ? "Try adjusting your search or filters"
                  : `${joined.length} request${joined.length !== 1 ? "s" : ""} sent · ${skipped.length} skipped`}
              </p>
              {(joined.length > 0 || skipped.length > 0) && (
                <button
                  onClick={() => {
                    setJoined([]);
                    setSkipped([]);
                    sessionStorage.removeItem("teamup:teams_joined");
                    sessionStorage.removeItem("teamup:teams_skipped");
                  }}
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                >
                  <RotateCcw size={14} /> Shuffle Again
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className="relative flex-1 min-h-0"
            style={{ paddingBottom: 28 }}
          >
            {queue
              .slice(0, 3)
              .map((team, idx) => (
                <TeamSwipeCard
                  key={team.id}
                  team={team}
                  index={idx}
                  total={Math.min(cardCount, 3)}
                  active={idx === 0}
                  onSwipe={handleSwipe}
                  onExpand={t => setExpandedTeam(t)}
                  onRequestJoin={t => {
                    if (isDemoUser) { setShowDemoLock(true); return; }
                    setSelectedTeam(t);
                  }}
                  onViewProfile={onViewProfile}
                />
              ))
              .reverse() /* render back-cards first so top card is on top */
            }
          </div>
        )}
      </div>

      {/* ── MODALS & OVERLAYS ─────────────────────────────────────── */}

      <AnimatePresence>
        {expandedTeam && (
          <TeamDrawer
            team={expandedTeam}
            onClose={() => setExpandedTeam(null)}
            onJoin={() => {
              if (isDemoUser) { setShowDemoLock(true); setExpandedTeam(null); return; }
              setJoined(prev => [...prev, expandedTeam.id]);
              setQueue(prev => prev.filter(t => t.id !== expandedTeam.id));
              showToast("🚀 Join request sent!", "join");
              setSelectedTeam(expandedTeam);
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
          onSend={(message) => handleJoinRequest(selectedTeam, message)}
        />
      )}

      <DemoLockModal
        open={showDemoLock}
        onClose={() => setShowDemoLock(false)}
        onSignup={() => { setShowDemoLock(false); openAuth(); }}
      />

      <AnimatePresence>
        {toastMsg && <ToastBanner msg={toastMsg.msg} type={toastMsg.type} />}
      </AnimatePresence>
    </div>
  );
};

export default DiscoverTeams;