// =============================================================
// hooks/useProctoring.ts
// Proctoring logic: tab switch, fullscreen, camera, face detection
// Max 3 warnings → triggers onTerminate()
// =============================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { ProctoringWarning } from '@/services/firestore_interviews';

const MAX_WARNINGS = 3;

export interface ProctoringOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  onWarning: (warning: ProctoringWarning) => void;
  onTerminate: (reason: string) => void;
  enabled?: boolean;
}

export const useProctoring = ({
  videoRef,
  onWarning,
  onTerminate,
  enabled = true,
}: ProctoringOptions) => {
  const warningCountRef = useRef(0);
  const terminatedRef = useRef(false);
  const faceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [warnings, setWarnings] = useState<ProctoringWarning[]>([]);

  const addWarning = useCallback(
    (type: ProctoringWarning['type'], message: string) => {
      if (terminatedRef.current) return;

      warningCountRef.current += 1;
      const warning: ProctoringWarning = {
        type,
        message,
        timestamp: serverTimestamp() as any,
      };

      setWarnings((prev) => [...prev, warning]);
      onWarning(warning);

      if (warningCountRef.current >= MAX_WARNINGS) {
        terminatedRef.current = true;
        onTerminate(`Terminated after ${MAX_WARNINGS} proctoring violations. Last: ${message}`);
      }
    },
    [onWarning, onTerminate]
  );

  // ── 1. Tab Switch Detection ──────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    // Grace period: ignore first visibility change (camera permission dialog)
    let graceOver = false;
    const graceTimer = setTimeout(() => { graceOver = true; }, 3000);

    const handleVisibilityChange = () => {
      if (!graceOver) return; // ignore during grace period
      if (document.hidden) {
        addWarning('tab_switch', 'Tab switch or window minimization detected');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearTimeout(graceTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, addWarning]);

  // ── 2. Fullscreen Exit Detection ─────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        addWarning('fullscreen_exit', 'Exited fullscreen mode');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [enabled, addWarning]);

  // ── 3. Camera OFF Detection ──────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const checkCamera = () => {
      const video = videoRef.current;
      if (!video) return;

      const stream = video.srcObject as MediaStream | null;
      if (!stream) return;

      const videoTracks = stream.getVideoTracks();
      const allDisabled = videoTracks.length === 0 || videoTracks.every((t) => !t.enabled || t.muted);

      if (allDisabled) {
        addWarning('camera_off', 'Camera was turned off or disabled');
      }
    };

    const interval = setInterval(checkCamera, 5000);
    return () => clearInterval(interval);
  }, [enabled, addWarning, videoRef]);

  // ── 4. Face Detection (canvas-based pixel analysis fallback) ──
  // Uses a lightweight approach: checks if video has substantial pixel variance
  // For production, replace with face-api.js or MediaPipe
  useEffect(() => {
    if (!enabled) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const detectFace = () => {
      const video = videoRef.current;
      if (!video || !ctx || video.readyState < 2) return;

      canvas.width = 64;
      canvas.height = 64;
      ctx.drawImage(video, 0, 0, 64, 64);

      const imageData = ctx.getImageData(0, 0, 64, 64);
      const pixels = imageData.data;

      // Calculate pixel variance as a proxy for "is someone there"
      let sum = 0;
      let sumSq = 0;
      const count = pixels.length / 4;

      for (let i = 0; i < pixels.length; i += 4) {
        const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        sum += brightness;
        sumSq += brightness * brightness;
      }

      const mean = sum / count;
      const variance = sumSq / count - mean * mean;

      // Very low variance = blank/black frame = no face / camera covered
      if (variance < 50) {
        addWarning('no_face', 'No face detected in camera frame');
      }
    };

    faceCheckIntervalRef.current = setInterval(detectFace, 8000);
    return () => {
      if (faceCheckIntervalRef.current) clearInterval(faceCheckIntervalRef.current);
    };
  }, [enabled, addWarning, videoRef]);

  // ── Enter fullscreen on mount ────────────────────────────
  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen may be blocked; warn if not in fullscreen
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  return {
    warnings,
    warningCount: warningCountRef.current,
    maxWarnings: MAX_WARNINGS,
    enterFullscreen,
    exitFullscreen,
  };
};