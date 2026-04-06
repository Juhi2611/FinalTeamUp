// =============================================================
// components/ProjectTimeline.tsx
// Reusable project stage timeline
// - Shows on MyTeams (editable by leader)
// - Shows on DiscoverTeams (read-only)
// Default stages: Ideation → Design → Development → Testing → Launch
// Leader can rename stages, mark current stage, add/remove stages
// =============================================================

import { useEffect, useState } from 'react';
import { Check, ChevronRight, Edit2, Plus, Trash2, X, Save, Loader2 } from 'lucide-react';
import FeedbackModal from '@/components/FeedbackModal';
export interface ProjectStage {
  id: string;
  label: string;
  completed: boolean;
}

export const DEFAULT_STAGES: ProjectStage[] = [
  { id: '1', label: 'Ideation', completed: false },
  { id: '2', label: 'Design', completed: false },
  { id: '3', label: 'Development', completed: false },
  { id: '4', label: 'Testing', completed: false },
  { id: '5', label: 'Launch', completed: false },
];

interface ProjectTimelineProps {
  stages: ProjectStage[];
  teamId: string; // 👈 ADD THIS
  isLeader?: boolean;
  onSave?: (stages: ProjectStage[]) => Promise<void>;
  compact?: boolean;
}

const ProjectTimeline = ({
  stages,
  teamId, // 👈 ADD THIS
  isLeader = false,
  onSave,
  compact = false
}: ProjectTimelineProps) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectStage[]>(stages);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const currentStageIndex = stages.reduce((last, s, i) => s.completed ? i : last, -1);
  const nextStageIndex = currentStageIndex + 1;

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {}
    setSaving(false);
  };

  const toggleCompleted = (id: string) => {
    // Clicking a stage marks everything up to and including it as completed
    const idx = draft.findIndex(s => s.id === id);
    setDraft(draft.map((s, i) => ({ ...s, completed: i <= idx })));
  };

  const renameStage = (id: string, label: string) => {
    setDraft(draft.map(s => s.id === id ? { ...s, label } : s));
  };

  const removeStage = (id: string) => {
    setDraft(draft.filter(s => s.id !== id));
  };

  const addStage = () => {
    if (!newLabel.trim()) return;
    setDraft([...draft, {
      id: Date.now().toString(),
      label: newLabel.trim(),
      completed: false,
    }]);
    setNewLabel('');
  };

  const cancelEdit = () => {
    setDraft(stages);
    setEditing(false);
    setNewLabel('');
  };
useEffect(() => {
  const lastStage = stages[stages.length - 1];
  const alreadyGiven = localStorage.getItem(`feedback_${teamId}`);

  console.log("Stages:", stages);
  console.log("Last Stage:", lastStage);
  console.log("Completed:", lastStage?.completed);
  console.log("Stored Feedback:", alreadyGiven);

  if (
    lastStage?.label?.toLowerCase().includes('launch') &&
    lastStage.completed &&
    !alreadyGiven
  ) {
    console.log("🚀 SHOWING FEEDBACK MODAL");
    setShowFeedback(true);
  }
}, [stages, teamId]);

  // ── Compact mode (DiscoverTeams) ─────────────────────────
  if (compact) {
    return (
      <div className="mt-3">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Project Stage</p>
        <div className="flex items-center gap-1 flex-wrap text-xs">
          {stages.map((stage, i) => (
            <span key={stage.id} className="flex items-center gap-1">
              <span className={`font-medium ${
                stage.completed ? 'text-green-600' : i === nextStageIndex ? 'text-primary font-semibold' : 'text-muted-foreground'
              }`}>
                {stage.label}
              </span>
              {i < stages.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/60" />}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // ── Full mode (MyTeams / TeamProgressPanel) ───────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Project Timeline</p>
        {isLeader && !editing && (
          <button
            onClick={() => { setDraft(stages); setEditing(true); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        // ── View mode ──────────────────────────────────────
        <div className="relative">
          {/* Progress line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-secondary" />
          {stages.length > 1 && (
            <div
              className="absolute top-4 left-4 h-0.5 bg-green-500 transition-all duration-500"
              style={{ width: `${(currentStageIndex / (stages.length - 1)) * (100 - (8 / stages.length))}%` }}
            />
          )}
          <div className="relative flex justify-between">
            {stages.map((stage, i) => (
              <div key={stage.id} className="flex flex-col items-center gap-1.5" style={{ width: `${100 / stages.length}%` }}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all z-10 ${
                  stage.completed
                    ? 'bg-green-500 border-green-500 text-white'
                    : i === nextStageIndex
                    ? 'bg-background border-primary text-primary'
                    : 'bg-background border-border text-muted-foreground'
                }`}>
                  {stage.completed
                    ? <Check className="w-4 h-4" />
                    : i === nextStageIndex
                    ? <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    : <span className="text-xs font-bold">{i + 1}</span>
                  }
                </div>
                <span className={`text-xs text-center leading-tight ${
                  stage.completed ? 'text-green-600 font-medium' :
                  i === nextStageIndex ? 'text-primary font-medium' :
                  'text-muted-foreground'
                }`}>{stage.label}</span>
                {i === nextStageIndex && !stage.completed && (
                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Current</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ── Edit mode (leader only) ─────────────────────────
        <div className="space-y-3 p-4 rounded-xl bg-secondary/40 border border-border">
          <p className="text-xs text-muted-foreground">Click a stage dot to mark everything up to it as completed. Rename or remove stages as needed.</p>

          <div className="space-y-2">
            {draft.map((stage, i) => (
              <div key={stage.id} className="flex items-center gap-2">
                {/* Toggle completed */}
                <button
                  onClick={() => toggleCompleted(stage.id)}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    stage.completed ? 'bg-green-500 border-green-500 text-white' : 'border-border hover:border-primary'
                  }`}
                >
                  {stage.completed ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs">{i+1}</span>}
                </button>
                {/* Rename */}
                <input
                  value={stage.label}
                  onChange={e => renameStage(stage.id, e.target.value)}
                  className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
                />
                {/* Remove */}
                <button
                  onClick={() => removeStage(stage.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add new stage */}
          <div className="flex gap-2">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStage()}
              placeholder="Add new stage..."
              className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
            />
            <button onClick={addStage} disabled={!newLabel.trim()}
              className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-40">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2 pt-1">
            <button onClick={cancelEdit} className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1.5">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Timeline
            </button>
          </div>
        </div>
      )}
      {showFeedback && (
  <FeedbackModal
  teamId={teamId}
  onClose={() => setShowFeedback(false)}
/>
)}
    </div>
  );
};

export default ProjectTimeline;