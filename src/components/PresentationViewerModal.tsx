import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, Maximize2, Minimize2,
  Download, Play, Pause, FileSliders, AlertCircle
} from 'lucide-react';
import { incrementPresentationViewCount } from '@/services/firestore';
import type { Team } from '@/types/firestore.types';

interface PresentationViewerModalProps {
  team: Team;
  onClose: () => void;
}

const PresentationViewerModal = ({ team, onClose }: PresentationViewerModalProps) => {
  const presentation = team.presentation!;
  const isPDF = presentation.fileType === 'pdf';

  // Google Docs Viewer URL for PPT/PPTX (no API key needed)
  const viewerUrl = isPDF
    ? presentation.fileUrl
    : `https://docs.google.com/gview?url=${encodeURIComponent(presentation.fileUrl)}&embedded=true`;

  const [page, setPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pitchMode, setPitchMode] = useState(false);
  const [pitchProgress, setPitchProgress] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const pitchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pitchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const PITCH_INTERVAL = 8; // seconds per slide

  // Increment view count on open
  useEffect(() => {
    incrementPresentationViewCount(team.id);
  }, [team.id]);

  // Quick Pitch Mode: auto-advance pages
  useEffect(() => {
    if (!pitchMode) {
      if (pitchRef.current) clearInterval(pitchRef.current);
      if (pitchTimerRef.current) clearInterval(pitchTimerRef.current);
      setPitchProgress(0);
      return;
    }
    setPitchProgress(0);
    let elapsed = 0;
    pitchTimerRef.current = setInterval(() => {
      elapsed += 0.1;
      setPitchProgress((elapsed / PITCH_INTERVAL) * 100);
      if (elapsed >= PITCH_INTERVAL) {
        elapsed = 0;
        setPitchProgress(0);
        setPage(prev => prev + 1);
      }
    }, 100);
    return () => {
      if (pitchTimerRef.current) clearInterval(pitchTimerRef.current);
    };
  }, [pitchMode]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setPage(p => p + 1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setPage(p => Math.max(p - 1, 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Build the iframe src with page param for PDF
  const iframeSrc = isPDF
    ? `${presentation.fileUrl}#page=${page}&view=FitH`
    : viewerUrl;

  const displayName = presentation.fileName.replace(/^\d+_/, '');
  const updatedDate = presentation.updatedAt && typeof (presentation.updatedAt as any).toDate === 'function'
    ? (presentation.updatedAt as any).toDate()
    : new Date();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex flex-col"
        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}
      >
        {/* Top bar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 z-10"
          style={{ borderBottom: '1px solid rgba(6,182,212,0.15)', background: 'rgba(255,255,255,0.6)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}
            >
              <FileSliders className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate max-w-[160px] sm:max-w-xs">
                {displayName}
              </p>
              <p className="text-[10px] font-medium text-slate-500">
                {team.name} · {presentation.fileType.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Quick Pitch */}
            <button
              onClick={() => setPitchMode(v => !v)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                background: pitchMode
                  ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                  : '#f1f5f9',
                color: pitchMode ? 'white' : '#475569',
                border: '1px solid #e2e8f0',
              }}
              title="Quick Pitch Mode — auto-advances slides every 8s"
            >
              {pitchMode ? <Pause className="w-4 h-4 cursor-pointer" /> : <Play className="w-4 h-4" />}
              <span>Pitch Mode</span>
            </button>

            {/* Download */}
            {presentation.downloadEnabled && (
              <a
                href={presentation.fileUrl}
                download={displayName}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:bg-slate-200"
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                }}
                onClick={e => e.stopPropagation()}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}

            {/* Fullscreen */}
            <button
              onClick={() => setIsFullscreen(v => !v)}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-slate-200"
              style={{ background: '#f1f5f9', color: '#475569' }}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-slate-200"
              style={{ background: '#f1f5f9', color: '#475569' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Viewer area */}
        <div
          className="flex-1 relative flex items-center justify-center overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Left arrow */}
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: page > 1 ? 1 : 0.15, x: 0 }}
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            disabled={page <= 1}
            className="absolute left-3 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md hover:bg-cyan-50"
            style={{ background: '#ffffff', border: '1px solid #cffafe' }}
          >
            <ChevronLeft className="w-5 h-5 text-cyan-500" />
          </motion.button>

          {/* iframe */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="relative w-full h-full"
            style={{
              maxWidth: isFullscreen ? '100%' : 'min(92vw, 1100px)',
              maxHeight: isFullscreen ? '100%' : 'calc(100vh - 120px)',
            }}
          >
            {!iframeLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse"
                  style={{ background: '#cffafe' }}
                >
                  <FileSliders className="w-8 h-8 text-cyan-500" />
                </div>
                <p className="text-sm font-bold text-slate-500">
                  Loading presentation…
                </p>
              </div>
            )}
            <iframe
              key={page}
              ref={iframeRef}
              src={iframeSrc}
              className="w-full h-full rounded-2xl"
              style={{
                border: '1px solid #e2e8f0',
                minHeight: '70vh',
                opacity: iframeLoaded ? 1 : 0,
                transition: 'opacity 0.3s',
                background: '#fff',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
              }}
              onLoad={() => setIframeLoaded(true)}
              title={`Presentation: ${displayName}`}
            />
          </motion.div>

          {/* Right arrow */}
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setPage(p => p + 1)}
            className="absolute right-3 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md hover:bg-cyan-50"
            style={{ background: '#ffffff', border: '1px solid #cffafe' }}
          >
            <ChevronRight className="w-5 h-5 text-cyan-500" />
          </motion.button>
        </div>

        {/* Bottom bar — page indicator + view count */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-shrink-0 flex items-center justify-between px-6 py-3"
          style={{ borderTop: '1px solid rgba(6,182,212,0.15)', background: 'rgba(255,255,255,0.6)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            {isPDF ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all hover:bg-slate-200"
                  style={{ background: '#f1f5f9' }}
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <span className="text-xs font-bold text-slate-700 tabular-nums min-w-[60px] text-center">
                  Page {page}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-slate-200"
                  style={{ background: '#f1f5f9' }}
                >
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            ) : (
              <span className="text-xs font-medium text-slate-400">
                Use Google Docs viewer controls to navigate slides
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500">
              🔥 {(presentation.viewCount ?? 0).toLocaleString()} views
            </span>
            <span className="text-xs font-medium text-slate-400">
              Updated {updatedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
            <span className="text-xs font-bold text-slate-700">
              Page {page}
            </span>
            {pitchMode && (
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1.5"
                style={{
                  background: 'rgba(245,158,11,0.15)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245,158,11,0.3)',
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Pitch Mode ON
              </span>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PresentationViewerModal;
