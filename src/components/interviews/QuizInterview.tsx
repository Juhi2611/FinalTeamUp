// =============================================================
// components/interviews/QuizInterview.tsx
//
// INTERVIEWER (leaderId):
//   - Generates questions silently on first open
//   - Sees waiting screen (does NOT need to stay online)
//   - On re-open after candidate finishes → sees 3 options:
//     1. View Recording  2. Quiz Report  3. Add to Team
//
// CANDIDATE (candidateId):
//   - Sees a single "Start Quiz" button
//   - Takes the quiz with timer + proctoring + camera
//   - Submits → done
// =============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  BookOpen, Clock, AlertTriangle, CheckCircle, ChevronRight,
  Loader2, Shield, Video, Mic, MicOff, VideoOff,
  Play, FileText, UserPlus, ExternalLink, X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProctoring } from '@/hooks/useProctoring';
import { useFaceProctoring } from '@/hooks/useFaceProctoring';
import ProctoringAlert from '@/components/interviews/ProctoringAlert';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { uploadRecording } from '@/services/supabase_recordings';
import { generateQuizQuestions } from '@/services/openai_quiz';
import {
  storeQuizQuestions,
  getQuizQuestions,
  submitQuizAnswer,
  getQuizAnswers,
  createInterviewReport,
  updateInterviewStatus,
  getInterviewReport,
  InterviewRequest,
  QuizQuestion,
  InterviewReport,
  ProctoringWarning,
} from '@/services/firestore_interviews';
import { addTeamMember, getProfile } from '@/services/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

interface Props {
  request: InterviewRequest;
  onEnd: () => void;
}

