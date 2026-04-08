// src/components/FeedbackModal.tsx
import { useState, useEffect } from 'react';
import { Star, X } from 'lucide-react';
import { submitAppFeedback } from '@/services/firestore_app_feedback';

interface FeedbackModalProps {
  teamId: string;
  onClose: () => void;
}

const FeedbackModal = ({ teamId, onClose }: FeedbackModalProps) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

 const handleSubmit = async () => {
  console.log("Submit clicked");
  console.log("Rating:", rating);
  console.log("Message:", message);

  if (rating === 0) {
    alert("Please select a rating ⭐");
    return;
  }

  setLoading(true);

  try {
    console.log("Calling Firebase...");

    await submitAppFeedback({ teamId, rating, message });

    console.log("SUCCESS ✅");

    localStorage.setItem(`feedback_${teamId}`, 'done');
    setSubmitted(true);
  } catch (err) {
    console.error("ERROR ❌", err);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4 relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        {submitted ? (
          <div className="text-center space-y-4">
            <h2 className="text-lg font-semibold text-green-600">
              🎉 Thank you for your feedback!
            </h2>
            <p className="text-sm text-muted-foreground">
              Your input helps us improve TeamUp 🚀
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded-lg"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-center">
              🚀 Project Successfully Launched!
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              Rate your TeamUp experience
            </p>

            {/* Stars */}
            <div className="flex justify-center gap-2">
              {[1,2,3,4,5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= (hover || rating)
                        ? 'text-yellow-400 fill-yellow-400 scale-110'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Message */}
            <textarea
              placeholder="Optional feedback..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
            />

            {/* Buttons */}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 btn-secondary">
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || rating === 0}
                className="flex-1 btn-primary"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;