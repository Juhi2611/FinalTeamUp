import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Rocket, Clock, Eye, FileSliders, ChevronRight, Maximize2, AlertCircle
} from 'lucide-react';
import type { Team } from '@/types/firestore.types';
import PresentationViewerModal from './PresentationViewerModal';

interface PresentationDeckCardProps {
  team: Team;
  isLeader?: boolean;
  onManage?: () => void;
}

// How old (in days) is "recently updated"?
const RECENTLY_UPDATED_DAYS = 7;

function isRecentlyUpdated(updatedAt: any): boolean {
  if (!updatedAt) return false;
  try {
    const date = typeof updatedAt.toDate === 'function' ? updatedAt.toDate() : new Date(updatedAt);
    const diff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= RECENTLY_UPDATED_DAYS;
  } catch { return false; }
}

function formatRelativeTime(ts: any): string {
  if (!ts) return 'Unknown';
  try {
    const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

// ─── PDF Thumbnail via pdf.js CDN ──────────────────────────────────────────────

function PDFThumbnail({ fileUrl }: { fileUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function renderFirstPage() {
      try {
        // Dynamically load pdfjs from CDN
        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) {
          // Load pdf.js script dynamically
          await new Promise<void>((resolve, reject) => {
            if (document.getElementById('pdfjs-script')) { resolve(); return; }
            const s = document.createElement('script');
            s.id = 'pdfjs-script';
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('pdf.js load failed'));
            document.head.appendChild(s);
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        } else {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        const lib = (window as any).pdfjsLib;
        const loadingTask = lib.getDocument({ url: fileUrl, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setLoaded(true);
      } catch (e) {
        if (!cancelled) setError(true);
      }
    }
    renderFirstPage();
    return () => { cancelled = true; };
  }, [fileUrl]);

  if (error) return <PPTFallbackPreview />;
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-white rounded-xl">
      {!loaded && <SkeletonLoader />}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain rounded-xl transition-opacity duration-500"
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </div>
  );
}

// ─── PPT fallback thumbnail ─────────────────────────────────────────────────────

function PPTFallbackPreview() {
  return (
    <div
      className="w-full h-full rounded-xl flex flex-col items-center justify-center gap-3"
      style={{
        background: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 50%, #ecfeff 100%)',
      }}
    >
      {/* Slide lines decoration */}
      <div className="absolute inset-4 pointer-events-none opacity-20">
        {[0.2, 0.4, 0.6, 0.75, 0.88].map((opacity, i) => (
          <div
            key={i}
            className="h-2 rounded mb-2"
            style={{
              background: '#06b6d4',
              width: `${[80, 65, 55, 45, 35][i]}%`,
              opacity,
            }}
          />
        ))}
      </div>
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
        style={{ background: '#ffffff', border: '1px solid #a5f3fc' }}
      >
        <FileSliders className="w-7 h-7 text-cyan-500" />
      </div>
      <p className="text-cyan-700 text-xs font-semibold">PowerPoint Presentation</p>
    </div>
  );
}

// ─── Skeleton loader ────────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="absolute inset-0 flex flex-col gap-2.5 p-4"
      style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}
    >
      <div className="h-5 rounded bg-slate-200 animate-pulse w-3/4" />
      <div className="h-3 rounded bg-slate-100 animate-pulse w-full" />
      <div className="h-3 rounded bg-slate-100 animate-pulse w-5/6" />
      <div className="h-3 rounded bg-slate-100 animate-pulse w-4/6" />
      <div className="flex-1 rounded-lg bg-slate-100 animate-pulse mt-2" />
    </div>
  );
}

// ─── PresentationDeckCard ───────────────────────────────────────────────────────