// ─────────────────────────────────────────────────────────────
// INTERVIEWER VIEW — shown to the person who sent the request
// ─────────────────────────────────────────────────────────────
const InterviewerView = ({ request, onEnd }: { request: InterviewRequest; onEnd: () => void }) => {
  const [status, setStatus] = useState<'preparing' | 'waiting' | 'results'>('preparing');
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [addingToTeam, setAddingToTeam] = useState(false);
  const [addedToTeam, setAddedToTeam] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<
    { question: string; selected: string; correct: string; isCorrect: boolean }[]
  >([]);

  const checkForResults = async () => {
    try {
      const rep = await getInterviewReport(request.id);
      if (rep && rep.score !== undefined) {
        setReport(rep as any);
        setStatus('results');
        return true;
      }
    } catch (err) {
      console.warn('Could not fetch report:', err);
    }
    return false;
  };

  useEffect(() => {
    const setup = async () => {
      try {
        // Check if quiz already completed
        const found = await checkForResults();
        if (found) return;

        // Generate questions if not yet done
        const existing = await getQuizQuestions(request.id);
        if (existing.length === 0) {
          const config = request.quizConfig!;
          const generated = await generateQuizQuestions({
            topics: config.topics,
            difficulty: config.difficulty,
            numQuestions: config.numQuestions,
          });
          await storeQuizQuestions(
            request.id,
            generated.map((q, i) => ({ ...q, order: i }))
          );
        }

        setStatus('waiting');

        // Poll every 6s for candidate completion
        const poll = setInterval(async () => {
          const found = await checkForResults();
          if (found) clearInterval(poll);
        }, 6000);

        return () => clearInterval(poll);
      } catch (err: any) {
        toast.error(err.message || 'Failed to prepare quiz');
        setStatus('waiting');
      }
    };
    setup();
  }, []);

  const handleAddToTeam = async () => {
    setAddingToTeam(true);
    try {
      const profile = await getProfile(request.candidateId);
      await addTeamMember(request.teamId, request.candidateId, profile?.primaryRole || 'Team Member');
      setAddedToTeam(true);
      toast.success(`${request.candidateName} added to ${request.teamName}!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member');
    }
    setAddingToTeam(false);
  };

  const handleViewReport = async () => {
    setLoadingReport(true);
    try {
      const qs = await getQuizQuestions(request.id);
      const ans = await getQuizAnswers(request.id, request.candidateId);
      const map = Object.fromEntries(ans.map(a => [a.questionId, a.selectedOption]));
      setQuizAnswers(qs.map(q => ({
        question: q.question,
        selected: map[q.id] || 'Not answered',
        correct: q.correct_answer,
        isCorrect: map[q.id] === q.correct_answer,
      })));
      setShowReport(true);
    } catch {
      toast.error('Failed to load report');
    }
    setLoadingReport(false);
  };

  const scoreColor = (report?.score ?? 0) >= 70 ? 'text-green-600'
    : (report?.score ?? 0) >= 40 ? 'text-yellow-600' : 'text-red-600';

  // Report detail view
  if (showReport) {
    return (
      <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-4">
          <div className="flex items-center justify-between sticky top-0 bg-background py-3">
            <h2 className="font-display font-bold text-2xl text-foreground">Quiz Report</h2>
            <button onClick={() => setShowReport(false)} className="btn-secondary flex items-center gap-2">
              <X className="w-4 h-4" /> Close Report
            </button>
          </div>
          <div className="card-base p-5 flex items-center gap-6">
            <div className="text-center min-w-[90px]">
              <p className={`text-5xl font-bold ${scoreColor}`}>{report?.score ?? 0}%</p>
              <p className="text-xs text-muted-foreground mt-1">Final Score</p>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>Candidate: <span className="text-foreground font-semibold">{request.candidateName}</span></p>
              <p>Correct: <span className="text-green-600 font-semibold">{report?.correctAnswers ?? 0} / {report?.totalQuestions ?? 0}</span></p>
              <p>Warnings: <span className="font-semibold">{report?.warnings?.length ?? 0}</span></p>
              {report?.terminated && <p className="text-red-500 font-semibold">⚠️ Interview was terminated</p>}
            </div>
          </div>
          {quizAnswers.map((qa, i) => (
            <div key={i} className={`card-base p-4 border-l-4 ${qa.isCorrect ? 'border-green-500' : 'border-red-400'}`}>
              <p className="font-semibold text-foreground mb-2">{i + 1}. {qa.question}</p>
              <p className={`text-sm ${qa.isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                {qa.isCorrect ? '✓' : '✗'} Answered: <span className="font-medium">{qa.selected}</span>
              </p>
              {!qa.isCorrect && (
                <p className="text-sm text-green-600 mt-1">
                  ✓ Correct: <span className="font-medium">{qa.correct}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Preparing
  if (status === 'preparing') {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-xl font-semibold text-foreground">Generating quiz questions...</p>
          <p className="text-muted-foreground">AI is preparing questions for {request.candidateName}</p>
        </div>
      </div>
    );
  }

  // Waiting for candidate
  if (status === 'waiting') {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50 p-4">
        <div className="card-base p-8 max-w-md w-full text-center space-y-5">
          <div className="p-4 rounded-full bg-primary/10 w-16 h-16 mx-auto flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl text-foreground">Quiz Sent!</h2>
            <p className="text-muted-foreground mt-2">
              Waiting for <span className="font-semibold text-foreground">{request.candidateName}</span> to complete the quiz.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-secondary/50 border border-border text-sm text-muted-foreground text-left space-y-1">
            <p className="font-semibold text-foreground mb-1">What happens next?</p>
            <p>• The candidate will see a "Start Quiz" button</p>
            <p>• They take the quiz at their own time</p>
            <p>• You'll see results when you re-open this interview</p>
            <p>• You do NOT need to stay on this page</p>
          </div>
          <button
            onClick={async () => {
              const found = await checkForResults();
              if (!found) toast.info('No results yet — candidate hasn`t finished');
            }}
            className="btn-secondary w-full"
          >
            🔄 Check for Results Now
          </button>
          <button onClick={onEnd} className="btn-primary w-full">Done — I'll check back later</button>
        </div>
      </div>
    );
  }

  // Results — 3 action buttons
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50 p-4">
      <div className="card-base p-8 max-w-md w-full text-center space-y-6">
        <div className="p-4 rounded-full bg-green-500/10 w-16 h-16 mx-auto flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="font-display font-bold text-2xl text-foreground">Quiz Complete</h2>
          <p className="text-muted-foreground mt-1">
            {request.candidateName} has finished the quiz
          </p>
        </div>

        {/* Score */}
        {report && (
          <div className={`text-6xl font-bold ${scoreColor}`}>
            {report.score}%
            <p className="text-sm font-normal text-muted-foreground mt-1">
              {report.correctAnswers} / {report.totalQuestions} correct
            </p>
            {report.terminated && (
              <p className="text-sm font-normal text-red-500 mt-1">⚠️ Terminated early</p>
            )}
          </div>
        )}

        {/* 3 Buttons */}
        <div className="space-y-3 pt-2">

          {/* 1. Recording */}
          {report?.recordingUrl ? (
            <a
              href={report.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-all font-semibold"
            >
              <Play className="w-5 h-5" />
              View Recording
              <ExternalLink className="w-4 h-4 ml-auto opacity-60" />
            </a>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-border text-muted-foreground opacity-50">
              <Play className="w-5 h-5" /> Recording Not Available
            </div>
          )}

          {/* 2. Quiz Report */}
          <button
            onClick={handleViewReport}
            disabled={loadingReport}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-accent/30 bg-accent/5 text-accent hover:bg-accent/10 transition-all font-semibold"
          >
            {loadingReport
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <FileText className="w-5 h-5" />}
            View Quiz Report
          </button>

          {/* 3. Add to Team */}
          <button
            onClick={handleAddToTeam}
            disabled={addingToTeam || addedToTeam}
            className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all font-semibold ${
              addedToTeam
                ? 'border-green-500/30 bg-green-500/10 text-green-600 cursor-not-allowed'
                : 'border-green-500/40 bg-green-500/5 text-green-600 hover:bg-green-500/10'
            }`}
          >
            {addingToTeam
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : addedToTeam
              ? <CheckCircle className="w-5 h-5" />
              : <UserPlus className="w-5 h-5" />}
            {addedToTeam
              ? `✓ Added to ${request.teamName}`
              : `Add to ${request.teamName}`}
          </button>
        </div>

        <button onClick={onEnd} className="btn-secondary w-full">Close</button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// CANDIDATE VIEW — shown to the person who received the request
// ─────────────────────────────────────────────────────────────
const CandidateView = ({ request, onEnd }: { request: InterviewRequest; onEnd: () => void }) => {
  const { user } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  type CandidatePhase = 'start' | 'loading_questions' | 'active' | 'submitting' | 'done';
  const [phase, setPhase] = useState<CandidatePhase>('start');
  const phaseRef = useRef<CandidatePhase>('start');
  const setPhaseSync = (p: CandidatePhase) => { phaseRef.current = p; setPhase(p); };

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const questionsRef = useRef<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answersRef = useRef<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [warnings, setWarnings] = useState<ProctoringWarning[]>([]);
  const warningsRef = useRef<ProctoringWarning[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submitCalledRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  const { startRecording, stopRecording, isRecording } = useMediaRecorder();

  // Proctoring
  const handleWarning = useCallback((w: ProctoringWarning) => {
    warningsRef.current = [...warningsRef.current, w];
    setWarnings(prev => [...prev, w]);
    toast.warning(`⚠️ Warning ${warningsRef.current.length}/3: ${w.message}`);
  }, []);

  const handleTerminate = useCallback((reason: string) => {
    toast.error(`🚨 Terminated: ${reason}`);
    doSubmit(true, reason);
  }, []);

  const { warningCount, maxWarnings, enterFullscreen, exitFullscreen } = useProctoring({
    videoRef: localVideoRef,
    onWarning: handleWarning,
    onTerminate: handleTerminate,
    enabled: phase === 'active',
  });

  // Advanced face + gaze + phone detection — candidates only
  const faceProctoring = useFaceProctoring({
    videoRef: localVideoRef,
    enabled: phase === 'active',
    isCandidate: true, // quiz is always candidate-side
    maxWarnings: 3,
    onWarning: (w) => handleWarning({
      type: w.type as any,
      message: w.message,
      timestamp: { seconds: Math.floor(w.timestamp / 1000) } as any,
    }),
    onTerminate: handleTerminate,
  });

  // Attach video stream when active
  useEffect(() => {
    if (phase === 'active' && localVideoRef.current && streamRef.current) {
      localVideoRef.current.srcObject = streamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
  }, [phase]);

  // Camera track monitor
  useEffect(() => {
    if (phase !== 'active') return;
    const interval = setInterval(() => {
      const s = streamRef.current;
      if (!s) return;
      if (s.getVideoTracks().every(t => t.readyState === 'ended')) setCamOn(false);
      if (s.getAudioTracks().every(t => t.readyState === 'ended')) setMicOn(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [phase]);

  const handleStart = async () => {
    // 1. Get camera + mic
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setCamOn(true);
      setMicOn(true);
    } catch {
      toast.error('Camera and microphone access is required to take this interview.');
      return;
    }

    // 2. Load questions — generate if not yet created
    setPhaseSync('loading_questions');
    let qs: QuizQuestion[] = [];
    try {
      qs = await getQuizQuestions(request.id);
      if (qs.length === 0) {
        toast.info('Generating quiz questions...');
        const config = request.quizConfig!;
        const generated = await generateQuizQuestions({
          topics: config.topics,
          difficulty: config.difficulty,
          numQuestions: config.numQuestions,
        });
        await storeQuizQuestions(
          request.id,
          generated.map((q, i) => ({ ...q, order: i }))
        );
        qs = await getQuizQuestions(request.id);
        toast.success(`${qs.length} questions ready!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load questions');
      setPhaseSync('start');
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    setQuestions(qs);
    questionsRef.current = qs;

    // 3. Start recording
    startRecording(stream);

    // 4. Attach video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }

    // 5. Enter fullscreen
    await enterFullscreen();

    // 6. Start — use local variable for timer to avoid stale state
    setPhaseSync('active');
    const totalSeconds = request.quizConfig!.timeLimitMinutes * 60;
    setTimeLeft(totalSeconds);
    let remaining = totalSeconds;

    timerRef.current = setInterval(() => {
      remaining -= 1;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        doSubmit(false);
      }
    }, 1000);
  };

  const doSubmit = useCallback(async (terminated = false, terminationReason?: string) => {
    if (submitCalledRef.current) return;
    if (phaseRef.current === 'submitting' || phaseRef.current === 'done') return;
    submitCalledRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    setPhaseSync('submitting');
    exitFullscreen();
    streamRef.current?.getTracks().forEach(t => t.stop());

    let recordingUrl: string | undefined;
    let recordingPath: string | undefined;

    try {
      const blob = await stopRecording();
      if (blob && blob.size > 100) {
        toast.info('Uploading recording...');
        const result = await uploadRecording(request.id, blob);
        recordingUrl = result.url;
        recordingPath = result.path;
      }
    } catch (err) {
      console.error('Recording upload failed:', err);
    }

    try {
      const currentAnswers = answersRef.current;
      const currentQuestions = questionsRef.current;

      // Save each answer
      await Promise.all(
        Object.entries(currentAnswers).map(([questionId, selectedOption]) =>
          submitQuizAnswer({
            interviewId: request.id,
            candidateId: user!.uid,
            questionId,
            selectedOption,
          })
        )
      );

      // Score
      let correct = 0;
      currentQuestions.forEach(q => {
        if (currentAnswers[q.id] === q.correct_answer) correct++;
      });
      const score = currentQuestions.length > 0
        ? Math.round((correct / currentQuestions.length) * 100)
        : 0;

      // Build report — no undefined fields
      const reportData: Record<string, any> = {
        interviewId: request.id,
        teamId: request.teamId,
        leaderId: request.leaderId,
        candidateId: request.candidateId,
        candidateName: request.candidateName,
        type: 'quiz',
        completedAt: serverTimestamp(),
        score,
        totalQuestions: currentQuestions.length,
        correctAnswers: correct,
        warnings: warningsRef.current,
        terminated,
      };
      if (terminationReason) reportData.terminationReason = terminationReason;
      if (recordingUrl) reportData.recordingUrl = recordingUrl;
      if (recordingPath) reportData.recordingPath = recordingPath;

      await createInterviewReport(reportData as any);
      await updateInterviewStatus(request.id, terminated ? 'terminated' : 'completed');

      setPhaseSync('done');
      toast.success(`Quiz submitted! Your score: ${score}%`);
      setTimeout(onEnd, 3000);
    } catch (err: any) {
      console.error('Submit failed:', err);
      toast.error(err.message || 'Failed to submit');
      submitCalledRef.current = false;
      setPhaseSync('active');
    }
  }, [stopRecording, user, request, onEnd, exitFullscreen]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const currentQuestion = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;

  // ── START SCREEN ──────────────────────────────────────────
  if (phase === 'start') {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50 p-4">
        <div className="card-base p-8 max-w-md w-full text-center space-y-6">
          <div className="p-4 rounded-full bg-primary/10 w-16 h-16 mx-auto flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl text-foreground">Quiz Interview</h2>
            <p className="text-muted-foreground mt-2">From {request.leaderName} · {request.teamName}</p>
          </div>
          <div className="p-4 rounded-xl bg-secondary/50 border border-border text-left text-sm space-y-2">
            <div className="flex justify-between text-muted-foreground">
              <span>Questions</span>
              <span className="font-semibold text-foreground">{request.quizConfig?.numQuestions}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Time limit</span>
              <span className="font-semibold text-foreground">{request.quizConfig?.timeLimitMinutes} minutes</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Difficulty</span>
              <span className="font-semibold text-foreground capitalize">{request.quizConfig?.difficulty}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Topics</span>
              <span className="font-semibold text-foreground">{request.quizConfig?.topics?.join(', ')}</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-left text-xs space-y-1 text-yellow-700">
            <p className="font-semibold text-yellow-600 mb-1">⚠️ Before you start:</p>
            <p>• Camera &amp; microphone will be turned on</p>
            <p>• Session will be recorded and uploaded</p>
            <p>• Do not switch tabs — proctoring is active</p>
            <p>• Stay fullscreen — exiting counts as a violation</p>
            <p>• 3 violations = automatic termination</p>
          </div>
          <button
            onClick={handleStart}
            className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-lg"
          >
            <Shield className="w-5 h-5" />
            Start Quiz
          </button>
          <button onClick={onEnd} className="btn-secondary w-full">Cancel</button>
        </div>
      </div>
    );
  }

  // ── LOADING QUESTIONS ─────────────────────────────────────
  if (phase === 'loading_questions') {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-xl font-semibold text-foreground">Loading questions...</p>
        </div>
      </div>
    );
  }

  // ── SUBMITTING ────────────────────────────────────────────
  if (phase === 'submitting') {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-xl font-semibold text-foreground">Submitting quiz...</p>
          <p className="text-muted-foreground">Uploading recording, please wait</p>
        </div>
      </div>
    );
  }

  // ── DONE ──────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Quiz Submitted!</h2>
          <p className="text-muted-foreground">Results have been sent to {request.leaderName}</p>
        </div>
      </div>
    );
  }

  // ── ACTIVE QUIZ ───────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-card border-b border-border shadow-sm flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">{request.teamName}</span>
          {isRecording && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />REC
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${camOn ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
            {camOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
            {camOn ? 'Cam ON' : 'Cam OFF'}
          </span>
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${micOn ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
            {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
            {micOn ? 'Mic ON' : 'Mic OFF'}
          </span>
        </div>
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono font-bold text-sm ${timeLeft < 60 ? 'bg-red-500/20 text-red-600' : 'bg-primary/10 text-primary'}`}>
          <Clock className="w-4 h-4" />{formatTime(timeLeft)}
        </div>
        {warnings.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-600 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />{warningCount}/{maxWarnings}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: questions.length > 0 ? `${((currentIdx + 1) / questions.length) * 100}%` : '0%' }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full pb-44">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Question {currentIdx + 1} of {questions.length}</span>
          <span className="text-sm text-muted-foreground">{answeredCount}/{questions.length} answered</span>
        </div>

        <div className="card-base p-6 mb-6">
          <p className="text-lg font-semibold text-foreground leading-relaxed">{currentQuestion?.question}</p>
        </div>

        <div className="space-y-3">
          {currentQuestion?.options.map((option, i) => {
            const selected = answers[currentQuestion.id] === option;
            return (
              <button
                key={i}
                onClick={() => setAnswers(prev => ({ ...prev, [currentQuestion.id]: option }))}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  selected
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 ${
                  selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}>
                  {String.fromCharCode(65 + i)}
                </span>
                {option}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="btn-secondary disabled:opacity-40"
          >Previous</button>

          {currentIdx < questions.length - 1 ? (
            <button onClick={() => setCurrentIdx(i => i + 1)} className="btn-primary flex items-center gap-2">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => doSubmit(false)}
              className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-500"
            >
              <CheckCircle className="w-4 h-4" />
              Submit Quiz ({answeredCount}/{questions.length})
            </button>
          )}
        </div>
      </div>

      {/* Camera preview */}
      <div className="fixed bottom-6 right-6 z-[60]">
        <div className="relative w-44 h-32 rounded-xl overflow-hidden border-2 border-primary shadow-2xl bg-gray-900">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{ transform: 'scaleX(-1)' }}
            className="w-full h-full object-cover"
          />
          {!camOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
              <VideoOff className="w-6 h-6 text-red-400" />
              <span className="text-red-400 text-xs mt-1">Camera Off</span>
            </div>
          )}
          <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between">
            <span className="text-white text-xs bg-black/70 px-1.5 py-0.5 rounded">You</span>
            {isRecording && (
              <span className="flex items-center gap-1 text-red-400 text-xs bg-black/70 px-1.5 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />REC
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ROUTER — decides which view to show
// ─────────────────────────────────────────────────────────────
const QuizInterview = ({ request, onEnd }: Props) => {
  const { user } = useAuth();

  if (!user) return null;

  // Interviewer = person who SENT the request (leaderId)
  if (user.uid === request.leaderId) {
    return <InterviewerView request={request} onEnd={onEnd} />;
  }

  // Candidate = person who RECEIVED the request (candidateId)
  if (user.uid === request.candidateId) {
    return <CandidateView request={request} onEnd={onEnd} />;
  }

  // Unauthorized
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50 p-4">
      <div className="card-base p-8 max-w-sm w-full text-center space-y-4">
        <p className="text-lg font-semibold text-foreground">Not Authorized</p>
        <p className="text-muted-foreground">You are not part of this interview.</p>
        <button onClick={onEnd} className="btn-primary w-full">Go Back</button>
      </div>
    </div>
  );
};

export default QuizInterview;