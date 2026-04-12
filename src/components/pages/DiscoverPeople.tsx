/**
 * TeamUp — Discover People v4
 *
 * Card design: Glassmorphism matching reference image
 *   - Avatar top-left (coloured square initials fallback)
 *   - Score ring top-right
 *   - Badge row (Top Collaborator, Skill Verified, Fast Responder…)
 *   - Name · Role · Tagline
 *   - Skill tags
 *   - Experience · City · Last active meta row
 *   - "Why this match?" teal box
 *   - Interview button (bottom-right, pill shape, teal gradient) — team-leaders only
 *
 * Stack: 3 cards visible (staggered down + slightly scaled/rotated)
 * Swipe: right = connect, left = skip, up = view full profile
 * Filters: search · role · city · availability (all wired to real data)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  motion, useMotionValue, useTransform,
  animate, AnimatePresence, PanInfo,
} from "framer-motion";
import {
  Users, Loader2, RotateCcw, Sparkles, Crown, Coffee,
  ChevronRight, Eye, X, Check, Search, Filter, ChevronDown,
  Video, Award, Zap, BadgeCheck, Clock, MapPin, ShieldCheck,
  LayoutGrid, List, Layers, MoreHorizontal
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeToAllUsers, getProfile, getUserTeams, sendInvitation,
  getAvailableRoles, getAvailableCities, UserProfile, Team,
} from "@/services/firestore";
import { getUserTeams as getLeaderTeams } from "@/services/firestore";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useBlocks } from "@/contexts/BlockContext";
import { getSkillClass } from "@/data/mockData";
import { PerkRankBadge } from "@/components/PerksBadge";
import { getJoinFee } from "@/types/firestore.types";
import PitchModal from "../PitchModal";
import InterviewRequestModal from "@/components/interviews/InterviewRequestModal";
import DemoLockModal from "@/components/DemoLockModal";
import { toast } from "sonner";
import CitySelect from "@/components/ui/CitySelect";
import { normalizeCityString, getCityById } from "@/utils/cityData";
import InstitutionSelect from "@/components/ui/InstitutionSelect";
import { normalizeInstitutionString, getInstitutionById } from "@/utils/institutionData";
import { useInstitutionName } from "@/utils/useInstitutionName";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface DiscoverPeopleProps {
  onViewProfile: (userId: string) => void;
  openAuth: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function computeMatchScore(u: UserProfile): number {
  const base = 65;
  const skillBonus = Math.min((u.skills?.length ?? 0) * 3, 20);
  const teamBonus = (u.leaderOfTeamIds?.length ?? 0) > 0 ? 5 : 0;
  const hash = (u.id?.charCodeAt(0) ?? 0) % 11;
  return Math.min(base + skillBonus + teamBonus + hash, 99);
}

function getMatchReasons(u: UserProfile): { icon: "skill" | "collab" | "time"; text: string }[] {
  const reasons: { icon: "skill" | "collab" | "time"; text: string }[] = [];
  if (u.skills?.length)
    reasons.push({ icon: "skill", text: `Matches your ${u.skills[0].name} development needs` });
  reasons.push({ icon: "collab", text: "Open to joining early-stage projects & collaborations" });
  reasons.push({ icon: "time", text: `Active recently` });
  return reasons.slice(0, 3);
}

type AvailState = "Available" | "Open to offers" | "In a team";
function getAvailability(u: UserProfile): AvailState {
  const leading = u.leaderOfTeamIds?.length ?? 0;
  const total = u.teamIds?.length ?? 0;
  if (leading > 0 || total > 0) return "In a team";
  return "Available";
}

/** Deterministic pastel avatar background from user id */
const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#0ea5e9", "#84cc16",
];
function avatarBg(id: string) {
  const code = id ? id.charCodeAt(0) + id.charCodeAt(id.length - 1) : 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}
function initials(name: string) {
  return (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function scoreColor(s: number) {
  return s >= 85 ? "#f97316" : s >= 70 ? "#14b8a6" : "#94a3b8";
}

// ─── Score Ring ────────────────────────────────────────────────────────────────

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
        <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1, marginTop: 2 }}>match</span>
      </div>
    </div>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────────

interface BadgeDef { label: string; icon: JSX.Element; bg: string; color: string; border: string; }

