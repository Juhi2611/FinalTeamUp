// =============================================================
// components/interviews/VideoInterview.tsx
// WebRTC 1-to-1 video via Firebase Firestore signaling
// - Leader sees results screen after interview ends
// - Remote audio plays correctly (not muted)
// - Recording uploaded to Supabase from LEADER SIDE ONLY
// =============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  AlertTriangle, Shield, Upload, Loader2, Circle,
  Play, ExternalLink, CheckCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProctoring } from '@/hooks/useProctoring';
import { useFaceProctoring } from '@/hooks/useFaceProctoring';
import ProctoringAlert from '@/components/interviews/ProctoringAlert';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { uploadRecording } from '@/services/supabase_recordings';
import {
  createInterviewReport,
  updateInterviewStatus,
  getInterviewReport,
  InterviewRequest,
  InterviewReport,
  ProctoringWarning,
} from '@/services/firestore_interviews';
import { addTeamMember, getProfile } from '@/services/firestore';
import { chargeInterviewFee } from '@/services/perksService';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  doc, setDoc, onSnapshot, collection, addDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

interface Props {
  request: InterviewRequest;
  onEnd: () => void;
}

const LeaderResultsScreen = ({
  request, report, onEnd,
}: {
  request: InterviewRequest;
  report: InterviewReport | null;
  onEnd: () => void;
}) => {
  const [addingToTeam, setAddingToTeam] = useState(false);
  const [addedToTeam, setAddedToTeam] = useState(false);

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

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50 p-4">
      <div className="card-base p-8 max-w-md w-full text-center space-y-6">
        <div className="p-4 rounded-full bg-primary/10 w-16 h-16 mx-auto flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="font-display font-bold text-2xl text-foreground">Interview Complete</h2>
          <p className="text-muted-foreground mt-1">{request.candidateName} · Video Interview</p>
        </div>
        <div className="space-y-3 pt-2">
          {report?.recordingUrl ? (
            <a href={report.recordingUrl} target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-all font-semibold">
              <Play className="w-5 h-5" />View Recording
              <ExternalLink className="w-4 h-4 ml-auto opacity-60" />
            </a>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-border text-muted-foreground opacity-50">
              <Play className="w-5 h-5" /> Recording Not Available
            </div>
          )}
          <div className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-border text-muted-foreground bg-secondary/30">
            <Shield className="w-5 h-5" />
            <span className="text-sm">
              Proctoring warnings: {report?.warnings?.length ?? 0}
              {report?.terminated && ' · Interview was terminated'}
            </span>
          </div>
          <button onClick={handleAddToTeam} disabled={addingToTeam || addedToTeam}
            className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all font-semibold ${
              addedToTeam
                ? 'border-green-500/30 bg-green-500/10 text-green-600 cursor-not-allowed'
                : 'border-green-500/40 bg-green-500/5 text-green-600 hover:bg-green-500/10'
            }`}>
            {addingToTeam ? <Loader2 className="w-5 h-5 animate-spin" />
              : addedToTeam ? <CheckCircle className="w-5 h-5" />
              : <Shield className="w-5 h-5" />}
            {addedToTeam ? `✓ Added to ${request.teamName}` : `Add to ${request.teamName}`}
          </button>
        </div>
        <button onClick={onEnd} className="btn-secondary w-full">Close</button>
      </div>
    </div>
  );
};

const useWebRTC = (interviewId: string) => {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [connected, setConnected] = useState(false);

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ]
    });

    pc.ontrack = (event) => {
      console.log('Remote track received:', event.track.kind, event.track.id);
      
      if (event.track.kind === 'video') {
        const video = remoteVideoRef.current;
        if (video && event.streams[0]) {
          video.srcObject = event.streams[0];
          video.play().catch(() => {});
        }
      }
      
      if (event.track.kind === 'audio') {
        const existingAudio = document.getElementById('remote-interview-audio');
        if (existingAudio) existingAudio.remove();
        
        const audioEl = document.createElement('audio');
        audioEl.id = 'remote-interview-audio';
        audioEl.autoplay = true;
        audioEl.muted = false;
        
        const audioStream = new MediaStream([event.track]);
        audioEl.srcObject = audioStream;
        document.body.appendChild(audioEl);
        
        audioEl.play().then(() => {
          console.log('Remote audio playing successfully');
        }).catch((e) => {
          console.warn('Audio autoplay blocked:', e.message);
          const unlock = () => {
            audioEl.play().catch(() => {});
            document.removeEventListener('click', unlock);
          };
          document.addEventListener('click', unlock);
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('WebRTC state:', pc.connectionState);
      setConnected(pc.connectionState === 'connected');
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnected(true);
      }
    };

    pcRef.current = pc;
    return pc;
  }, []);

  const startAsLeader = useCallback(async (localStream: MediaStream) => {
    const pc = createPC();
    const callDoc = doc(db, 'interview_calls', interviewId);
    const offerCandidates = collection(callDoc, 'offerCandidates');
    const answerCandidates = collection(callDoc, 'answerCandidates');

    localStream.getTracks().forEach(track => {
      console.log('Adding local track:', track.kind);
      pc.addTrack(track, localStream);
    });

    pc.onicecandidate = async (e) => {
      if (e.candidate) await addDoc(offerCandidates, e.candidate.toJSON());
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(callDoc, { offer: { sdp: offer.sdp, type: offer.type } });

    onSnapshot(callDoc, (snap) => {
      const data = snap.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(console.error);
      }
    });

    onSnapshot(answerCandidates, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(console.warn);
        }
      });
    });
  }, [interviewId, createPC]);

  const startAsCandidate = useCallback(async (localStream: MediaStream) => {
    const pc = createPC();
    const callDoc = doc(db, 'interview_calls', interviewId);
    const answerCandidates = collection(callDoc, 'answerCandidates');
    const offerCandidates = collection(callDoc, 'offerCandidates');

    localStream.getTracks().forEach(track => {
      console.log('Adding local track:', track.kind);
      pc.addTrack(track, localStream);
    });

    pc.onicecandidate = async (e) => {
      if (e.candidate) await addDoc(answerCandidates, e.candidate.toJSON());
    };

    onSnapshot(offerCandidates, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(console.warn);
        }
      });
    });

    const unsub = onSnapshot(callDoc, async (snap) => {
      const data = snap.data();
      if (data?.offer && !pc.currentRemoteDescription) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await setDoc(callDoc, { answer: { sdp: answer.sdp, type: answer.type } }, { merge: true });
          unsub();
        } catch (err) {
          console.error('Candidate answer error:', err);
        }
      }
    });
  }, [interviewId, createPC]);

  const hangup = useCallback(async () => {
    pcRef.current?.close();
    try { await deleteDoc(doc(db, 'interview_calls', interviewId)); } catch {}
  }, [interviewId]);

  return { startAsLeader, startAsCandidate, remoteVideoRef, connected, hangup };
};

const VideoInterview = ({ request, onEnd }: Props) => {
  const { user } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const isLeader = user?.uid === request.leaderId;

  const [phase, setPhase] = useState<'checking' | 'live' | 'uploading' | 'done' | 'results'>('checking');
  const [existingReport, setExistingReport] = useState<InterviewReport | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [warnings, setWarnings] = useState<ProctoringWarning[]>([]);
  const warningsRef = useRef<ProctoringWarning[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endCalledRef = useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { startRecording, stopRecording, isRecording } = useMediaRecorder();
  const { startAsLeader, startAsCandidate, remoteVideoRef, connected, hangup } = useWebRTC(request.id);

  const handleWarning = useCallback((w: ProctoringWarning) => {
    warningsRef.current = [...warningsRef.current, w];
    setWarnings(prev => [...prev, w]);
    toast.warning(`⚠️ Warning ${warningsRef.current.length}/3: ${w.message}`);
  }, []);

  const handleTerminate = useCallback(async (reason: string) => {
    toast.error(`🚨 Terminated: ${reason}`);
    endInterview(true, reason);
  }, []);

  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  useEffect(() => {
    // Wait until WebRTC is connected + 10s before loading face detection
    // Prevents model download from freezing the peer connection setup
    if (connected) {
      const t = setTimeout(() => setProctoringEnabled(true), 10000);
      return () => clearTimeout(t);
    }
  }, [connected]);

  const { warningCount, maxWarnings, enterFullscreen, exitFullscreen } = useProctoring({
    videoRef: localVideoRef,
    onWarning: handleWarning,
    onTerminate: handleTerminate,
    enabled: proctoringEnabled,
  });

  // Advanced face/gaze/phone detection — candidates only
  const faceProctoring = useFaceProctoring({
    videoRef: localVideoRef,
    enabled: proctoringEnabled,
    isCandidate: !isLeader, // leader only gets face presence check
    maxWarnings: 3,
    onWarning: (w) => handleWarning({
      type: w.type as any,
      message: w.message,
      timestamp: { seconds: Math.floor(w.timestamp / 1000) } as any,
    }),
    onTerminate: handleTerminate,
  });

  useEffect(() => {
    const check = async () => {
      if (isLeader && user?.uid) {
        const report = await getInterviewReport(request.id).catch(() => null);
        if (report && (report.status === 'completed' || report.terminated || report.recordingUrl)) {
          setExistingReport(report as any);
          setPhase('results');
          return;
        }
        
        const profile = await getProfile(user.uid);
        if ((profile?.perks ?? 0) < 5) {
          toast.error('Insufficient Perks! You need 5 Perks to start an interview.');
          onEnd();
          return;
        }

        setShowConfirm(true);
        return;
      }
      initCall();
    };
    check();
  }, [isLeader, user, request.id, onEnd]);

  const handleConfirmStart = () => {
    setShowConfirm(false);
    initCall();
  };

  const initCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;

      const attachLocal = () => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(() => {});
        } else {
          setTimeout(attachLocal, 100);
        }
      };
      attachLocal();

      // ── Charge interview fee (leader only, idempotent) ─────────────────
      if (isLeader && user?.uid) {
        try {
          const { charged, alreadyCharged } = await chargeInterviewFee(
            user.uid,
            request.candidateId,
            request.id
          );
          if (charged) {
            toast.info('💎 5 Perks deducted for this interview session.');
          } else if (alreadyCharged) {
            toast.info('ℹ️ Interview fee already charged — no additional deduction.');
          }
        } catch (feeErr) {
          console.warn('Interview fee charge failed:', feeErr);
        }
      }

      // Only leader records
      if (isLeader) startRecording(stream);

      await enterFullscreen();

      if (isLeader) {
        await startAsLeader(stream);
      } else {
        await startAsCandidate(stream);
      }

      setPhase('live');
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to access camera/microphone');
    }
  };

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicOn(prev => !prev);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOn(prev => !prev);
  };

  const endInterview = useCallback(async (terminated = false, terminationReason?: string) => {
    if (endCalledRef.current) return;
    endCalledRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('uploading');

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    exitFullscreen();
    await hangup();
    const audioEl = document.getElementById('remote-interview-audio');
    if (audioEl) audioEl.remove();

    let recordingUrl: string | undefined;
    let recordingPath: string | undefined;

    // ✅ ONLY leader uploads recording
    if (isLeader) {
      try {
        const blob = await stopRecording();
        if (blob && blob.size > 1000) {
          toast.info('Uploading recording...');
          const result = await uploadRecording(request.id, blob);
          recordingUrl = result.url;
          recordingPath = result.path;
        }
      } catch (err) {
        console.error('Recording upload failed:', err);
      }
    }

    try {
      const report: any = {
        interviewId: request.id,
        teamId: request.teamId,
        leaderId: request.leaderId,
        candidateId: request.candidateId,
        candidateName: request.candidateName,
        type: 'video',
        completedAt: serverTimestamp(),
        warnings: warningsRef.current,
        terminated,
      };
      if (terminationReason) report.terminationReason = terminationReason;
      if (recordingUrl) report.recordingUrl = recordingUrl;
      if (recordingPath) report.recordingPath = recordingPath;

      await createInterviewReport(report);
      await updateInterviewStatus(request.id, terminated ? 'terminated' : 'completed');

      if (isLeader) {
        setExistingReport(report);
        setPhase('results');
      } else {
        setPhase('done');
        toast.success('Interview ended!');
        setTimeout(onEnd, 1500);
      }
    } catch (err) {
      console.error('Report save failed:', err);
      setPhase('done');
      setTimeout(onEnd, 1500);
    }
  }, [phase, stopRecording, hangup, request, exitFullscreen, isLeader]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (phase === 'checking') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (phase === 'results') {
    return <LeaderResultsScreen request={request} report={existingReport} onEnd={onEnd} />;
  }

  if (phase === 'uploading') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white space-y-4">
          <Upload className="w-12 h-12 mx-auto animate-bounce text-primary" />
          <p className="text-xl font-semibold">Saving recording...</p>
          <p className="text-gray-400">Please wait, do not close this tab</p>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white space-y-4">
          <CheckCircle className="w-12 h-12 mx-auto text-green-400" />
          <p className="text-xl font-semibold text-green-400">Interview Complete</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Circle className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" />
          <span className="text-red-400 text-sm font-medium">LIVE</span>
          <span className="text-gray-400 text-sm font-mono">{formatTime(elapsedSeconds)}</span>
          {isRecording && isLeader && (
            <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">REC</span>
          )}
        </div>
        <div className="text-white text-sm font-medium">{request.teamName} · Video Interview</div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
            {connected ? '● Connected' : '○ Connecting...'}
          </span>
          <ProctoringAlert
            currentAlert={null}
            warningCount={faceProctoring.warningCount + warningCount}
            maxWarnings={3}
            warnings={faceProctoring.warnings}
            isLoaded={faceProctoring.isLoaded}
          />
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 p-3 bg-gray-950 relative">
        <div className="relative rounded-2xl overflow-hidden bg-gray-900 border border-gray-800">
          <video ref={remoteVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          {!connected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
              <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                <span className="text-3xl font-bold text-gray-500">
                  {(isLeader ? request.candidateName : (request.leaderName || 'L'))[0].toUpperCase()}
                </span>
              </div>
              <p className="text-gray-400 text-sm">{isLeader ? request.candidateName : request.leaderName}</p>
              <p className="text-gray-600 text-xs mt-1 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Waiting to connect...
              </p>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded-lg text-xs text-white">
            {isLeader ? request.candidateName : request.leaderName}
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-gray-900 border border-gray-800">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          {!camOn && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
              <VideoOff className="w-12 h-12 text-gray-600" />
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded-lg text-xs text-white">
            You {isLeader && isRecording && '· 🔴 REC'}
          </div>
        </div>

        <ProctoringAlert
          currentAlert={faceProctoring.currentAlert}
          warningCount={faceProctoring.warningCount + warningCount}
          maxWarnings={3}
          warnings={faceProctoring.warnings}
          isLoaded={faceProctoring.isLoaded}
        />
      </div>

      <div className="flex items-center justify-center gap-4 py-5 bg-gray-900 border-t border-gray-800">
        <button onClick={toggleMic}
          className={`p-4 rounded-full transition-all ${micOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 text-white'}`}>
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>
        <button onClick={toggleCam}
          className={`p-4 rounded-full transition-all ${camOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 text-white'}`}>
          {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>
        <button onClick={() => endInterview(false)}
          className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white transition-all">
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {showConfirm && (
        <ConfirmModal
          title="Start Interview"
          message="Starting this interview will deduct 5 Perks from your balance. Do you want to continue?"
          onConfirm={handleConfirmStart}
          onCancel={() => { setShowConfirm(false); onEnd(); }}
        />
      )}
    </div>
  );
};

export default VideoInterview;