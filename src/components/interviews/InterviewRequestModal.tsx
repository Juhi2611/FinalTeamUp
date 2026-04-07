// =============================================================
// components/interviews/InterviewRequestModal.tsx
// Modal for team leader to send interview request to a candidate
// =============================================================

import { useState } from 'react';
import { X, Video, BookOpen, Calendar, Clock, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createInterviewRequest } from '@/services/firestore_interviews';
import { UserProfile, Team } from '@/services/firestore';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { getProfile } from '@/services/firestore';

interface Props {
  candidate: UserProfile;
  leaderTeams: Team[]; // Teams where current user is leader
  onClose: () => void;
}

const InterviewRequestModal = ({ candidate, leaderTeams, onClose }: Props) => {
  const { user } = useAuth();
  const [selectedTeamId, setSelectedTeamId] = useState(leaderTeams[0]?.id || '');
  const [type, setType] = useState<'video' | 'quiz'>('video');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [loading, setLoading] = useState(false);

  // Quiz config
  const [topics, setTopics] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [numQuestions, setNumQuestions] = useState(10);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);

  const selectedTeam = leaderTeams.find((t) => t.id === selectedTeamId);

  const handleSubmit = async () => {
    if (!user || !selectedTeam) return;
    if (!scheduledDate || !scheduledTime) {
      toast.error('Please select a date and time');
      return;
    }

    setLoading(true);
    try {
      const scheduledAt = Timestamp.fromDate(
        new Date(`${scheduledDate}T${scheduledTime}`)
      );

      await createInterviewRequest({
        teamId: selectedTeam.id,
        teamName: selectedTeam.name,
        leaderId: user.uid,
        leaderName: selectedTeam.leaderName || user.displayName || 'Leader',
        candidateId: candidate.id,
        candidateName: candidate.fullName,
        type,
        scheduledAt,
        ...(type === 'quiz' && {
          quizConfig: {
            topics: topics.split(',').map((t) => t.trim()).filter(Boolean),
            difficulty,
            numQuestions,
            timeLimitMinutes,
          },
        }),
      });

      toast.success(`Interview request sent to ${candidate.fullName}!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send interview request');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-display font-bold text-xl text-foreground">Schedule Interview</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              with <span className="text-foreground font-medium">{candidate.fullName}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Team Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Team *</label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="input-field"
            >
              {leaderTeams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>

          {/* Interview Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Interview Type *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setType('video')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  type === 'video'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                <Video className="w-6 h-6" />
                <span className="text-sm font-medium">Video Interview</span>
                <span className="text-xs opacity-70">Live 1-on-1 call</span>
              </button>
              <button
                onClick={() => setType('quiz')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  type === 'quiz'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                <BookOpen className="w-6 h-6" />
                <span className="text-sm font-medium">Quiz Interview</span>
                <span className="text-xs opacity-70">AI-generated MCQs</span>
              </button>
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />Date *
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <Clock className="w-3.5 h-3.5 inline mr-1" />Time *
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Quiz Config */}
          {type === 'quiz' && (
            <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">AI Quiz Configuration</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Topics (comma-separated) *
                </label>
                <input
                  type="text"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="e.g. React, TypeScript, System Design"
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="input-field text-sm"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Questions</label>
                  <select
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(Number(e.target.value))}
                    className="input-field text-sm"
                  >
                    {[5, 10, 15, 20].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Time (min)</label>
                  <select
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                    className="input-field text-sm"
                  >
                    {[15, 20, 30, 45, 60].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedTeamId}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewRequestModal;
