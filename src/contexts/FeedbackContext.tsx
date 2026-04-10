// =============================================================
// contexts/FeedbackContext.tsx
// Smart feedback rules engine — controls when popups appear
// =============================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';
import {
  submitAppFeedback,
  markFeedbackGiven,
  hasFeedbackBeenGiven,
} from '@/services/feedbackService';
import { isFirebaseConfigured } from '@/lib/firebase';

// ─── Types ─────────────────────────────────────────────────────
export type FeedbackTriggerType =
  | 'team_created'
  | 'team_joined'
  | 'skill_verified'
  | 'interview_completed'
  | 'session_count'
  | 'manual';

interface FeedbackState {
  feedbackGiven: boolean;
  lastPopupDismissed: number | null; // ms timestamp
  popupShownThisSession: boolean;
  sessionCount: number;
  triggeredTypes: string[]; // triggers already consumed
  firstSeenAt: number | null; // timestamp of very first session
}

interface FeedbackContextValue {
  showFeedbackPopup: boolean;
  triggerContext: FeedbackTriggerType | null;
  recordTrigger: (type: FeedbackTriggerType) => void;
  dismissPopup: () => void;
  submitFeedback: (rating: number, comment: string) => Promise<void>;
  openManualFeedback: boolean;
  setOpenManualFeedback: (v: boolean) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

export const useFeedback = (): FeedbackContextValue => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
};

// ─── Constants ─────────────────────────────────────────────────
const STORAGE_KEY = (uid: string) => `teamup:feedback_state_${uid}`;
const COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const MIN_SESSIONS = 3; // only for the passive "session_count" trigger

// ─── Pure rule check (no closures, no side-effects) ───────────
function shouldShow(s: FeedbackState, trigger: FeedbackTriggerType): boolean {
  // Rule 1 — already gave feedback → never show again
  if (s.feedbackGiven) return false;

  // Rule 2 — already showed popup this session → 1 per session
  if (s.popupShownThisSession) return false;

  // Rule 3 — cooldown (2+ days since last dismissal)
  if (s.lastPopupDismissed && Date.now() - s.lastPopupDismissed < COOLDOWN_MS) return false;

  // Rule 4 — for passive "session_count" trigger, require MIN_SESSIONS
  if (trigger === 'session_count' && s.sessionCount < MIN_SESSIONS) return false;

  // Rule 5 — don't show on the very first session ever (first login)
  //          BUT only block if no explicit action trigger fired
  if (trigger === 'session_count' && s.sessionCount <= 1) return false;

  // All action-based triggers (team_created, team_joined, skill_verified,
  // interview_completed) are allowed even on session 1 — they represent
  // a completed, non-first-login action.

  return true;
}

