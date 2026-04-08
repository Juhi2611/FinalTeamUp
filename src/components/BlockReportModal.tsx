import { useState } from 'react';
import { X, Flag, Ban, AlertTriangle, Loader2 } from 'lucide-react';
import { blockUser, reportUser, getReportReasons } from '@/services/blockReportService';
import { toast } from 'sonner';

interface BlockReportModalProps {
  targetUserId: string;
  targetUserName: string;
  currentUserId: string;
  onClose: () => void;
  onBlockComplete?: () => void;
}

const BlockReportModal = ({
  targetUserId,
  targetUserName,
  currentUserId,
  onClose,
  onBlockComplete
}: BlockReportModalProps) => {
  const [mode, setMode] = useState<'choice' | 'block' | 'report'>('choice');
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const reasons = getReportReasons();

  const handleBlock = async () => {
    setLoading(true);
    try {
      await blockUser(currentUserId, targetUserId);
      toast.success(`${targetUserName} has been blocked. You will no longer see each other.`);
      onBlockComplete?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to block user');
    }
    setLoading(false);
  };

  const handleReport = async () => {
    if (!selectedReason) {
      toast.error('Please select a reason for reporting');
      return;
    }
    setLoading(true);
    try {
      await reportUser(currentUserId, targetUserId, selectedReason, description);
      toast.success('Report submitted. Thank you for helping keep TeamUp safe.');
      onClose();
    } catch (error: any) {
  console.error('Report error:', error);
  toast.error(error?.message ?? 'Failed to submit report');
}

    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-destructive/10">
              {mode === 'report' ? <Flag className="w-5 h-5 text-destructive" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
            </div>
            <h2 className="font-display font-bold text-xl text-foreground">
              {mode === 'choice' && 'Block or Report User'}
              {mode === 'block' && 'Block User'}
              {mode === 'report' && 'Report User'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {mode === 'choice' && (
          <div className="space-y-4">
            <p className="text-muted-foreground mb-4">What would you like to do with <strong>{targetUserName}</strong>?</p>
            <button onClick={() => setMode('block')} className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-muted"><Ban className="w-5 h-5 text-muted-foreground" /></div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Block User</h3>
                  <p className="text-sm text-muted-foreground">You won't see each other's profiles, posts, or teams.</p>
                </div>
              </div>
            </button>
            <button onClick={() => setMode('report')} className="w-full p-4 rounded-xl border-2 border-border hover:border-destructive/50 hover:bg-destructive/5 transition-all text-left">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-muted"><Flag className="w-5 h-5 text-muted-foreground" /></div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Report User</h3>
                  <p className="text-sm text-muted-foreground">Report inappropriate behavior for review.</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {mode === 'block' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-foreground"><strong>Are you sure you want to block {targetUserName}?</strong></p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>You won't see their posts, teams, or profile</li>
                <li>They won't see yours either</li>
                <li>Neither can invite each other</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setMode('choice')} className="btn-secondary flex-1" disabled={loading}>Cancel</button>
              <button onClick={handleBlock} disabled={loading} className="btn-primary bg-destructive hover:bg-destructive/90 flex-1 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Block
              </button>
            </div>
          </div>
        )}

        {mode === 'report' && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-foreground mb-2">Why are you reporting {targetUserName}?</label>
            <div className="space-y-2">
              {reasons.map((reason) => (
                <label key={reason} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedReason === reason ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                  <input type="radio" name="reason" value={reason} checked={selectedReason === reason} onChange={(e) => setSelectedReason(e.target.value)} className="sr-only" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedReason === reason ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                    {selectedReason === reason && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                  </div>
                  <span className="text-sm text-foreground">{reason}</span>
                </label>
              ))}
            </div>
            {selectedReason === 'Other' && (
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue..." className="input-field min-h-[100px] resize-none" maxLength={500} />
            )}
            <div className="flex gap-3">
              <button onClick={() => setMode('choice')} className="btn-secondary flex-1" disabled={loading}>Cancel</button>
              <button onClick={handleReport} disabled={loading || !selectedReason} className="btn-primary bg-destructive hover:bg-destructive/90 flex-1 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />} Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlockReportModal;