const PresentationDeckCard = ({ team, isLeader, onManage }: PresentationDeckCardProps) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const presentation = team.presentation;
  const recentlyUpdated = presentation ? isRecentlyUpdated(presentation.updatedAt) : false;

  // ── No presentation state ──
  if (!presentation) {
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: '#ffffff',
          border: '1.5px dashed #cffafe',
        }}
      >
        <div className="p-6 flex flex-col items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: '#ecfeff' }}
          >
            <FileSliders className="w-6 h-6 text-cyan-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: '#475569' }}>
              No presentation uploaded yet
            </p>
            <p className="text-xs mt-1" style={{ color: '#64748b' }}>
              {isLeader
                ? 'Upload your project deck to showcase your idea'
                : 'The team leader hasn\'t uploaded a presentation yet'}
            </p>
          </div>
          {isLeader && onManage && (
            <button
              onClick={onManage}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                boxShadow: '0 4px 14px rgba(6,182,212,0.3)',
              }}
            >
              <FileSliders className="w-3.5 h-3.5" />
              Upload Presentation
            </button>
          )}
        </div>
      </div>
    );
  }

  const isPDF = presentation.fileType === 'pdf';
  const displayName = presentation.fileName.replace(/^\d+_/, '');
  const viewCount = presentation.viewCount ?? 0;

  return (
    <>
      <motion.div
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        className="relative rounded-2xl overflow-hidden cursor-pointer group"
        style={{
          background: '#ffffff',
          border: '1px solid rgba(6,182,212,0.15)',
          boxShadow: hovered
            ? '0 0 0 1px rgba(6,182,212,0.5), 0 20px 40px rgba(6,182,212,0.15), 0 8px 16px rgba(0,0,0,0.05)'
            : '0 4px 15px rgba(0,0,0,0.05)',
          transition: 'box-shadow 0.3s ease',
        }}
        onClick={() => setViewerOpen(true)}
        whileHover={{ scale: 1.015, y: -2 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        {/* Recently updated ribbon */}
        {recentlyUpdated && (
          <div
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
            }}
          >
            <span>⚡</span> Recently Updated
          </div>
        )}

        {/* Live Project Deck badge */}
        <div className="absolute top-3 left-3 z-10">
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #22d3ee',
              color: 'white',
              boxShadow: '0 2px 10px rgba(6,182,212,0.3)',
            }}
          >
            <Rocket className="w-3 h-3" />
            Live Project Deck 🚀
          </div>
        </div>

        {/* Thumbnail area */}
        <div
          className="relative overflow-hidden"
          style={{ height: 180, background: '#f8fafc' }}
        >
          {/* Glow overlay on hover */}
          <motion.div
            className="absolute inset-0 z-[5] pointer-events-none rounded-0"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.15) 0%, transparent 70%)',
            }}
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Thumbnail */}
          <div className="absolute inset-0 pt-10 px-4">
            <div className="relative w-full h-full shadow-[0_0_15px_rgba(0,0,0,0.05)] rounded-t-xl overflow-hidden border-t border-x border-slate-100 bg-white">
               {isPDF ? (
                 <PDFThumbnail fileUrl={presentation.fileUrl} />
               ) : (
                 <PPTFallbackPreview />
               )}
            </div>
          </div>

          {/* Hover overlay: "Click to view" */}
          <motion.div
            className="absolute inset-0 z-10 flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(2px)' }}
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Maximize2 className="w-5 h-5 text-cyan-600" />
            <span className="text-sm font-bold text-cyan-800">Open Presentation</span>
            <ChevronRight className="w-4 h-4 text-cyan-500" />
          </motion.div>
        </div>

        {/* Card bottom */}
        <div className="px-4 py-4 border-t border-cyan-50">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 truncate" title={displayName}>
                {displayName}
              </p>
              <p
                className="text-xs mt-0.5 uppercase tracking-wide font-semibold text-cyan-600"
              >
                {presentation.fileType}
              </p>
            </div>

            {/* View count + timestamp */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="flex items-center gap-1 text-[11px] font-bold" style={{ color: '#f97316' }}>
                🔥 {viewCount > 0 ? viewCount.toLocaleString() : 0} views
              </div>
              <div
                className="flex items-center gap-1 text-[10px] text-slate-500"
              >
                <Clock className="w-2.5 h-2.5" />
                {formatRelativeTime(presentation.updatedAt)}
              </div>
            </div>
          </div>

          {/* Divider + open button */}
          <div
            className="mt-3 pt-3 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(6,182,212,0.1)' }}
          >
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Eye className="w-3.5 h-3.5" />
              Click to view full presentation
            </div>
            <motion.div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: '#ecfeff', border: '1px solid #cffafe' }}
              animate={{ x: hovered ? 2 : 0 }}
            >
              <ChevronRight className="w-3.5 h-3.5 text-cyan-500" />
            </motion.div>
          </div>

          {/* Leader manage link */}
          {isLeader && onManage && (
            <button
              onClick={e => { e.stopPropagation(); onManage(); }}
              className="w-full mt-3 py-2 rounded-xl text-xs font-bold transition-all text-center hover:bg-slate-100"
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#475569',
              }}
            >
              ✏️ Manage Presentation
            </button>
          )}
        </div>
      </motion.div>

      {/* Viewer modal */}
      {viewerOpen && (
        <PresentationViewerModal team={team} onClose={() => setViewerOpen(false)} />
      )}
    </>
  );
};

export default PresentationDeckCard;
