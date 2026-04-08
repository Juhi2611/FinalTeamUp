/**
 * PerkShopPage.tsx
 * ─────────────────
 * Animated, decorative Perk Shop for TeamUp.
 * Features:
 *   - Floating particle animation background
 *   - User's referral code (unique, bold, large) with copy button
 *   - Redeem a friend's referral code form
 *   - Rank ladder showcase
 *   - Stats card
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Copy, CheckCheck, Users, Gift, Zap,
  Star, Crown, Trophy, Rocket, ChevronRight, RefreshCw,
  UserPlus, Loader2, Info, ShieldAlert
} from 'lucide-react';
import { getOrCreateReferralCode, redeemReferralCode, claimPendingReferralRewards } from '@/services/perksService';
import { useAuth } from '@/contexts/AuthContext';
import { PERK_RANKS, getPerkRank } from '@/types/firestore.types';
import type { UserProfile } from '@/types/firestore.types';

interface PerkShopPageProps {
  userProfile?: UserProfile | null;
  onProfileRefresh?: () => void;
}

// ─── Floating Particle ─────────────────────────────────────────────────────

const PARTICLE_ICONS = ['⚡', '🏆', '✨', '🚀', '🌟', '💎', '🔥', '🎯'];

const FloatingParticle = ({ index }: { index: number }) => {
  const icon = PARTICLE_ICONS[index % PARTICLE_ICONS.length];
  const size = 14 + (index % 4) * 4;
  const left = `${(index * 13 + 5) % 95}%`;
  const delay = (index * 0.7) % 5;
  const duration = 6 + (index % 4);

  return (
    <motion.div
      className="absolute pointer-events-none select-none opacity-[0.12]"
      style={{ left, fontSize: size, top: '100%' }}
      animate={{ y: [0, -700], opacity: [0, 0.15, 0.15, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
    >
      {icon}
    </motion.div>
  );
};

// ─── Rank Card ─────────────────────────────────────────────────────────────

const RankCard = ({ rank, current }: { rank: typeof PERK_RANKS[0]; current: boolean }) => (
  <motion.div
    whileHover={{ scale: 1.04, y: -4 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    className={`relative rounded-2xl p-4 border-2 transition-all cursor-default ${
      current
        ? 'border-primary/60 bg-primary/10 shadow-lg shadow-primary/20'
        : 'border-border bg-card/60 hover:border-border/80'
    }`}
  >
    {current && (
      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
        YOUR RANK
      </span>
    )}
    <div className="text-2xl mb-1">{rank.emoji}</div>
    <div className={`text-sm font-bold ${rank.color}`}>{rank.rank}</div>
    <div className="text-[10px] text-muted-foreground mt-0.5">
      {rank.maxPerks !== null
        ? `${rank.minPerks}–${rank.maxPerks} perks`
        : `${rank.minPerks}+ perks`}
    </div>
  </motion.div>
);

// ─── Main Component ────────────────────────────────────────────────────────

const PerkShopPage = ({ userProfile, onProfileRefresh }: PerkShopPageProps) => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string>('');
  const [loadingCode, setLoadingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const perks = userProfile?.perks ?? 0;
  const totalEarned = userProfile?.totalPerksEarned ?? 0;
  const referralCount = userProfile?.referralCount ?? 0;
  const alreadyRedeemed = !!userProfile?.referredBy;
  const emailVerified = user?.emailVerified ?? false;
  const currentRank = getPerkRank(totalEarned);

  // Load referral code + claim any pending rewards
  useEffect(() => {
    if (!user?.uid) return;
    setLoadingCode(true);

    // Claim pending referral rewards (writes to OWN profile)
    claimPendingReferralRewards(user.uid).then((claimed) => {
      if (claimed > 0) {
        setRedeemMsg({ text: `\uD83C\uDF89 You received ${claimed * 10} Perks from ${claimed} referral(s)!`, ok: true });
        onProfileRefresh?.();
      }
    });

    // Load referral code
    getOrCreateReferralCode(user.uid)
      .then(setReferralCode)
      .finally(() => setLoadingCode(false));
  }, [user?.uid]);

  const handleCopy = async () => {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRedeem = async () => {
    if (!user?.uid || !redeemInput.trim()) return;
    setRedeeming(true);
    setRedeemMsg(null);
    try {
      const result = await redeemReferralCode(redeemInput, user.uid);
      setRedeemMsg({ text: result.message, ok: result.success });
      if (result.success) {
        setRedeemInput('');
        onProfileRefresh?.();
      }
    } catch (err: any) {
      console.error('[PerkShop] Redeem error:', err);
      setRedeemMsg({ text: err?.message || 'Something went wrong. Please try again.', ok: false });
    } finally {
      setRedeeming(false);
    }
  };

  // ── Email verification helpers ──
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      const { sendEmailVerification } = await import('firebase/auth');
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setResendCooldown(60);
        setRedeemMsg({ text: 'Verification email sent! Check your inbox.', ok: true });
      }
    } catch {
      setRedeemMsg({ text: 'Failed to send verification email. Try again later.', ok: false });
    }
  };

  const handleRefreshVerification = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth.currentUser) {
        await auth.currentUser.reload();
        // Force a re-render by checking the updated value
        if (auth.currentUser.emailVerified) {
          setRedeemMsg({ text: '🎉 Email verified successfully! You can now redeem codes.', ok: true });
          // Force re-render
          window.location.reload();
        } else {
          setRedeemMsg({ text: 'Email not yet verified. Please check your inbox and click the link.', ok: false });
        }
      }
    } catch {
      setRedeemMsg({ text: 'Could not check verification status. Try again.', ok: false });
    }
  };

  return (
    <div className="space-y-5 relative">
      {/* ── Animated background particles ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {Array.from({ length: 12 }).map((_, i) => (
          <FloatingParticle key={i} index={i} />
        ))}
      </div>

      {/* ── Hero Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 35%, #0ea5e9 70%, #06b6d4 100%)',
        }}
      >
        {/* Decorative bokeh circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-6 w-36 h-36 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full"
          style={{
            background: 'radial-gradient(ellipse at 70% 50%, rgba(255,255,255,0.06) 0%, transparent 70%)'
          }}
        />

        <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-4">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="p-3 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20"
          >
            <Sparkles className="w-8 h-8 text-yellow-300" />
          </motion.div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Perk Shop
              </h1>
              <span className="text-xs bg-yellow-400/20 border border-yellow-300/30 text-yellow-200 px-2 py-0.5 rounded-full font-semibold">
                BETA
              </span>
            </div>
            <p className="text-white/75 text-sm md:text-base max-w-md">
              Invite teammates, earn Perks, climb the ranks. Every great team starts with a great connection.
            </p>
          </div>

          {/* Stats pill */}
          <div className="flex gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-center">
              <div className="text-2xl font-extrabold text-white">{perks}</div>
              <div className="text-[10px] text-white/70 uppercase tracking-wide">Balance</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-center">
              <div className="text-2xl font-extrabold text-yellow-300">{referralCount}</div>
              <div className="text-[10px] text-white/70 uppercase tracking-wide">Referrals</div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Your Referral Code ── */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="card-base p-6 relative overflow-hidden"
        >
          {/* Glow behind the code */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-cyan-500/5 pointer-events-none rounded-2xl" />

          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-700">
              <Gift className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">Your Referral Code</h2>
              <p className="text-xs text-muted-foreground">Share it — earn 10 Perks per signup</p>
            </div>
          </div>

          {/* Code display */}
          <div className="relative mb-4">
            <motion.div
              animate={{ boxShadow: ['0 0 0px rgba(124,58,237,0)', '0 0 20px rgba(124,58,237,0.35)', '0 0 0px rgba(124,58,237,0)'] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="rounded-2xl border-2 border-violet-300/60 dark:border-violet-600/50 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 px-6 py-5 text-center"
            >
              {loadingCode ? (
                <Loader2 className="w-6 h-6 animate-spin text-violet-500 mx-auto" />
              ) : (
                <>
                  <div
                    className="font-extrabold text-3xl md:text-4xl tracking-[0.2em] text-violet-700 dark:text-violet-300 select-all"
                    style={{ fontFamily: "'Courier New', Courier, monospace", letterSpacing: '0.22em' }}
                  >
                    {referralCode}
                  </div>
                  <div className="text-[10px] text-violet-500/70 dark:text-violet-400/60 mt-1 uppercase tracking-widest">
                    TeamUp Referral Code
                  </div>
                </>
              )}
            </motion.div>

            {/* Copy button */}
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCopy}
              disabled={loadingCode}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.span key="copied" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5" /> Copied!
                  </motion.span>
                ) : (
                  <motion.span key="copy" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* How it works */}
          <div className="space-y-2.5">
            {[
              { icon: <UserPlus className="w-4 h-4 text-violet-500" />, text: 'Share your code with a friend' },
              { icon: <Zap className="w-4 h-4 text-yellow-500" />, text: 'They redeem it after signing up' },
              { icon: <Sparkles className="w-4 h-4 text-emerald-500" />, text: 'You earn 10 Perks instantly!' },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-2.5 text-sm text-muted-foreground"
              >
                <div className="shrink-0 w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                  {i + 1}
                </div>
                <span className="flex items-center gap-1.5">{step.icon} {step.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Redeem a Code ── */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="card-base p-6 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-emerald-500/5 pointer-events-none rounded-2xl" />

          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 border border-cyan-200 dark:border-cyan-700">
              <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">Redeem a Friend's Code</h2>
              <p className="text-xs text-muted-foreground">Help your teammate earn Perks</p>
            </div>
          </div>

          {alreadyRedeemed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center gap-3 py-10 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-2xl">
                ✅
              </div>
              <div>
                <p className="font-semibold text-foreground">Code Already Redeemed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You've already used a referral code. Thanks for connecting with the TeamUp community!
                </p>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Email verification warning */}
              {!emailVerified && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl px-4 py-3 mb-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm"
                >
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <strong>Email not verified.</strong> Check your inbox for a verification link, then click "I've Verified" below.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 ml-6">
                    <button
                      onClick={handleResendVerification}
                      disabled={resendCooldown > 0}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-200/60 dark:bg-amber-800/40 hover:bg-amber-300/60 dark:hover:bg-amber-700/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : '📧 Resend Email'}
                    </button>
                    <button
                      onClick={handleRefreshVerification}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-200/60 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-300/60 dark:hover:bg-emerald-700/40 transition-colors"
                    >
                      ✅ I've Verified
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="mb-5">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Enter Referral Code
                </label>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    value={redeemInput}
                    onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && !(!emailVerified) && handleRedeem()}
                    placeholder={emailVerified ? 'e.g. TU-AB1CD2EF' : 'Verify email first...'}
                    maxLength={12}
                    disabled={!emailVerified}
                    className="flex-1 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm font-mono font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <motion.button
                    whileHover={emailVerified ? { scale: 1.04 } : {}}
                    whileTap={emailVerified ? { scale: 0.96 } : {}}
                    onClick={handleRedeem}
                    disabled={redeeming || !redeemInput.trim() || !emailVerified}
                    className="px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    {redeeming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><Rocket className="w-4 h-4" /> Redeem</>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Result message */}
              <AnimatePresence>
                {redeemMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium mb-4 ${
                      redeemMsg.ok
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    {redeemMsg.ok ? '🎉' : '⚠️'} {redeemMsg.text}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Info note */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-xl px-3 py-3 mt-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/60" />
                <span>
                  Each code can only be redeemed once per account. The referrer earns <strong className="text-foreground">+10 Perks</strong> instantly upon redemption. <strong className="text-foreground">Email verification is required.</strong>
                </span>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Rank Ladder ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="card-base p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700">
            <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-bold text-base text-foreground">Rank Ladder</h2>
            <p className="text-xs text-muted-foreground">Earn Perks by completing tasks & referring teammates</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {PERK_RANKS.map((rank) => (
            <RankCard
              key={rank.rank}
              rank={rank}
              current={rank.rank === currentRank.rank}
            />
          ))}
        </div>

        {/* Progress bar to next rank */}
        {currentRank.maxPerks !== null && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span className="font-medium">{currentRank.emoji} {currentRank.rank}</span>
              <span>{totalEarned} / {currentRank.maxPerks + 1} perks</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(
                    100,
                    ((totalEarned - currentRank.minPerks) / ((currentRank.maxPerks + 1) - currentRank.minPerks)) * 100
                  )}%`
                }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {currentRank.maxPerks + 1 - totalEarned} more perks to reach{' '}
              {PERK_RANKS[PERK_RANKS.findIndex(r => r.rank === currentRank.rank) + 1]?.rank ?? 'max rank'}
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Ways to Earn ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="card-base p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700">
            <Star className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="font-bold text-base text-foreground">Ways to Earn Perks</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[
            {
              icon: '✅',
              title: 'Complete Tasks',
              desc: 'Earn perks when a team leader verifies your submitted task.',
              badge: 'Variable',
              color: 'from-violet-500/10 to-violet-500/5',
              border: 'border-violet-200/60 dark:border-violet-800/60',
            },
            {
              icon: '👥',
              title: 'Refer a Teammate',
              desc: 'Share your referral code. Get 10 Perks for every friend who joins.',
              badge: '+10 Perks',
              color: 'from-cyan-500/10 to-cyan-500/5',
              border: 'border-cyan-200/60 dark:border-cyan-800/60',
            },
            {
              icon: '🚀',
              title: 'Build Great Teams',
              desc: 'Lead your team to success. More wins = more tasks = more Perks.',
              badge: 'Passive',
              color: 'from-amber-500/10 to-amber-500/5',
              border: 'border-amber-200/60 dark:border-amber-800/60',
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.03, y: -3 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              className={`rounded-2xl border ${item.border} bg-gradient-to-br ${item.color} p-4`}
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-semibold text-sm text-foreground mb-1">{item.title}</div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{item.desc}</p>
              <span className="text-[10px] font-bold bg-background/80 border border-border/60 text-foreground px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default PerkShopPage;
