// =============================================================
// components/FeedbackPopup.tsx
// Premium animated feedback modal with star rating
// =============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, MessageSquareHeart, Send, Loader2, Sparkles } from 'lucide-react';
import { useFeedback } from '@/contexts/FeedbackContext';
import { toast } from 'sonner';

// ─── Trigger-aware contextual copy ─────────────────────────
const triggerCopy: Record<string, { title: string; subtitle: string }> = {
  team_created: {
    title: 'Team created! \u{1F389}',
    subtitle: 'How has your TeamUp experience been so far?',
  },
  team_joined: {
    title: 'Welcome to the team! \u{1F91D}',
    subtitle: "We'd love to hear how your journey has been.",
  },
  skill_verified: {
    title: 'Skills verified! \u2705',
    subtitle: 'How was the verification experience?',
  },
  interview_completed: {
    title: 'Interview wrapped up! \u{1F3A4}',
    subtitle: 'How are you finding TeamUp so far?',
  },
  session_count: {
    title: 'Hey, welcome back! \u{1F44B}',
    subtitle: "You've been using TeamUp for a while \u2014 we'd love your thoughts!",
  },
};

const defaultCopy = {
  title: "How's TeamUp working for you?",
  subtitle: 'Your feedback helps us improve the platform.',
};

// ─── Interactive Star ──────────────────────────────────────
function InteractiveStar({
  index,
  rating,
  hovered,
  onRate,
  onHover,
}: {
  index: number;
  rating: number;
  hovered: number;
  onRate: (n: number) => void;
  onHover: (n: number) => void;
}) {
  const filled = index <= (hovered || rating);

  return (
    <motion.button
      type="button"
      onClick={() => onRate(index)}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(0)}
      whileHover={{ scale: 1.25 }}
      whileTap={{ scale: 0.9 }}
      className="focus:outline-none"
    >
      <Star
        className={`w-8 h-8 transition-colors duration-150 ${
          filled
            ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
            : 'text-gray-300'
        }`}
      />
    </motion.button>
  );
}

// ─── Labels ────────────────────────────────────────────────
const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing!'];

// ─── Main Component ────────────────────────────────────────
const FeedbackPopup = () => {
  const { showFeedbackPopup, triggerContext, dismissPopup, submitFeedback } = useFeedback();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const copy = triggerContext ? triggerCopy[triggerContext] || defaultCopy : defaultCopy;

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await submitFeedback(rating, comment.trim());
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setRating(0);
        setComment('');
      }, 2000);
    } catch (err: any) {
      console.error('Feedback submission failed:', err);
      toast.error(err?.message || 'Failed to submit feedback. Please try again.');
    }
    setSubmitting(false);
  };

  const handleDismiss = () => {
    dismissPopup();
    setRating(0);
    setComment('');
    setHovered(0);
  };

  return (
    <AnimatePresence>
      {showFeedbackPopup && (
        <>
          {/* Backdrop */}
          <motion.div
            key="feedback-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleDismiss}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="feedback-modal"
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[61] flex items-center justify-center pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-md mx-4 rounded-2xl border border-border overflow-hidden relative"
              style={{
                background:
                  'linear-gradient(160deg, hsl(0 0% 100% / 0.95) 0%, hsl(174 30% 98% / 0.95) 100%)',
                backdropFilter: 'blur(24px)',
                boxShadow:
                  '0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1) inset',
              }}
            >
              {submitted ? (
                /* ── Success State ── */
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1 }}
                    className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center"
                  >
                    <Sparkles className="w-8 h-8 text-primary" />
                  </motion.div>
                  <h3 className="font-display font-bold text-xl text-foreground mb-1">
                    Thank you! {'\u{1F49A}'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your feedback means the world to us.
                  </p>
                </motion.div>
              ) : (
                /* ── Form State ── */
                <>
                  {/* Header accent strip */}
                  <div className="h-1.5 bg-gradient-to-r from-primary via-primary/80 to-accent" />

                  <div className="p-6">
                    {/* Close button */}
                    <button
                      onClick={handleDismiss}
                      className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-secondary/80 transition-colors"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {/* Icon + Title */}
                    <div className="flex items-start gap-3 mb-5">
                      <div className="p-2.5 rounded-xl bg-primary/10 flex-shrink-0">
                        <MessageSquareHeart className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="font-display font-bold text-lg text-foreground leading-tight">
                          {copy.title}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">{copy.subtitle}</p>
                      </div>
                    </div>

                    {/* Star Rating */}
                    <div className="text-center mb-5">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <InteractiveStar
                            key={i}
                            index={i}
                            rating={rating}
                            hovered={hovered}
                            onRate={setRating}
                            onHover={setHovered}
                          />
                        ))}
                      </div>
                      <AnimatePresence mode="wait">
                        {(hovered || rating) > 0 && (
                          <motion.p
                            key={hovered || rating}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="text-sm font-medium text-primary"
                          >
                            {ratingLabels[hovered || rating]}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Comment */}
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us more (optional)..."
                      rows={3}
                      className="input-field resize-none mb-4 text-sm"
                    />

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={handleDismiss}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
                      >
                        Not now
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={rating === 0 || submitting}
                        className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Submit Feedback
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FeedbackPopup;