// ─── Provider ──────────────────────────────────────────────────
export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [state, setState] = useState<FeedbackState>({
    feedbackGiven: false,
    lastPopupDismissed: null,
    popupShownThisSession: false,
    sessionCount: 0,
    triggeredTypes: [],
    firstSeenAt: null,
  });

  // ★ Ref that always mirrors the latest state — solves all stale closures
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // isReady = state has been fully hydrated from localStorage + Firestore
  const [isReady, setIsReady] = useState(false);
  const isReadyRef = useRef(false);
  useEffect(() => { isReadyRef.current = isReady; }, [isReady]);

  // Queue of triggers that arrived before state was ready
  const pendingQueue = useRef<FeedbackTriggerType[]>([]);

  const [activeTrigger, setActiveTrigger] = useState<FeedbackTriggerType | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const showPopupRef = useRef(false);
  useEffect(() => { showPopupRef.current = showPopup; }, [showPopup]);

  const [openManualFeedback, setOpenManualFeedback] = useState(false);
  const initialised = useRef(false);

  // ── Helpers ───────────────────────────────────────────────
  const persist = useCallback((uid: string, s: FeedbackState) => {
    localStorage.setItem(STORAGE_KEY(uid), JSON.stringify(s));
  }, []);

  // ── Load persisted state & increment session ──────────────
  useEffect(() => {
    if (!user || initialised.current) return;
    initialised.current = true;

    const raw = localStorage.getItem(STORAGE_KEY(user.uid));
    let loaded: FeedbackState = {
      feedbackGiven: false,
      lastPopupDismissed: null,
      popupShownThisSession: false,
      sessionCount: 0,
      triggeredTypes: [],
      firstSeenAt: null,
    };

    if (raw) {
      try {
        loaded = { ...loaded, ...JSON.parse(raw) };
      } catch { /* ignore corrupt data */ }
    }

    // Always reset per-session flag & bump session count
    loaded.popupShownThisSession = false;
    loaded.sessionCount += 1;

    // Track first-ever visit
    if (!loaded.firstSeenAt) {
      loaded.firstSeenAt = Date.now();
    }

    // Hydrate feedbackGiven from Firestore (cross-device sync)
    const finalize = (given: boolean) => {
      if (given) loaded.feedbackGiven = true;
      persist(user.uid, loaded);
      setState(loaded);
      stateRef.current = loaded; // ★ Sync ref immediately (don't wait for effect)
      setIsReady(true);
      isReadyRef.current = true; // ★ Sync ref immediately

      console.log('[Feedback] ✅ State ready:', {
        sessionCount: loaded.sessionCount,
        feedbackGiven: loaded.feedbackGiven,
        lastPopupDismissed: loaded.lastPopupDismissed,
        popupShownThisSession: loaded.popupShownThisSession,
      });

      // Check if session count alone qualifies as a passive trigger
      if (!given && loaded.sessionCount >= MIN_SESSIONS) {
        pendingQueue.current.push('session_count');
      }

      // ★ Drain any pending triggers immediately after ready
      drainQueue();
    };

    if (isFirebaseConfigured()) {
      hasFeedbackBeenGiven(user.uid).then(finalize).catch(() => finalize(false));
    } else {
      finalize(false);
    }
  }, [user, persist]);

  // Reset when user logs out
  useEffect(() => {
    if (!user) {
      initialised.current = false;
      setIsReady(false);
      isReadyRef.current = false;
      setShowPopup(false);
      showPopupRef.current = false;
      setActiveTrigger(null);
      pendingQueue.current = [];
    }
  }, [user]);

  // ── Drain queued triggers ─────────────────────────────────
  const drainQueue = useCallback(() => {
    if (pendingQueue.current.length === 0) return;

    const currentState = stateRef.current;
    const queued = [...pendingQueue.current];
    pendingQueue.current = [];

    for (const t of queued) {
      if (shouldShow(currentState, t)) {
        console.log('[Feedback] ✅ Processing queued trigger:', t);
        setActiveTrigger(t);
        return; // only show 1
      } else {
        console.log('[Feedback] ⛔ Queued trigger blocked:', t);
      }
    }
  }, []);

  // Also drain when isReady or state changes (backup for async finalize)
  useEffect(() => {
    if (!isReady || !user) return;
    drainQueue();
  }, [isReady, user, drainQueue]);

  // ── Show popup when activeTrigger is set ───────────────────
  useEffect(() => {
    if (!activeTrigger) return;
    if (!isReadyRef.current) return;

    const currentState = stateRef.current;

    if (shouldShow(currentState, activeTrigger)) {
      // Delay so we don't interrupt the user mid-action
      const timer = setTimeout(() => {
        console.log('[Feedback] 🎉 Showing popup for trigger:', activeTrigger);
        setShowPopup(true);
        showPopupRef.current = true;
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      console.log('[Feedback] ⛔ Trigger blocked by rules:', activeTrigger, {
        feedbackGiven: currentState.feedbackGiven,
        popupShownThisSession: currentState.popupShownThisSession,
        lastPopupDismissed: currentState.lastPopupDismissed,
        cooldownRemaining: currentState.lastPopupDismissed
          ? Math.max(0, COOLDOWN_MS - (Date.now() - currentState.lastPopupDismissed))
          : 0,
      });
      setActiveTrigger(null);
    }
  }, [activeTrigger]);

  // ── Public API ────────────────────────────────────────────
  // ★ Uses refs exclusively — never stale
  const recordTrigger = useCallback(
    (type: FeedbackTriggerType) => {
      if (!user) return;

      const currentState = stateRef.current;
      const ready = isReadyRef.current;
      const popupVisible = showPopupRef.current;

      console.log('[Feedback] 📥 Trigger received:', type, {
        isReady: ready,
        feedbackGiven: currentState.feedbackGiven,
        popupShownThisSession: currentState.popupShownThisSession,
        showPopup: popupVisible,
      });

      // Quick guard: already gave feedback or already showing
      if (currentState.feedbackGiven) {
        console.log('[Feedback] ⛔ Blocked: feedback already given');
        return;
      }
      if (popupVisible) {
        console.log('[Feedback] ⛔ Blocked: popup already visible');
        return;
      }

      if (!ready) {
        // State isn't hydrated yet — queue for later
        console.log('[Feedback] ⏳ Queuing trigger (not ready yet):', type);
        pendingQueue.current.push(type);
        return;
      }

      // State is ready — evaluate immediately
      if (shouldShow(currentState, type)) {
        console.log('[Feedback] ✅ Trigger accepted, setting activeTrigger:', type);
        setActiveTrigger(type);
      } else {
        console.log('[Feedback] ⛔ Trigger blocked by shouldShow:', type);
      }
    },
    [user] // ★ Only depends on user — reads everything else from refs
  );

  const dismissPopup = useCallback(() => {
    if (!user) return;
    setShowPopup(false);
    showPopupRef.current = false;
    setActiveTrigger(null);

    setState((prev) => {
      const next: FeedbackState = {
        ...prev,
        popupShownThisSession: true,
        lastPopupDismissed: Date.now(),
      };
      persist(user.uid, next);
      stateRef.current = next; // ★ Sync immediately
      return next;
    });
  }, [user, persist]);

  const submitFeedbackFn = useCallback(
    async (rating: number, comment: string) => {
      if (!user) return;
      const trigger = activeTrigger || 'manual';

      if (isFirebaseConfigured()) {
        await submitAppFeedback(user.uid, { rating, comment, triggerType: trigger });
        await markFeedbackGiven(user.uid);
      }

      setShowPopup(false);
      showPopupRef.current = false;
      setActiveTrigger(null);

      setState((prev) => {
        const next: FeedbackState = {
          ...prev,
          feedbackGiven: true,
          popupShownThisSession: true,
        };
        persist(user.uid, next);
        stateRef.current = next; // ★ Sync immediately
        return next;
      });
    },
    [user, activeTrigger, persist]
  );

  // ── Listen for custom trigger events from child components ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type) {
        console.log('[Feedback] 📡 CustomEvent received:', detail.type);
        recordTrigger(detail.type);
      }
    };

    window.addEventListener('teamup:feedback_trigger', handler);
    return () => window.removeEventListener('teamup:feedback_trigger', handler);
  }, [recordTrigger]);

  return (
    <FeedbackContext.Provider
      value={{
        showFeedbackPopup: showPopup,
        triggerContext: activeTrigger,
        recordTrigger,
        dismissPopup,
        submitFeedback: submitFeedbackFn,
        openManualFeedback,
        setOpenManualFeedback,
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
};
