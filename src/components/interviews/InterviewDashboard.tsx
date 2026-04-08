// =============================================================
// components/interviews/InterviewDashboard.tsx
// Interview dashboard: Requests tab + Scheduled tab
// =============================================================

import { useState, useEffect } from 'react';
import { Video, BookOpen, Calendar, Clock, User, CheckCircle, XCircle, Loader2, Play, ChevronRight, Shield } from 'lucide-react';
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

interface Props {
  onStartInterview: (request: InterviewRequest) => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
  terminated: 'bg-gray-100 text-gray-700',
};

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
}) => (
  <div className="card-base p-4 space-y-3">
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${request.type === 'video' ? 'bg-primary/10' : 'bg-accent/10'}`}>
          {request.type === 'video' ? (
            <Video className="w-4 h-4 text-primary" />
          ) : (
            <BookOpen className="w-4 h-4 text-accent" />
          )}
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground">
            {request.type === 'video' ? 'Video Interview' : 'Quiz Interview'}
          </p>
          <p className="text-xs text-muted-foreground">{request.teamName}</p>
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[request.status] || 'bg-gray-100 text-gray-600'}`}>
        {request.status}
      </span>
    </div>

    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <User className="w-3 h-3" />
        {viewAs === 'candidate' ? `From: ${request.leaderName}` : `Candidate: ${request.candidateName}`}
      </span>
      <span className="flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        {formatScheduled(request.scheduledAt)}
      </span>
    </div>

    {request.type === 'quiz' && request.quizConfig && (
      <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
        Topics: {request.quizConfig.topics.join(', ')} · {request.quizConfig.numQuestions} Qs · {request.quizConfig.timeLimitMinutes} min
      </div>
    )}

    {/* Actions */}
    <div className="flex gap-2 pt-1">
      {/* Candidate: accept/reject pending requests */}
      {viewAs === 'candidate' && request.status === 'pending' && (
        <>
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-500/10 text-green-600 text-sm font-medium hover:bg-green-500/20 transition-colors"
          >
            <CheckCircle className="w-4 h-4" /> Accept
          </button>
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-500/10 text-red-600 text-sm font-medium hover:bg-red-500/20 transition-colors"
          >
            <XCircle className="w-4 h-4" /> Reject
          </button>
        </>
      )}

      {/* Candidate: start accepted interview */}
      {viewAs === 'candidate' && request.status === 'accepted' && (
        <button
          onClick={onStart}
          className="flex-1 btn-primary flex items-center justify-center gap-1.5 py-1.5 text-sm"
        >
          <Play className="w-4 h-4" /> Start Interview
        </button>
      )}

      {/* Leader: open accepted interview (to send/monitor) */}
      {viewAs === 'leader' && request.status === 'accepted' && (
        <button
          onClick={onStart}
          className="flex-1 btn-primary flex items-center justify-center gap-1.5 py-1.5 text-sm"
        >
          <Play className="w-4 h-4" /> Open Interview
        </button>
      )}

      {/* Leader: view results for completed/terminated interviews */}
      {viewAs === 'leader' && (request.status === 'completed' || request.status === 'terminated') && (
        <button
          onClick={onStart}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
        >
          <Play className="w-4 h-4" /> View Results
        </button>
      )}
    </div>
  </div>
);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-base p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Interviews</h1>
            <p className="text-muted-foreground">Manage interview requests and sessions</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setTab('requests')}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'requests' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            Requests
            {pendingCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('scheduled')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'scheduled' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            Sent
            {outgoing.filter((r) => r.status === 'completed' || r.status === 'terminated').length > 0 && (
              <span className="w-5 h-5 rounded-full bg-accent text-white text-xs flex items-center justify-center">
                {outgoing.filter((r) => r.status === 'completed' || r.status === 'terminated').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === 'requests' && (
        <div className="space-y-3">
          {incoming.length === 0 ? (
            <div className="card-base p-10 text-center">
              <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No interview requests yet</p>
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
            <div className="card-base p-10 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No interviews scheduled yet</p>
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