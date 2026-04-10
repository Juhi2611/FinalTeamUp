/**
 * PerkTransactionLog.tsx
 * ─────────────────────
 * Scrollable perk history list for a user.
 * Shows credits (green) and debits (red) with icon, description, amount and date.
 */

import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Loader2, History } from 'lucide-react';
import { subscribeToUserPerkTransactions } from '@/services/perksService';
import type { PerkTransaction, PerkTransactionType } from '@/types/firestore.types';

// ── Icon + colour config per type ───────────────────────────────────────────

const TYPE_META: Record<
  PerkTransactionType,
  { emoji: string; label: string; colour: string; bg: string }
> = {
  signup_bonus:     { emoji: '🎉', label: 'Signup Bonus',     colour: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200'  },
  team_join:        { emoji: '🤝', label: 'Team Join',        colour: 'text-rose-600',    bg: 'bg-rose-50 border-rose-200'        },
  team_create:      { emoji: '🚀', label: 'Team Created',     colour: 'text-rose-600',    bg: 'bg-rose-50 border-rose-200'        },
  interview:        { emoji: '🎤', label: 'Interview',        colour: 'text-rose-600',    bg: 'bg-rose-50 border-rose-200'        },
  task_reward:      { emoji: '✅', label: 'Task Reward',      colour: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200'  },
  deadline_penalty: { emoji: '⏰', label: 'Deadline Penalty', colour: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200'        },
  referral:         { emoji: '🎁', label: 'Referral',         colour: 'text-violet-600',  bg: 'bg-violet-50 border-violet-200'    },
};

// ── Helper ───────────────────────────────────────────────────────────────────

function formatDate(ts: any): string {
  if (!ts) return '—';
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface PerkTransactionLogProps {
  userId: string;
  className?: string;
  maxItems?: number;
}

export const PerkTransactionLog = ({
  userId, className = '', maxItems = 20,
}: PerkTransactionLogProps) => {
  const [txs, setTxs]         = useState<PerkTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const unsub = subscribeToUserPerkTransactions(userId, (data) => {
      setTxs(data);
      setLoading(false);
    }, maxItems);
    return unsub;
  }, [userId, maxItems]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (txs.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-10 text-muted-foreground ${className}`}>
        <History className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm">No perk transactions yet.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 max-h-72 overflow-y-auto pr-1 ${className}`}>
      {txs.map((tx) => {
        const meta   = TYPE_META[tx.type] ?? { emoji: '💠', label: tx.type, colour: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' };
        const isGain = tx.amount > 0;

        return (
          <div
            key={tx.id}
            className={`flex items-start gap-3 p-3 rounded-xl border ${meta.bg} transition-all`}
          >
            {/* Emoji icon */}
            <span className="text-lg leading-none mt-0.5 shrink-0">{meta.emoji}</span>

            {/* Description + date */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground/90 leading-snug">
                {tx.description}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(tx.createdAt)}</p>
            </div>

            {/* Amount */}
            <div className={`flex items-center gap-1 shrink-0 font-bold text-sm ${meta.colour}`}>
              {isGain
                ? <TrendingUp  className="w-3.5 h-3.5" />
                : <TrendingDown className="w-3.5 h-3.5" />}
              {isGain ? '+' : ''}{tx.amount}
              <Sparkles className="w-3 h-3 opacity-60" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PerkTransactionLog;
