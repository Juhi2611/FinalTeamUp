import { useEffect, useRef, useCallback, useState } from 'react';

export interface FaceProctoringWarning {
  type: 'no_face' | 'looking_away' | 'phone_detected' | 'multiple_faces';
  message: string;
  timestamp: number;
}

interface Options {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  isCandidate?: boolean; // only candidates get eye/phone checks
  maxWarnings?: number;
  onWarning: (w: FaceProctoringWarning) => void;
  onTerminate: (reason: string) => void;
}

const beep = (freq = 880, ms = 500) => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = 'sine';
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
    osc.start(); osc.stop(ctx.currentTime + ms / 1000);
  } catch {}
};

const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed: ${src}`));
    document.head.appendChild(s);
  });

export const useFaceProctoring = ({
  videoRef, enabled, isCandidate = true, maxWarnings = 3, onWarning, onTerminate,
}: Options) => {
  const [warnings, setWarnings] = useState<FaceProctoringWarning[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('Loading...');

  const warningCountRef = useRef(0);
  const terminatedRef = useRef(false);
  const cooldownRef = useRef<Record<string, number>>({});
  const runningRef = useRef(false);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gazeTimerRef = useRef<number | null>(null);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Phone detection: require N consecutive detections to avoid false positives
  const phoneConsecutiveRef = useRef(0);

  const COOLDOWN = 10000;
  const GAZE_GRACE = 4000; // 4s looking away before warning

  const addWarning = useCallback((
    type: FaceProctoringWarning['type'],
    message: string,
    freq = 880,
  ) => {
    if (terminatedRef.current) return;
    const now = Date.now();
    if (now - (cooldownRef.current[type] || 0) < COOLDOWN) return;
    cooldownRef.current[type] = now;

    warningCountRef.current += 1;
    const w: FaceProctoringWarning = { type, message, timestamp: now };
    setWarnings(p => [...p, w]);
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    setCurrentAlert(message);
    alertTimerRef.current = setTimeout(() => setCurrentAlert(null), 4000);
    beep(freq, 600);
    onWarning(w);
    if (warningCountRef.current >= maxWarnings) {
      terminatedRef.current = true;
      onTerminate(`Interview terminated after ${maxWarnings} violations`);
    }
  }, [maxWarnings, onWarning, onTerminate]);

  useEffect(() => {
    if (!enabled) return;
    runningRef.current = true;

    const FACEAPI = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
    const MODELS  = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

    const init = async () => {
      try {
        setStatusMsg('Loading detector...');
        await loadScript(FACEAPI);
        const faceapi = (window as any).faceapi;
        if (!faceapi) throw new Error('faceapi unavailable');

        // Load tiny face detector always
        // Load landmarks only for candidates (needed for eye gaze)
        const models = [faceapi.nets.tinyFaceDetector.loadFromUri(MODELS)];
        if (isCandidate) {
          models.push(faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS));
        }
        await Promise.all(models);

        setIsLoaded(true);
        setStatusMsg(isCandidate ? 'AI monitoring active' : 'Face monitoring active');
        startDetection(faceapi);
      } catch (err) {
        console.warn('[Proctoring] Fallback mode:', err);
        setIsLoaded(true);
        setStatusMsg('Basic monitoring');
        startFallback();
      }
    };

    // ── Main detection loop ────────────────────────────────
    const startDetection = (faceapi: any) => {
      const detectorOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 160,
        scoreThreshold: 0.45,
      });

      const detect = async () => {
        if (!runningRef.current) return;
        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.paused || video.videoWidth === 0) {
          detectTimerRef.current = setTimeout(detect, 2000);
          return;
        }

        try {
          let detections: any[];

          if (isCandidate) {
            // Candidates: full detection with landmarks for eye gaze
            const results = await faceapi
              .detectAllFaces(video, detectorOptions)
              .withFaceLandmarks(true);
            detections = results;

            if (detections.length === 0) {
              handleNoFace();
            } else {
              gazeTimerRef.current = null;
              if (detections.length > 1) {
                addWarning('multiple_faces', '⚠️ Multiple faces detected', 660);
              } else {
                checkEyeGaze(detections[0], video);
              }
              // Phone detection every detection cycle for candidates
              checkPhone(video);
            }
          } else {
            // Leaders: only face presence check, no gaze/phone
            const results = await faceapi.detectAllFaces(video, detectorOptions);
            detections = results;
            if (detections.length === 0) handleNoFace();
            else gazeTimerRef.current = null;
          }
        } catch {}

        detectTimerRef.current = setTimeout(detect, 3000);
      };

      detect();
    };

    // ── No face handler ───────────────────────────────────
    const handleNoFace = () => {
      if (gazeTimerRef.current === null) {
        gazeTimerRef.current = Date.now();
      } else if (Date.now() - gazeTimerRef.current >= GAZE_GRACE) {
        addWarning('no_face', '⚠️ Face not visible — please stay in frame', 880);
        gazeTimerRef.current = null;
      }
    };

    // ── Eye gaze using 68-point landmarks ─────────────────
    // Points: left eye 36-41, right eye 42-47, nose tip 30
    // jaw left 0, jaw right 16
    const checkEyeGaze = (detection: any, video: HTMLVideoElement) => {
      try {
        const pts = detection.landmarks.positions;
        if (!pts || pts.length < 68) return;

        const vw = video.videoWidth || 640;

        // ── Head turn via nose deviation ──────────────────
        const noseTip   = pts[30];
        const jawLeft   = pts[0];
        const jawRight  = pts[16];
        const faceWidth = jawRight.x - jawLeft.x;
        if (faceWidth <= 0) return;
        const faceCenterX = (jawLeft.x + jawRight.x) / 2;
        const noseOffset  = (noseTip.x - faceCenterX) / faceWidth;
        // > 0.35 = head significantly turned sideways
        const headTurned = Math.abs(noseOffset) > 0.35;

        // ── Eye gaze via iris position in eye socket ──────
        // Left eye: 36 (outer corner), 39 (inner corner)
        // Right eye: 42 (inner corner), 45 (outer corner)
        const leftEyeLeft   = pts[36];
        const leftEyeRight  = pts[39];
        const rightEyeLeft  = pts[42];
        const rightEyeRight = pts[45];

        // Eye centers
        const leftEyeCx  = (leftEyeLeft.x  + leftEyeRight.x)  / 2;
        const rightEyeCx = (rightEyeLeft.x + rightEyeRight.x) / 2;
        const eyesMidX   = (leftEyeCx + rightEyeCx) / 2;

        // How far are the eyes from the face center (normalized to face width)
        const eyeOffset = Math.abs(eyesMidX - faceCenterX) / faceWidth;
        // > 0.25 = eyes clearly off center (looking sideways)
        const eyesOffCenter = eyeOffset > 0.25;

        // ── Frame edge check ──────────────────────────────
        // Eyes very close to left/right frame edge = looking off screen
        const eyesNearEdge = leftEyeCx < vw * 0.05 || rightEyeCx > vw * 0.95;

        const lookingAway = headTurned || eyesOffCenter || eyesNearEdge;

        if (lookingAway) {
          if (gazeTimerRef.current === null) {
            gazeTimerRef.current = Date.now();
          } else if (Date.now() - gazeTimerRef.current >= GAZE_GRACE) {
            addWarning('looking_away', '👁️ Please keep your eyes on the screen', 750);
            gazeTimerRef.current = null;
          }
        } else {
          gazeTimerRef.current = null; // reset — looking at screen
        }
      } catch {}
    };

    // ── Phone detection via canvas analysis ───────────────
    // Looks for rectangular bright/reflective region = phone screen
    // OR dark uniform rectangle = phone back
    // Requires 3 consecutive detections to avoid false positives
    const phoneCanvas = document.createElement('canvas');
    phoneCanvas.width = 160;
    phoneCanvas.height = 120;
    const phoneCtx = phoneCanvas.getContext('2d');

    const checkPhone = (video: HTMLVideoElement) => {
      if (!phoneCtx) return;
      try {
        phoneCtx.drawImage(video, 0, 0, 160, 120);
        const data = phoneCtx.getImageData(0, 0, 160, 120).data;

        let brightPixels = 0;    // phone front (screen glow)
        let darkPixels   = 0;    // phone back (dark glass/metal)
        let edgePixels   = 0;    // sharp edges = rectangular object
        const W = 160, H = 120;
        const total = W * H;

        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const r = data[i], g = data[i+1], b = data[i+2];
            const brightness = (r + g + b) / 3;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max > 0 ? (max - min) / max : 0;

            // Phone screen: very bright + low saturation (white/blue light)
            if (brightness > 210 && saturation < 0.2) brightPixels++;

            // Phone back: dark + uniform color (dark glass)
            if (brightness < 45 && saturation < 0.25) darkPixels++;

            // Edge detection
            if (x > 0 && y > 0) {
              const pi = ((y-1) * W + x) * 4;
              const li = (y * W + (x-1)) * 4;
              const pb = (data[pi] + data[pi+1] + data[pi+2]) / 3;
              const lb = (data[li] + data[li+1] + data[li+2]) / 3;
              if (Math.abs(brightness - pb) > 55 || Math.abs(brightness - lb) > 55) {
                edgePixels++;
              }
            }
          }
        }

        const brightRatio = brightPixels / total;
        const darkRatio   = darkPixels / total;
        const edgeRatio   = edgePixels / total;

        // Phone detected if:
        // Front: large bright region (>20% of frame)
        // Back: dark uniform area + sharp edges (rectangular shape)
        const phoneDetected =
          brightRatio > 0.20 ||
          (darkRatio > 0.15 && edgeRatio > 0.07);

        if (phoneDetected) {
          phoneConsecutiveRef.current++;
          if (phoneConsecutiveRef.current >= 3) {
            phoneConsecutiveRef.current = 0;
            addWarning(
              'phone_detected',
              '📱 Phone detected in frame — please put it away',
              440,
            );
          }
        } else {
          phoneConsecutiveRef.current = Math.max(0, phoneConsecutiveRef.current - 1);
        }
      } catch {}
    };

    // ── Fallback: pixel variance only ─────────────────────
    const startFallback = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 48;
      const ctx = canvas.getContext('2d');
      let miss = 0;
      const check = () => {
        if (!runningRef.current) return;
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          detectTimerRef.current = setTimeout(check, 3000); return;
        }
        try {
          ctx?.drawImage(video, 0, 0, 64, 48);
          const d = ctx?.getImageData(0, 0, 64, 48).data;
          if (d) {
            let s = 0, sq = 0;
            const n = d.length / 4;
            for (let i = 0; i < d.length; i += 4) {
              const b = (d[i]+d[i+1]+d[i+2])/3;
              s += b; sq += b*b;
            }
            const v = sq/n - (s/n)**2;
            if (v < 60) { if (++miss >= 3) { addWarning('no_face','⚠️ Face not visible',880); miss=0; } }
            else miss = 0;
          }
        } catch {}
        detectTimerRef.current = setTimeout(check, 4000);
      };
      check();
    };

    init();

    return () => {
      runningRef.current = false;
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    };
  }, [enabled, isCandidate, addWarning]);

  return { warnings, warningCount: warningCountRef.current, maxWarnings, isLoaded, currentAlert, statusMsg };
};