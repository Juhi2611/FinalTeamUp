import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, FileText, Loader2, Trash2, Download, Check,
  Presentation, AlertTriangle, CloudUpload
} from 'lucide-react';
import { uploadTeamPresentation, deleteTeamPresentation } from '@/services/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Team } from '@/types/firestore.types';

interface PresentationUploadModalProps {
  team: Team;
  onClose: () => void;
  onSuccess: () => void;
}

const ACCEPTED = ['.pdf', '.ppt', '.pptx'];
const MAX_SIZE_MB = 250;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PresentationUploadModal = ({ team, onClose, onSuccess }: PresentationUploadModalProps) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadEnabled, setDownloadEnabled] = useState(
    team.presentation?.downloadEnabled ?? true
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const validateFile = (f: File): string | null => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) return `Unsupported format. Please upload ${ACCEPTED.join(', ')}`;
    if (f.size > MAX_SIZE_MB * 1024 * 1024) return `File too large (max ${MAX_SIZE_MB} MB)`;
    return null;
  };

  const handleFile = (f: File) => {
    const err = validateFile(f);
    if (err) { toast.error(err); return; }
    setFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, []);

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadTeamPresentation(team.id, user.uid, file, downloadEnabled, (pct) =>
        setUploadProgress(pct)
      );
      toast.success('Presentation uploaded successfully! 🚀');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  const handleDelete = async () => {
    if (!user || !team.presentation) return;
    setDeleting(true);
    try {
      await deleteTeamPresentation(team.id, user.uid);
      toast.success('Presentation deleted');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
    setDeleting(false);
  };

  const ext = file?.name.split('.').pop()?.toUpperCase() ?? '';
  const isImage = false; // we don't preview images

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(10px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 30 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          className="w-full max-w-md rounded-3xl overflow-hidden shadow-xl"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(6,182,212,0.15)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-6 pt-6 pb-4 border-b border-slate-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}
                >
                  <Presentation className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-lg leading-tight">Project Deck</h2>
                  <p className="text-xs font-medium text-slate-500">
                    {team.presentation ? 'Replace Presentation' : 'Upload Presentation'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors bg-slate-50"
              >
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Existing presentation notice */}
            {team.presentation && !file && (
              <div className="space-y-3">
                <div
                  className="rounded-2xl p-4 flex items-center gap-3 bg-cyan-50/50 border border-cyan-100 shadow-sm"
                >
                  <FileText className="w-5 h-5 flex-shrink-0 text-cyan-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {team.presentation.fileName.replace(/^\d+_/, '')}
                    </p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      {team.presentation.fileType.toUpperCase()} · Currently uploaded
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 px-2 text-slate-500">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">
                    To <strong className="text-slate-700">replace</strong> your deck, simply drop or upload a new file below. The previous file will be overwritten and instantly updated for everyone!
                  </p>
                </div>
              </div>
            )}

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className="relative rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 py-10"
              style={{
                border: `2px dashed ${dragOver ? '#06b6d4' : file ? '#67e8f9' : '#e2e8f0'}`,
                background: dragOver ? '#ecfeff' : file ? '#f8fafc' : '#ffffff',
              }}
            >
              {file ? (
                <>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md shadow-cyan-100"
                    style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}
                  >
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-800">{file.name}</p>
                    <p className="text-xs mt-0.5 font-medium text-slate-500">
                      {ext} · {formatBytes(file.size)}
                    </p>
                  </div>
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-100"
                  >
                    Click to change file
                  </span>
                </>
              ) : (
                <>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-50 border border-slate-100"
                  >
                    <CloudUpload className="w-7 h-7 text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-700">
                      {dragOver ? 'Drop it here!' : 'Drag & drop or click to browse'}
                    </p>
                    <p className="text-xs mt-1 font-medium text-slate-400">
                      PDF, PPT, PPTX · Max {MAX_SIZE_MB} MB
                    </p>
                  </div>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.ppt,.pptx"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>

            {/* Upload progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">
                    Uploading...
                  </span>
                  <span className="text-xs font-bold text-cyan-600">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #22d3ee, #06b6d4, #0891b2)' }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}

            {/* Download toggle */}
            <div
              className="flex items-center justify-between rounded-2xl px-4 py-3 bg-slate-50 border border-slate-100"
            >
              <div className="flex items-center gap-2.5">
                <Download className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Allow Downloads</p>
                  <p className="text-xs font-medium text-slate-500">
                    Let viewers download the file
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDownloadEnabled(v => !v)}
                className="w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0"
                style={{
                  background: downloadEnabled
                    ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
                    : '#cbd5e1',
                }}
              >
                <motion.span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                  animate={{ left: downloadEnabled ? '22px' : '2px' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              {team.presentation && (
                <button
                  onClick={handleDelete}
                  disabled={deleting || uploading}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold transition-all hover:bg-red-100"
                  style={{
                    background: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#ef4444',
                  }}
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              )}
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-all"
                style={{
                  background: file && !uploading
                    ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
                    : '#cbd5e1',
                  opacity: file && !uploading ? 1 : 0.5,
                  boxShadow: file && !uploading ? '0 4px 20px rgba(6,182,212,0.4)' : 'none',
                }}
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                ) : (
                  <><Upload className="w-4 h-4" /> {team.presentation ? 'Replace Deck' : 'Upload Deck'}</>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PresentationUploadModal;