function getBadges(u: UserProfile): BadgeDef[] {
  const b: BadgeDef[] = [];

  // Use totalPerksEarned as a proxy for "Top Collaborator"
  if ((u.totalPerksEarned ?? 0) > 100)
    b.push({ label: "Top Collaborator", icon: <Award size={12} />, bg: "#fef9c3", color: "#b45309", border: "#fde68a" });

  // Real Skill Verification Badge
  if (u.isSkillVerified)
    b.push({ label: "Skill Verified", icon: <BadgeCheck size={12} />, bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" });

  // Identity Verification Badge
  if (u.isProfileVerified)
    b.push({ label: "Id Verified", icon: <ShieldCheck size={12} />, bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" });

  // Fast Responder proxy — is available
  if ((u.teamIds?.length ?? 0) === 0 && !u.isSkillVerified && !u.isProfileVerified)
    b.push({ label: "Fast Responder", icon: <Zap size={12} />, bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" });

  return b.slice(0, 3);
}

// ─── Glassmorphism Swipe Card ──────────────────────────────────────────────────

interface SwipeCardProps {
  user: UserProfile;
  index: number;       // 0 = top card
  total: number;
  onSwipe: (id: string, dir: "left" | "right" | "up") => void;
  onExpand: (user: UserProfile) => void;
  onInterview: (user: UserProfile) => void;
  active: boolean;
  isLeader: boolean;
}

function SwipeCard({
  user, index, total, onSwipe, onExpand, onInterview, active, isLeader,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-12, 12]);
  const connOp = useTransform(x, [40, 130], [0, 1]);
  const skipOp = useTransform(x, [-130, -40], [1, 0]);
  const viewOp = useTransform(y, [-100, -30], [1, 0]);

  // Stack offsets — each card shifts down and scales slightly
  const STACK_GAP = 14;
  const STACK_SCALE = 0.045;
  const stackY = index * STACK_GAP;
  const stackSc = 1 - index * STACK_SCALE;
  const stackRot = index * 1.5 * (index % 2 === 0 ? 1 : -1);

  const score = computeMatchScore(user);
  const avail = getAvailability(user);
  const reasons = getMatchReasons(user);
  const badges = getBadges(user);

  const avatarSrc = user.avatar
    ? `${user.avatar}?t=${Math.floor(Date.now() / 60000)}`
    : null;

  const expLevel = user.skills?.[0]?.proficiency ?? null;
  const collegeName = useInstitutionName(user.college);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;
      const swX = Math.abs(offset.x) > 90 || Math.abs(velocity.x) > 400;
      const swU = offset.y < -80 || velocity.y < -400;
      if (swU) {
        animate(y, -800, { duration: 0.25, ease: "easeOut" });
        setTimeout(() => onSwipe(user.id, "up"), 100);
      } else if (swX && offset.x > 0) {
        animate(x, 700, { duration: 0.3 });
        setTimeout(() => onSwipe(user.id, "right"), 240);
      } else if (swX && offset.x < 0) {
        animate(x, -700, { duration: 0.3 });
        setTimeout(() => onSwipe(user.id, "left"), 240);
      } else {
        animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
        animate(y, 0, { type: "spring", stiffness: 400, damping: 30 });
      }
    },
    [x, y, onSwipe, user.id]
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
            <div className="flex items-center gap-4">
              <div
                className="rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black"
                style={{
                  width: 64, height: 64,
                  background: avatarBg(user.id),
                  fontSize: 22,
                  boxShadow: "none",
                  overflow: "hidden",
                }}
              >
                {avatarSrc
                  ? <img src={avatarSrc} alt={user.fullName} className="w-full h-full object-cover" />
                  : initials(user.fullName || "")
                }
              </div>

              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="font-black text-slate-900 text-xl leading-tight">{user.fullName || "Unnamed"}</h2>
                  {avail === "Available" && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                      Available
                    </span>
                  )}
                  {avail === "In a team" && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}
                    >
                      <Users size={10} /> In Team
                    </span>
                  )}
                </div>
                <p className="font-bold text-base" style={{ color: "#0d9488" }}>
                  {user.primaryRole || "Team Member"}
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

          {user.bio && (
            <p
              className="mb-3 leading-snug line-clamp-2"
              style={{ color: "#475569", fontSize: 14 }}
            >
              {user.bio}
            </p>
          )}
          {!user.bio && user.primaryRole && (
            <p
              className="mb-3 leading-snug"
              style={{ color: "#475569", fontSize: 14 }}
            >
              {user.primaryRole} looking for exciting projects and collaborations
            </p>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            {user.skills?.slice(0, 4).map((s, i) => (
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
                {s.name}
              </span>
            ))}
            {(user.skills?.length ?? 0) > 4 && (
              <span
                className="px-3 py-1 rounded-full text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.60)", border: "1px solid rgba(148,163,184,0.35)", color: "#64748b" }}
              >
                +{(user.skills?.length ?? 0) - 4}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {expLevel && (
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: "#f3e8ff", color: "#7c3aed", border: "1px solid #e9d5ff" }}
              >
                {expLevel}
              </span>
            )}
            {user.city && (
              <span className="flex items-center gap-1 text-sm" style={{ color: "#64748b" }}>
                <MapPin size={13} style={{ color: "#ec4899" }} />
                {getCityById(user.city || '')?.name || user.city}
              </span>
            )}
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
            <p
              className="flex items-center gap-1.5 mb-2 font-bold uppercase tracking-wider"
              style={{ fontSize: 11, color: "#0d9488" }}
            >
              <Sparkles size={12} /> Why this match?
            </p>
            <div className="space-y-1.5">
              {reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#0d9488" }} />
                  <span className="text-sm leading-snug" style={{ color: "#1e293b" }}>{r.text}</span>
                </div>
              ))}
            </div>
          </div>

          {active && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => onExpand(user)}
                className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
                style={{ color: "#64748b" }}
              >
                <Eye size={15} />
                View full profile
                <ChevronRight size={15} />
              </button>

              {isLeader && (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onInterview(user)}
                  className="flex items-center gap-2 font-bold text-white"
                  style={{
                    padding: "10px 24px",
                    borderRadius: 99,
                    background: "linear-gradient(135deg, #0d9488 0%, #0891b2 100%)",
                    boxShadow: "0 4px 18px rgba(13,148,136,0.38)",
                    fontSize: 15,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Interview
                  <ChevronRight size={16} />
                </motion.button>
              )}
            </div>
          )}
        </div>

        {active && (
          <>
            <motion.div style={{ opacity: connOp }} className="absolute inset-0 rounded-3xl pointer-events-none">
              <div className="absolute inset-0 rounded-3xl" style={{ background: "rgba(13,148,136,0.08)", border: "3px solid #0d9488" }} />
              <div
                className="absolute top-5 right-6 font-black rounded-2xl px-4 py-2 text-white"
                style={{ background: "#0d9488", fontSize: 15, transform: "rotate(-5deg)", letterSpacing: "-0.01em" }}
              >
                CONNECT ✓
              </div>
            </motion.div>
            <motion.div style={{ opacity: skipOp }} className="absolute inset-0 rounded-3xl pointer-events-none">
              <div className="absolute inset-0 rounded-3xl" style={{ background: "rgba(239,68,68,0.08)", border: "3px solid #ef4444" }} />
              <div
                className="absolute top-5 left-6 font-black rounded-2xl px-4 py-2 text-white"
                style={{ background: "#ef4444", fontSize: 15, transform: "rotate(5deg)", letterSpacing: "-0.01em" }}
              >
                SKIP ✗
              </div>
            </motion.div>
            <motion.div style={{ opacity: viewOp }} className="absolute inset-0 rounded-3xl pointer-events-none">
              <div
                className="absolute inset-0 rounded-3xl"
                style={{
                  background: "rgba(59,130,246,0.08)",
                  border: "3px solid #3b82f6"
                }}
              />
              <div
                className="absolute top-5 left-1/2 -translate-x-1/2 font-black rounded-2xl px-4 py-2 text-white"
                style={{ background: "#3b82f6", fontSize: 15 }}
              >
                VIEW PROFILE ↑
              </div>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}

type ViewMode = "swipe" | "grid" | "detail";

function ProfileDrawer({
  user, onClose, onConnect, onSkip, onInterview, isLeader, viewMode,
}: {
  user: UserProfile;
  onClose: () => void;
  onConnect: () => void;
  onSkip: () => void;
  onInterview: (user: UserProfile) => void; 
  isLeader: boolean;
  viewMode?: ViewMode;
}) {
  const score = computeMatchScore(user);
  const avail = getAvailability(user);
  const reasons = getMatchReasons(user);
  const badges = getBadges(user);
  const avatarSrc = user.avatar ? user.avatar : null;
  const collegeName = useInstitutionName(user.college);

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
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full" style={{ background: "#cbd5e1" }} />
        </div>

        <div className="px-7 pt-5 pb-2" style={{ borderBottom: "1px solid rgba(203,213,225,0.50)" }}>
          <div className="flex items-start gap-5">
            <div
              className="rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black text-2xl"
              style={{ width: 80, height: 80, background: avatarBg(user.id), overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}
            >
              {avatarSrc
                ? <img src={avatarSrc} alt={user.fullName} className="w-full h-full object-cover" />
                : initials(user.fullName || "")
              }
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-slate-900 text-2xl mb-0.5">{user.fullName}</h2>
              <p className="font-bold text-base mb-2" style={{ color: "#0d9488" }}>{user.primaryRole}</p>
              <div className="flex items-center gap-2 flex-wrap text-sm" style={{ color: "#64748b" }}>
                {avail === "Available" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" }}>
                    🟢 Available
                  </span>
                )}
                {user.city && <span className="flex items-center gap-1"><MapPin size={12} style={{ color: "#ec4899" }} />{getCityById(user.city || '')?.name || user.city}</span>}
                {collegeName && <span>· {collegeName}{user.yearOfStudy ? `, ${user.yearOfStudy}` : ""}</span>}
                <PerkRankBadge totalPerksEarned={user.totalPerksEarned ?? 0} size="sm" />
              </div>
            </div>
            <ScoreRing score={score} />
          </div>
        </div>

        <div className="px-7 py-5 space-y-5">
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

          {user.skills && user.skills.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: "#94a3b8" }}>Skills</p>
              <div className="flex flex-wrap gap-2">
                {user.skills.map((s, i) => (
                  <span key={i} className={`skill-tag text-sm ${getSkillClass(s.name)}`}>
                    {s.name}{s.proficiency ? <span className="opacity-60 ml-1 text-xs">· {s.proficiency}</span> : null}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(240,253,250,0.90) 0%, rgba(224,242,254,0.80) 100%)", border: "1px solid rgba(153,246,228,0.60)" }}>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#0d9488" }}>
              <Sparkles size={12} /> Why this match?
            </p>
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5 mb-2">
                <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#0d9488" }} />
                <span className="text-sm leading-snug" style={{ color: "#1e293b" }}>{r.text}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 pb-4">
            {/* Primary Action Row */}
            <div className="flex gap-3">
              {(!viewMode || viewMode === "swipe") ? (
                <button
                  onClick={onSkip}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm"
                  style={{ background: "rgba(241,245,249,0.90)", color: "#64748b", border: "1.5px solid #e2e8f0" }}
                >
                  <X size={16} /> Skip
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm"
                  style={{ background: "rgba(241,245,249,0.90)", color: "#64748b", border: "1.5px solid #e2e8f0" }}
                >
                  <X size={16} /> Cancel
                </button>
              )}
              <button
                onClick={onConnect}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white"
                style={{ flex: 2.5, background: "linear-gradient(135deg,#0d9488,#0891b2)", boxShadow: "0 4px 16px rgba(13,148,136,0.30)" }}
              >
                <Check size={16} /> Connect & Invite
              </button>
            </div>

            {/* Secondary Action Row: Interview Button (Visible only to Leaders) */}
            {isLeader && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onInterview(user)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-white"
                style={{
                  background: "linear-gradient(135deg, #0d9488 0%, #0891b2 100%)",
                  boxShadow: "0 4px 18px rgba(13,148,136,0.25)"
                }}
              >
                <Video size={18} />
                Request Interview
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function ToastBanner({ msg, type }: { msg: string; type: "connect" | "skip" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 rounded-full text-white font-semibold shadow-2xl pointer-events-none"
      style={{
        background: type === "connect"
          ? "linear-gradient(135deg,#0d9488,#0891b2)"
          : "linear-gradient(135deg,#64748b,#475569)",
        fontSize: 14,
      }}
    >
      {msg}
    </motion.div>
  );
}

// ─── Swipe Indicator ──────────────────────────────────────────────────────────
function SwipeIndicator({ text = "connect" }: { text?: string }) {
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

function ViewSwitcher({ current, onChange }: { current: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div id="tour-view-switcher" className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
      {(["swipe", "grid", "detail"] as ViewMode[]).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`p-2 rounded-xl transition-all ${current === v ? "bg-white text-teal-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
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

// ─── Grid View Card ─────────────────────────────────────────────────────────────

function PeopleGridCard({
  user, onSwipe, onExpand, onInterview, isLeader
}: {
  user: UserProfile;
  onSwipe: (id: string, dir: "left" | "right" | "up") => void;
  onExpand: (user: UserProfile) => void;
  onInterview: (user: UserProfile) => void;
  isLeader: boolean;
}) {
  const score = computeMatchScore(user);
  const avail = getAvailability(user);
  const reasons = getMatchReasons(user);
  const badges = getBadges(user);
  const avatarSrc = user.avatar ? user.avatar : null;
  const collegeName = useInstitutionName(user.college);
  const expLevel = user.skills?.[0]?.proficiency ?? null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full rounded-3xl overflow-hidden relative"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.82) 0%, rgba(240,253,250,0.75) 50%, rgba(224,242,254,0.72) 100%)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1.5px solid rgba(255,255,255,0.70)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 80% 100%, rgba(20,184,166,0.10) 0%, transparent 70%)" }} />

      <div className="relative z-10 flex flex-col h-full p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black text-lg"
              style={{ width: 56, height: 56, background: avatarBg(user.id), overflow: "hidden" }}>
              {avatarSrc ? <img src={avatarSrc} alt={user.fullName} className="w-full h-full object-cover" /> : initials(user.fullName || "")}
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg leading-tight">{user.fullName || "Unnamed"}</h3>
              <p className="font-bold text-sm text-teal-600">{user.primaryRole || "Team Member"}</p>
            </div>
          </div>
          <ScoreRing score={score} />
        </div>

        <div className="flex gap-1.5 mb-3 flex-wrap">
          {badges.map((b, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
              {b.label}
            </span>
          ))}
        </div>

        {user.bio && <p className="text-slate-600 text-xs line-clamp-2 mb-3 leading-relaxed">{user.bio}</p>}

        <div className="flex flex-wrap gap-1.5 mb-3">
          {user.skills?.slice(0, 3).map((s, i) => (
            <span key={i} className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/60 border border-slate-200/50 text-slate-600">
              {s.name}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-4 text-[11px] text-slate-500 font-medium">
          {expLevel && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">{expLevel}</span>}
          {user.city && <span className="flex items-center gap-1"><MapPin size={10} className="text-pink-500" />{getCityById(user.city || '')?.name || user.city}</span>}
        </div>

        <div className="rounded-2xl px-3 py-2.5 mb-4 flex-1 bg-teal-50/50 border border-teal-100/50">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-teal-700 mb-1.5">
            <Sparkles size={10} /> Match Details
          </p>
          <div className="space-y-1">
            {reasons.slice(0, 2).map((r, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <Check size={10} className="text-teal-600 mt-0.5" />
                <span className="text-[11px] text-slate-700 leading-tight">{r.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onExpand(user)}
            className="w-full py-2 rounded-xl text-xs font-bold text-slate-600 bg-white/80 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            View Profile
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => onSwipe(user.id, "right")}
              className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md shadow-teal-500/20"
            >
              Invite
            </button>
            {isLeader && (
              <button
                id="tour-discover-interview"
                onClick={() => onInterview(user)}
                className="px-3 py-2 rounded-xl text-white bg-slate-900 hover:bg-slate-800 transition-colors"
              >
                <Video size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Details View Row ───────────────────────────────────────────────────────────

function PeopleDetailRow({ user, onClick }: { user: UserProfile, onClick: () => void }) {
  const score = computeMatchScore(user);
  const collegeName = useInstitutionName(user.college);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className="group flex items-center p-3 rounded-2xl hover:bg-white/80 transition-all cursor-pointer border border-transparent hover:border-slate-200/60 hover:shadow-sm"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
          style={{ background: avatarBg(user.id), overflow: "hidden" }}>
          {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : initials(user.fullName || "")}
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-slate-900 text-sm truncate">{user.fullName || "Unnamed"}</h4>
          <p className="text-teal-600 text-[11px] font-semibold truncate">{user.primaryRole || "Team Member"}</p>
        </div>
      </div>

      <div className="flex-1 px-4 hidden md:block min-w-0">
        <p className="text-slate-500 text-xs truncate">
          {collegeName || "Institution not set"}
        </p>
      </div>

      <div className="flex-1 px-4 hidden sm:block min-w-0">
        <div className="flex items-center gap-1.5 text-slate-500">
          <MapPin size={12} className="text-pink-400" />
          <span className="text-xs truncate">{getCityById(user.city || '')?.name || user.city || "Remote"}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 px-2">
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black text-slate-400 leading-none mb-0.5">FIT</span>
          <span className="text-sm font-black leading-none" style={{ color: scoreColor(score) }}>{score}%</span>
        </div>
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
          <ChevronRight size={16} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

const DiscoverPeople = ({ onViewProfile, openAuth }: DiscoverPeopleProps) => {
  const { user, isDemoUser } = useAuth();
  const { wasBlockedByThem } = useBlocks();

  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [leaderTeams, setLeaderTeams] = useState<Team[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");

  const [queue, setQueue] = useState<UserProfile[]>([]);
  const [connected, setConnected] = useState<string[]>(() => JSON.parse(sessionStorage.getItem("teamup:swiped_right") || "[]"));
  const [skipped, setSkipped] = useState<string[]>(() => JSON.parse(sessionStorage.getItem("teamup:swiped_left") || "[]"));

  const [expandedUser, setExpandedUser] = useState<UserProfile | null>(null);
  const [showModal, setShowModal] = useState<UserProfile | null>(null);
  const [interviewTarget, setInterviewTarget] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("teamup:people_view") as ViewMode) || "swipe");
  const [showDemoLock, setShowDemoLock] = useState(false);

  // Persist view mode
  useEffect(() => {
    localStorage.setItem("teamup:people_view", viewMode);
  }, [viewMode]);
  const [sending, setSending] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: "connect" | "skip" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  // ✅ Sync connected list to session storage
  useEffect(() => {
    sessionStorage.setItem("teamup:swiped_right", JSON.stringify(connected));
  }, [connected]);

  // ✅ Sync skipped list to session storage
  useEffect(() => {
    sessionStorage.setItem("teamup:swiped_left", JSON.stringify(skipped));
  }, [skipped]);

  useEffect(() => {
    getAvailableCities().then(c => setAvailableCities(c.filter(Boolean).sort((a, b) => a.localeCompare(b))));
    getAvailableRoles().then(r => setAvailableRoles(r));
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) { setLoading(false); return; }

    getProfile(user.uid).then(async profile => {
      setCurrentUserProfile(profile);
      const teams = await getLeaderTeams(user.uid);
      setLeaderTeams(teams.filter(t => t.leaderId === user.uid));
    });

    const unsub = subscribeToAllUsers(user.uid, fetched => {
      setAllUsers(fetched);
      setLoading(false);
    });

    return () => {
      unsub();
      sessionStorage.removeItem("inviteForTeamId");
      sessionStorage.removeItem("inviteForTeamName");
    };
  }, [user]);

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filteredUsers = allUsers.filter(u => {
    if (wasBlockedByThem(u.id)) return false;
    const term = searchTerm.toLowerCase();
    const leading = u.leaderOfTeamIds?.length ?? 0;
    const memberIn = (u.teamIds?.length ?? 0) - leading;
    const isAvail = leading === 0 && memberIn === 0;

    const matchesSearch =
      (u.fullName?.toLowerCase().includes(term) ?? false) ||
      (u.primaryRole?.toLowerCase().includes(term) ?? false) ||
      (u.skills?.some(s => s.name.toLowerCase().includes(term)) ?? false);

    const matchesRole = !roleFilter || u.primaryRole === roleFilter;
    const matchesCity = !cityFilter || u.city === cityFilter || normalizeCityString(u.city || '')?.id === cityFilter;
    const matchesCollege = !collegeFilter || u.college === collegeFilter;

    const matchesAvail =
      availabilityFilter === "all" ||
      (availabilityFilter === "available" && isAvail) ||
      (availabilityFilter === "busy" && !isAvail);

    return matchesSearch && matchesRole && matchesCity && matchesAvail && matchesCollege;
  });

  // Sync queue on filter change
  useEffect(() => {
    const seen = new Set([...connected, ...skipped]);
    setQueue(filteredUsers.filter(u => !seen.has(u.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredUsers.length, connected.length, skipped.length, searchTerm, roleFilter, cityFilter, collegeFilter, availabilityFilter]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const showToast = (msg: string, type: "connect" | "skip") => {
    setToastMsg({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  };

  // ── Swipe ──────────────────────────────────────────────────────────────────

  const handleSwipe = useCallback((id: string, dir: "left" | "right" | "up") => {
    if (dir === "up") {
      const target = allUsers.find(u => u.id === id);
      if (target) {
        setExpandedUser(target);
        onViewProfile(target.id);
      }
      // ✅ Do not filter the queue here; let the user return to this card
      return;
    }

    // Standard logic for left/right swipes
    if (dir === "right") {
      if (isDemoUser) { setShowDemoLock(true); return; }
      setConnected(prev => [...prev, id]);
      showToast("🤝 Connection request sent!", "connect");
      const target = allUsers.find(u => u.id === id);
      if (target) setShowModal(target);
    } else if (dir === "left") {
      setSkipped(prev => [...prev, id]);
      showToast("Skipped", "skip");
    }
    setQueue(prev => prev.filter(p => p.id !== id));
  }, [allUsers, isDemoUser, onViewProfile]);

  // ── Interview ──────────────────────────────────────────────────────────────

  const handleInterview = useCallback((target: UserProfile) => {
    if (isDemoUser) { setShowDemoLock(true); return; }
    setInterviewTarget(target);
  }, [isDemoUser]);

  // ── Invite ─────────────────────────────────────────────────────────────────

  const handleSendInvite = async (targetUser: UserProfile, message: string) => {
    if (!user || !targetUser.id) return;
    const fee = getJoinFee(currentUserProfile?.totalPerksEarned ?? 0);
    const currentBalance = currentUserProfile?.perks ?? 0;
    if (fee > 0 && currentBalance < fee) {
      toast.error(`You need ${fee} Perks. You currently have ${currentBalance}.`);
      return;
    }
    if (fee > 0) toast.info(`Note: ${fee} Perks will be deducted.`);
    setSending(true);
    try {
      const ctxId = sessionStorage.getItem("inviteForTeamId");
      const ctxName = sessionStorage.getItem("inviteForTeamName");
      let teamId: string, teamName: string;
      if (ctxId && ctxName) {
        const userTeams = await getUserTeams(user.uid);
        const team = userTeams.find(t => t.id === ctxId);
        if (!team || team.leaderId !== user.uid) {
          toast.error("Team not found or you're no longer the leader.");
          setSending(false); setShowModal(null); return;
        }
        teamId = ctxId; teamName = ctxName;
      } else {
        const userTeams = await getUserTeams(user.uid);
        const myLeader = userTeams.filter(t => t.leaderId === user.uid);
        if (!myLeader.length) {
          toast.error("Only team leaders can send invitations.");
          setSending(false); setShowModal(null); return;
        }
        teamId = myLeader[0].id; teamName = myLeader[0].name;
      }
      const currentProfile = await getProfile(user.uid);
      await sendInvitation({
        teamId, teamName,
        fromUserId: user.uid,
        fromUserName: currentProfile?.fullName || user.email?.split("@")[0] || "User",
        toUserId: targetUser.id,
        toUserName: targetUser.fullName || "User",
        message, type: "invite",
      });
      toast.success(`Invitation sent to ${targetUser.fullName}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setSending(false); setShowModal(null);
    }
  };

  // ── Keyboard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (expandedUser || showModal || interviewTarget) return;
      const top = queue[0];
      if (!top) return;
      if (e.key === "ArrowRight") handleSwipe(top.id, "right");
      if (e.key === "ArrowLeft") handleSwipe(top.id, "left");
      if (e.key === "ArrowUp") { e.preventDefault(); handleSwipe(top.id, "up"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [queue, expandedUser, showModal, interviewTarget, handleSwipe]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "calc(100vh - 80px)" }}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const cardCount = queue.length;
  const isLeader = leaderTeams.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100vh - 80px)", overflow: "hidden" }}
    >
      {/* ── HEADER ────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-teal-100 p-2.5 rounded-2xl text-teal-700 shadow-inner">
              <Users size={22} className="drop-shadow-sm" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Discover People</h1>
              <p className="text-slate-500 text-sm font-medium mt-1">
                {filteredUsers.length} active members looking for teams
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {viewMode === "swipe" && queue.length > 0 && <SwipeIndicator text="connect" />}
            <ViewSwitcher current={viewMode} onChange={setViewMode} />
            <button
              onClick={() => {
                setConnected([]);
                setSkipped([]);
                sessionStorage.removeItem("teamup:swiped_right");
                sessionStorage.removeItem("teamup:swiped_left");
              }}
              className="p-2.5 rounded-2xl text-slate-400 hover:text-teal-600 hover:bg-white transition-all duration-200 border border-transparent hover:border-slate-200 shadow-sm"
              title="Reset discovery"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>

        {/* Main Search Row */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, role, skills, or experience..."
              className="input-field pl-12 h-12 w-full text-base shadow-sm border-border/60 hover:border-primary/40 focus:border-primary/60 transition-all rounded-2xl"
            />
          </div>
        </div>

        {/* Filters Grid */}
        <div id="tour-discover-filters" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-3 min-w-0">
            <div className="relative h-full">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                className="input-field pl-10 pr-10 w-full appearance-none text-sm h-full truncate">
                <option value="">All Roles</option>
                {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="lg:col-span-3 min-w-0">
            <CitySelect
              value={cityFilter}
              onChange={(cityId) => setCityFilter(cityId)}
              placeholder="All Cities"
              className="h-full"
            />
          </div>
          <div className="lg:col-span-3 min-w-0">
            <InstitutionSelect
              value={collegeFilter}
              onChange={(collegeId) => setCollegeFilter(collegeId)}
              placeholder="All Colleges"
              className="h-full"
            />
          </div>
          <div className="lg:col-span-3 min-w-0">
            <div className="relative h-full">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select value={availabilityFilter} onChange={e => setAvailabilityFilter(e.target.value)}
                className="input-field pl-10 pr-10 w-full appearance-none text-sm h-full truncate">
                <option value="all">All Availability</option>
                <option value="available">Available Only</option>
                <option value="busy">In Teams / Leading</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT AREA ── */}
      <div id="tour-people-stack" className="flex-1 relative min-h-0">

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
                <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Sparkles size={40} className="text-teal-400" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">You've reached the end!</h3>
                <p className="text-slate-500 max-w-sm font-medium mb-8">
                  {searchTerm || roleFilter || cityFilter || availabilityFilter !== 'all'
                    ? "No more people match your specific filters. Try adjusting them for more results."
                    : "You've seen everyone available for now. Check back later for new members!"}
                </p>
                <button
                  onClick={() => {
                    setConnected([]);
                    setSkipped([]);
                    setRoleFilter("");
                    setCityFilter("");
                    setSearchTerm("");
                    setAvailabilityFilter("all");
                  }}
                  className="px-8 py-3.5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                >
                  Reset All Filters
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
                {queue.slice(0, 3).reverse().map((u, i) => (
                  <SwipeCard
                    key={u.id}
                    user={u}
                    index={Math.min(queue.length, 3) - 1 - i}
                    total={Math.min(queue.length, 3)}
                    onSwipe={handleSwipe}
                    onExpand={setExpandedUser}
                    onInterview={handleInterview}
                    active={i === Math.min(queue.length, 3) - 1}
                    isLeader={leaderTeams.length > 0}
                  />
                ))}
              </motion.div>
            )}
            </AnimatePresence>
          </>
        )}

        {/* GRID & DETAIL VIEWS — scrollable */}
        {viewMode !== "swipe" && (
          <div className="absolute inset-0 overflow-y-auto no-scrollbar pb-10">
            <AnimatePresence mode="wait">
              {queue.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-20 px-6 text-center"
                >
                  <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <Sparkles size={40} className="text-teal-400" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">You've reached the end!</h3>
                  <p className="text-slate-500 max-w-sm font-medium mb-8">
                    {searchTerm || roleFilter || cityFilter || availabilityFilter !== 'all'
                      ? "No more people match your specific filters. Try adjusting them for more results."
                      : "You've seen everyone available for now. Check back later for new members!"}
                  </p>
                  <button
                    onClick={() => {
                      setConnected([]);
                      setSkipped([]);
                      setRoleFilter("");
                      setCityFilter("");
                      setSearchTerm("");
                      setAvailabilityFilter("all");
                    }}
                    className="px-8 py-3.5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                  >
                    Reset All Filters
                  </button>
                </motion.div>
              ) : viewMode === "grid" ? (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pr-2"
                >
                  {queue.map((u) => (
                    <PeopleGridCard
                      key={u.id}
                      user={u}
                      onSwipe={handleSwipe}
                      onExpand={setExpandedUser}
                      onInterview={handleInterview}
                      isLeader={leaderTeams.length > 0}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="detail"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-2 mt-4 pr-2"
                >
                  <div className="flex items-center px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-2">
                    <div className="flex-1">Profile / Role</div>
                    <div className="flex-1 hidden md:block">Institution</div>
                    <div className="flex-1 hidden sm:block">Location</div>
                    <div className="w-20 text-right">Match</div>
                  </div>
                  {queue.map((u) => (
                    <PeopleDetailRow
                      key={u.id}
                      user={u}
                      onClick={() => setExpandedUser(u)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </div>

      {/* ── MODALS & OVERLAYS ──────────────────────────────────────── */}

      {/* ── MODALS & OVERLAYS ──────────────────────────────────────── */}

      <AnimatePresence>
        {expandedUser && (
          <ProfileDrawer
            user={expandedUser}
            isLeader={isLeader} // Pass the leader status
            viewMode={viewMode}
            onInterview={(u) => { // Handle the interview click
              setExpandedUser(null);
              handleInterview(u);
            }}
            onClose={() => setExpandedUser(null)}
            onConnect={() => {
              if (isDemoUser) { setShowDemoLock(true); setExpandedUser(null); return; }
              setConnected(prev => [...prev, expandedUser.id]);
              setQueue(prev => prev.filter(p => p.id !== expandedUser.id));
              showToast("🤝 Connection request sent!", "connect");
              setShowModal(expandedUser);
              setExpandedUser(null);
            }}
            onSkip={() => {
              setSkipped(prev => [...prev, expandedUser.id]);
              setQueue(prev => prev.filter(p => p.id !== expandedUser.id));
              showToast("Skipped", "skip");
              setExpandedUser(null);
            }}
          />
        )}
      </AnimatePresence>

      {showModal && (
        <PitchModal
          type="invite"
          recipientName={showModal.fullName || "User"}
          recipientId={showModal.id}
          onClose={() => setShowModal(null)}
          onSend={msg => handleSendInvite(showModal, msg)}
        />
      )}

      {interviewTarget && leaderTeams.length > 0 && (
        <InterviewRequestModal
          candidate={interviewTarget}
          leaderTeams={leaderTeams}
          onClose={() => setInterviewTarget(null)}
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

export default DiscoverPeople;