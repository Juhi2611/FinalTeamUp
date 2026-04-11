import { X, AlertTriangle } from 'lucide-react';
import React from 'react';

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmModal = ({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false
}: ConfirmModalProps) => {
  return (
    <div className="modal-overlay z-[100]" onClick={!isLoading ? onCancel : undefined}>
      <div 
        className="modal-content animate-scale-in max-w-sm max-h-[90vh] flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="font-display font-bold text-lg text-foreground">{title}</h2>
          </div>
          <button 
            onClick={!isLoading ? onCancel : undefined}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-secondary cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="text-sm text-muted-foreground mb-6 overflow-y-auto pr-1">
          {message}
        </div>

        <div className="flex gap-3 mt-auto shrink-0">
          <button 
            onClick={onCancel} 
            disabled={isLoading}
            className="btn-secondary flex-1"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm} 
            disabled={isLoading}
            className="btn-primary flex-1 bg-amber-600 hover:bg-amber-700 text-white border-none"
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
