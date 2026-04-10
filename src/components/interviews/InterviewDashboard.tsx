// =============================================================
// components/interviews/InterviewDashboard.tsx
// Interview dashboard: Requests tab + Scheduled tab — Redesigned
// =============================================================

import { useState, useEffect } from 'react';
import { Video, BookOpen, Calendar, Clock, User, CheckCircle, XCircle, Loader2, Play, ChevronRight, Shield, Inbox, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToMyInterviewRequests,
  subscribeToLeaderInterviews,
  respondToInterviewRequest,
  InterviewRequest,
} from '@/services/firestore_interviews';
import { isFirebaseConfigured } from '@/lib/firebase';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface Props {
  onStartInterview: (request: InterviewRequest) => void;
}

const formatScheduled = (ts: Timestamp) => {
  if (!ts?.toDate) return 'TBD';
  const d = ts.toDate();
  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const InterviewCard = ({
  request,
  viewAs,
  onAccept,
  onReject,
  onStart,
}: {
  request: InterviewRequest;
  viewAs: 'candidate' | 'leader';
  onAccept?: () => void;
  onReject?: () => void;
  onStart?: () => void;
}) => {
  const statusStyles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-600 border-red-200',
    completed: 'bg-blue-50 text-blue-700 border-blue-200',
    terminated: 'bg-gray-50 text-gray-600 border-gray-200',
  };

  const typeColor = request.type === 'video' ? 'primary' : 'accent';

  return (
    <div className="card-base p-5 relative overflow-hidden transition-all duration-200 hover:shadow-lg group">
      {/* Left accent bar */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 rounded-r-full",
        request.type === 'video' ? "bg-primary" : "bg-accent"
      )} />

      <div className="pl-3 space-y-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-xl",
              request.type === 'video' ? 'bg-primary/10' : 'bg-accent/10'
            )}>
              {request.type === 'video' ? (
                <Video className={cn("w-5 h-5", `text-${typeColor}`)} />
              ) : (
                <BookOpen className={cn("w-5 h-5", `text-${typeColor}`)} />
              )}
            </div>
            <div>
              <p className="font-display font-bold text-sm text-foreground">
                {request.type === 'video' ? 'Video Interview' : 'Quiz Interview'}
              </p>
              <p className="text-xs text-muted-foreground">{request.teamName}</p>
            </div>
          </div>
          <span className={cn(
            "px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize",
            statusStyles[request.status] || 'bg-gray-50 text-gray-600 border-gray-200'
          )}>
            {request.status}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {viewAs === 'candidate' ? `From: ${request.leaderName}` : `Candidate: ${request.candidateName}`}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatScheduled(request.scheduledAt)}
          </span>
        </div>

        {/* Quiz config */}
        {request.type === 'quiz' && request.quizConfig && (
          <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2 flex items-center gap-3">
            <span>📝 {request.quizConfig.topics.join(', ')}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{request.quizConfig.numQuestions} Qs</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{request.quizConfig.timeLimitMinutes} min</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {/* Candidate: accept/reject pending requests */}
          {viewAs === 'candidate' && request.status === 'pending' && (
            <>
              <button
                onClick={onAccept}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 text-sm font-semibold hover:bg-emerald-500/20 transition-colors"
              >
                <CheckCircle className="w-4 h-4" /> Accept
              </button>
              <button
                onClick={onReject}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/10 text-red-600 text-sm font-semibold hover:bg-red-500/20 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </>
          )}

          {/* Candidate: start accepted interview */}
          {viewAs === 'candidate' && request.status === 'accepted' && (
            <button
              onClick={onStart}
              className="flex-1 btn-primary flex items-center justify-center gap-1.5 py-2 text-sm"
            >
              <Play className="w-4 h-4" /> Start Interview
            </button>
          )}

          {/* Leader: open accepted interview */}
          {viewAs === 'leader' && request.status === 'accepted' && (
            <button
              onClick={onStart}
              className="flex-1 btn-primary flex items-center justify-center gap-1.5 py-2 text-sm"
            >
              <Play className="w-4 h-4" /> Open Interview
            </button>
          )}

          {/* Leader: view results */}
          {viewAs === 'leader' && (request.status === 'completed' || request.status === 'terminated') && (
            <button
              onClick={onStart}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-accent/10 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors"
            >
              <Play className="w-4 h-4" /> View Results
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const InterviewDashboard = ({ onStartInterview }: Props) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'requests' | 'scheduled'>('requests');
  const [incoming, setIncoming] = useState<InterviewRequest[]>([]);
  const [outgoing, setOutgoing] = useState<InterviewRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    let unsub1: (() => void) | undefined;
    let unsub2: (() => void) | undefined;

    // Safety net — never spin forever if indexes are missing or DB is cold
    const timeout = setTimeout(() => setLoading(false), 5000);

    try {
      unsub1 = subscribeToMyInterviewRequests(user.uid, (data) => {
        setIncoming(data);
        setLoading(false);
        clearTimeout(timeout);
      });
    } catch (err) {
      console.error('Interview requests subscription error:', err);
      setLoading(false);
      clearTimeout(timeout);
    }

    try {
      unsub2 = subscribeToLeaderInterviews(user.uid, (data) => {
        setOutgoing(data);
      });
    } catch (err) {
      console.error('Leader interviews subscription error:', err);
    }

    return () => {
      clearTimeout(timeout);
      unsub1?.();
      unsub2?.();
    };
  }, [user]);

  const handleAccept = async (req: InterviewRequest) => {
    try {
      await respondToInterviewRequest(req.id, 'accepted');
      toast.success('Interview accepted!');
    } catch {
      toast.error('Failed to accept');
    }
  };

  const handleReject = async (req: InterviewRequest) => {
    try {
      await respondToInterviewRequest(req.id, 'rejected');
      toast.success('Interview rejected');
    } catch {
      toast.error('Failed to reject');
    }
  };

  const pendingCount = incoming.filter((r) => r.status === 'pending').length;
  const acceptedCount = incoming.filter((r) => r.status === 'accepted').length;
  const completedCount = [...incoming, ...outgoing].filter((r) => r.status === 'completed').length;
  const totalCount = incoming.length + outgoing.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ═══════════════════════════════════════════
          HEADER
         ═══════════════════════════════════════════ */}
      <div className="card-base p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Interviews</h1>
            <p className="text-sm text-muted-foreground">Manage interview requests and sessions</p>
          </div>
        </div>

        {/* ── Quick Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="stat-card">
            <span className="stat-card-value text-amber-600">{pendingCount}</span>
            <span className="stat-card-label">Pending</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-value text-emerald-600">{acceptedCount}</span>
            <span className="stat-card-label">Accepted</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-value text-blue-600">{completedCount}</span>
            <span className="stat-card-label">Completed</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-value text-foreground">{totalCount}</span>
            <span className="stat-card-label">Total</span>
          </div>
        </div>

        {/* ── Segment Control Tabs ── */}
        <div className="segment-control">
          <button
            onClick={() => setTab('requests')}
            className={cn("segment-control-item", tab === 'requests' && 'active')}
          >
            <span className="flex items-center gap-1.5">
              <Inbox className="w-3.5 h-3.5" />
              Requests
            </span>
            {pendingCount > 0 && (
              <span className="ml-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('scheduled')}
            className={cn("segment-control-item", tab === 'scheduled' && 'active')}
          >
            <span className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />
              Sent
            </span>
            {outgoing.filter((r) => r.status === 'completed' || r.status === 'terminated').length > 0 && (
              <span className="ml-1.5 w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                {outgoing.filter((r) => r.status === 'completed' || r.status === 'terminated').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          CONTENT
         ═══════════════════════════════════════════ */}
      {tab === 'requests' && (
        <div className="space-y-3">
          {incoming.length === 0 ? (
            <div className="card-base p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary/40" />
              </div>
              <p className="text-muted-foreground font-medium">No interview requests yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">When a team leader schedules an interview, it'll appear here.</p>
            </div>
          ) : (
            incoming.map((req) => (
              <InterviewCard
                key={req.id}
                request={req}
                viewAs="candidate"
                onAccept={() => handleAccept(req)}
                onReject={() => handleReject(req)}
                onStart={() => onStartInterview(req)}
              />
            ))
          )}
        </div>
      )}

      {tab === 'scheduled' && (
        <div className="space-y-3">
          {outgoing.length === 0 ? (
            <div className="card-base p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-primary/40" />
              </div>
              <p className="text-muted-foreground font-medium">No interviews scheduled yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Interviews you've sent to candidates will appear here.</p>
            </div>
          ) : (
            outgoing.map((req) => (
              <InterviewCard
                key={req.id}
                request={req}
                viewAs="leader"
                onStart={() => onStartInterview(req)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default InterviewDashboard;