import { useRef } from 'react';
import { Upload, FileText, Trash2, Loader2 } from 'lucide-react';
import { usePrivateFiles } from '@/hooks/usePrivateFiles';
import { uploadPrivateFile } from '@/services/PrivateFiles';
import { supabase } from '@/lib/supabase';

interface Props {
  conversationId: string;
  currentUserId: string;
}

const PrivateFilesPanel = ({ conversationId, currentUserId }: Props) => {
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    files,
    loading,
    uploading,
    uploadFile,
    deleteFile
  } = usePrivateFiles(conversationId, currentUserId);
  const getFileIcon = (name: string) => {
  if (name.match(/\.(png|jpg|jpeg|webp)$/i)) return '🖼️';
  if (name.match(/\.(pdf)$/i)) return '📄';
  if (name.match(/\.(zip|rar)$/i)) return '🗜️';
  return '📁';
};
const forceDownload = async (file: any) => {
  if (!file.fileUrl) return;

  try {
    const response = await fetch(file.fileUrl);
    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('DOWNLOAD FAILED', err);
  }
};

  return (
    <div className="w-[320px] border-l border-border bg-card flex flex-col">
      {/* Upload */}
      <div className="p-4">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            console.log('Selected file:', file);
            if (file) uploadFile(file);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full btn-secondary flex items-center justify-center gap-2"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Upload file
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading files…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No files shared yet
          </p>
        ) : (
          files.map(file => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/40"
            >
              <div className="flex flex-col gap-1 truncate">
  {/* OPEN */}
  <a
    href={file.fileUrl}
    target="_blank"
    rel="noreferrer"
    className="flex items-center gap-2 text-sm hover:underline"
  >
    <FileText className="w-4 h-4 flex-shrink-0" />
    <span className="truncate">
      {getFileIcon(file.fileName)} {file.fileName}
    </span>
  </a>

  {/* DOWNLOAD */}
  <button
  onClick={() => forceDownload(file)}
  className="text-xs text-muted-foreground hover:underline ml-6"
>
  Download
</button>
</div>


              {file.uploaderId === currentUserId && (
                <button
                  onClick={() => deleteFile(file)}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PrivateFilesPanel;
