import { useState, useEffect, useRef } from 'react';
import {
  BarChart3, CheckSquare, Users, Plus, Trash2, Loader2, Crown,
  Edit, TrendingUp, Clock, Send, ShieldCheck, Link, FileText,
  Type, ExternalLink, BadgeCheck, Upload, X, AlertOctagon,
  RefreshCw, MessageSquare, Mail, Save, SaveAll
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToTeamTasks,
  updateTeamTask,
  deleteTeamTask,
  createTeamTask,
  submitTaskProof,
  verifyTask,
  TeamTask
} from '@/services/firestore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  notifyAssignedEmail,
  notifyReassignedEmail,
  notifyVerifiedEmail,
  notifyPendingReminderEmail,
} from '@/services/emailService';
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */

interface TeamProgressPanelProps {
  teamId: string;
  members: { userId: string; role: string; userName?: string; email?: string }[];
  isLeader: boolean;
  onClose: () => void;
}

type TaskTab   = 'inprogress' | 'submitted' | 'verified';
type ProofType = 'file' | 'link' | 'text';

type TaskTask = TeamTask & {
  status?:      'inprogress' | 'submitted' | 'verified';
  proof?:       { type: ProofType; value: string; fileName?: string };
  submittedBy?: string;
  submittedAt?: any;
  verifiedBy?:  string;
  verifiedAt?:  any;
  isUrgent?:    boolean;
};



/* ─────────────────────────────────────────────────────────────
   File Upload (Supabase)
───────────────────────────────────────────────────────────── */

const uploadProofFile = async (file: File, taskId: string): Promise<string> => {
  const path = `task-proofs/${taskId}_${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from('task-proofs').upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('task-proofs').getPublicUrl(path);
  return data.publicUrl;
};

/* ─────────────────────────────────────────────────────────────
   Proof Viewer
───────────────────────────────────────────────────────────── */

const ProofViewer = ({ proof }: { proof: { type: ProofType; value: string; fileName?: string } }) => {
  if (proof.type === 'text') return (
    <div className="mt-2 p-3 rounded-lg bg-secondary/50 border border-border">
      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
        <Type className="w-3 h-3" /> Text Proof
      </p>
      <p className="text-sm text-foreground whitespace-pre-wrap">{proof.value}</p>
    </div>
  );
  if (proof.type === 'link') return (
    <div className="mt-2">
      <a href={proof.value} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <Link className="w-3.5 h-3.5" /> View Link <ExternalLink className="w-3 h-3 opacity-60" />
      </a>
    </div>
  );
  if (proof.type === 'file') return (
    <div className="mt-2">
      <a href={proof.value} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <FileText className="w-3.5 h-3.5" /> {proof.fileName || 'View File'}
        <ExternalLink className="w-3 h-3 opacity-60" />
      </a>
    </div>
  );
  return null;
};

/* ─────────────────────────────────────────────────────────────
   Submit Proof Modal
───────────────────────────────────────────────────────────── */

const SubmitProofModal = ({
  task, onClose, onSubmit,
}: {
  task: TeamTask;
  onClose: () => void;
  onSubmit: (proof: { type: ProofType; value: string; fileName?: string }) => Promise<void>;
}) => {
  const [proofType, setProofType]   = useState<ProofType>('text');
  const [textValue, setTextValue]   = useState('');
  const [linkValue, setLinkValue]   = useState('');
  const [file, setFile]             = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let proof: { type: ProofType; value: string; fileName?: string };
      if (proofType === 'text') {
        if (!textValue.trim()) { toast.error('Please enter proof text'); setSubmitting(false); return; }
        proof = { type: 'text', value: textValue.trim() };
      } else if (proofType === 'link') {
        if (!linkValue.trim()) { toast.error('Please enter a link'); setSubmitting(false); return; }
        proof = { type: 'link', value: linkValue.trim() };
      } else {
        if (!file) { toast.error('Please select a file'); setSubmitting(false); return; }
        toast.info('Uploading file...');
        const url = await uploadProofFile(file, task.id);
        proof = { type: 'file', value: url, fileName: file.name };
      }
      await onSubmit(proof);
      onClose();
    } catch (err: any) { toast.error(err.message || 'Failed to submit proof'); }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-display font-bold text-xl text-foreground">Submit Proof</h2>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{task.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Proof Type</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'text', label: 'Text',     icon: Type   },
                { id: 'link', label: 'Link / URL', icon: Link  },
                { id: 'file', label: 'File',     icon: Upload  },
              ] as { id: ProofType; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setProofType(id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    proofType === id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}>
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
          {proofType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Description / Proof</label>
              <textarea value={textValue} onChange={e => setTextValue(e.target.value)}
                placeholder="Describe what you did, paste code, or write your proof..."
                className="input-field min-h-[120px] resize-none" />
            </div>
          )}
          {proofType === 'link' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Link / URL</label>
              <input type="url" value={linkValue} onChange={e => setLinkValue(e.target.value)}
                placeholder="https://github.com/... or any link" className="input-field" />
            </div>
          )}
          {proofType === 'file' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Upload File</label>
              <div onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}>
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <FileText className="w-5 h-5" />
                    <span className="text-sm font-medium">{file.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload any file</p>
                    <p className="text-xs text-muted-foreground mt-1">Images, PDFs, docs, etc.</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
          )}
        </div>
        <div className="flex gap-3 p-6 border-t border-border">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          {task.deadline && (task.deadline as any).toDate() < new Date() ? (
            <div className="flex-1 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
              <p className="text-xs font-bold text-red-600 uppercase tracking-tight">Deadline Passed</p>
              <p className="text-[10px] text-red-500">You can no longer submit this task.</p>
            </div>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Proof
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Reassign Modal  (leader only — shown on submitted tasks)
───────────────────────────────────────────────────────────── */

const ReassignModal = ({
  task,
  members,
  onClose,
  onReassign,
}: {
  task: TaskTask;
  members: { userId: string; role: string; userName?: string; email?: string }[];
  onClose: () => void;
  onReassign: (taskId: string, assignedTo: string[], note: string) => Promise<void>;
}) => {
  const [selectedMembers, setSelectedMembers] = useState<string[]>(task.assignedTo || []);
  const [note, setNote]                       = useState('');
  const [saving, setSaving]                   = useState(false);

  const toggle = (uid: string) =>
    setSelectedMembers(p => p.includes(uid) ? p.filter(x => x !== uid) : [...p, uid]);

  const handleSave = async () => {
    if (selectedMembers.length === 0) { toast.error('Select at least one member'); return; }
    setSaving(true);
    try {
      await onReassign(task.id, selectedMembers, note);
      onClose();
    } catch (err: any) { toast.error(err.message || 'Failed to reassign'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-display font-bold text-xl text-foreground flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              Reassign Task
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{task.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Context note */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              The submitted work did not meet requirements. Reassigning will move the task back to
              "In Progress" and notify the member(s) via email.
            </p>
          </div>

          {/* Member selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Assign to:</label>
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <button key={m.userId} onClick={() => toggle(m.userId)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedMembers.includes(m.userId)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}>
                  {m.userName || 'User'}
                </button>
              ))}
            </div>
          </div>

          {/* Leader note */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              Note for member <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Please redo the API integration — the endpoints used were incorrect..."
              className="input-field resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-border">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Reassign &amp; Notify
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Urgent Badge
───────────────────────────────────────────────────────────── */

const UrgentBadge = () => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-600 text-[10px] font-bold uppercase tracking-wide">
    <AlertOctagon className="w-3 h-3" />
    Urgent
  </span>
);

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */

const TeamProgressPanel = ({ teamId, members, isLeader, onClose }: TeamProgressPanelProps) => {
  const { user } = useAuth();
  const [tasks, setTasks]     = useState<TaskTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TaskTab>('inprogress');

  // Add task form
  const [newTaskTitle, setNewTaskTitle]         = useState('');
  const [selectedMembers, setSelectedMembers]   = useState<string[]>([]);
  const [newTaskUrgent, setNewTaskUrgent]       = useState(false);
  const [newTaskPerkValue, setNewTaskPerkValue] = useState<number>(10);
  const [newTaskDeadline, setNewTaskDeadline]   = useState<string>(''); // ISO date string
  const [adding, setAdding]                     = useState(false);

  // Edit task
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle]         = useState('');
  const [editMembers, setEditMembers]     = useState<string[]>([]);
  const [editUrgent, setEditUrgent]       = useState(false);
  const [editPerkValue, setEditPerkValue] = useState<number>(10);
  const [editDeadline, setEditDeadline]   = useState<string>(''); // ISO date string
  const [updating, setUpdating]           = useState(false);
  const [deleting, setDeleting]           = useState<string | null>(null);

  // Submit proof modal
  const [proofTask, setProofTask] = useState<TaskTask | null>(null);

  // Reassign modal
  const [reassignTask, setReassignTask] = useState<TaskTask | null>(null);

  // Verify loading
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    const unsub = subscribeToTeamTasks(teamId, (t) => {
      setTasks(t as TaskTask[]);
      setLoading(false);
    });
    return () => unsub();
  }, [teamId]);

  /* ── Derived lists ───────────────────────────────────────── */

  const inProgressTasks = tasks.filter(t => !t.status || t.status === 'inprogress');
  const submittedTasks  = tasks.filter(t => t.status === 'submitted');
  const verifiedTasks   = tasks.filter(t => t.status === 'verified');
  const [editingPerksId, setEditingPerksId] = useState<string | null>(null);
  const [tempPerkValue, setTempPerkValue] = useState<number>(10);

  const totalTasks    = tasks.length;
  const verifiedCount = verifiedTasks.length;
  const overallProgress = totalTasks > 0 ? Math.round((verifiedCount / totalTasks) * 100) : 0;

  const memberProgress = members.map(m => {
    const mt = tasks.filter(t => t.assignedTo?.includes(m.userId));
    const mv = mt.filter(t => t.status === 'verified').length;
    return { ...m, total: mt.length, verified: mv, progress: mt.length > 0 ? Math.round((mv / mt.length) * 100) : 0 };
  });

  const tasksByDate: Record<string, number> = {};
  tasks.filter(t => t.status === 'verified' && t.verifiedAt).forEach(t => {
    const d = (t.verifiedAt as any)?.toDate?.()?.toISOString?.()?.split('T')[0];
    if (d) tasksByDate[d] = (tasksByDate[d] || 0) + 1;
  });
  const chartData = Object.keys(tasksByDate).sort().map(d => ({ date: d, verified: tasksByDate[d] }));

  /* ── Helpers ─────────────────────────────────────────────── */

  const getMemberName  = (uid: string) => members.find(m => m.userId === uid)?.userName  || 'Unknown';
  const getMemberEmail = (uid: string) => members.find(m => m.userId === uid)?.email;

  /* ── Handlers ────────────────────────────────────────────── */

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || selectedMembers.length === 0) {
      toast.error('Enter a task title and select at least one member');
      return;
    }
    if (newTaskPerkValue > 50) {
      toast.error('Maximum perk reward is 50 points');
      return;
    }

    setAdding(true);
    try {
      const deadline = newTaskDeadline ? new Date(newTaskDeadline) : null;
      await createTeamTask(teamId, {
        title: newTaskTitle.trim(),
        assignedTo: selectedMembers,
        completed: false,
        isUrgent: newTaskUrgent,
        perkValue: newTaskPerkValue,
        deadline,
      });
      selectedMembers.forEach(async (uid) => {
        await addDoc(collection(db, 'activity'), {
          userId: uid,
          type: 'task_assigned',
          createdAt: serverTimestamp()
        });
      });
      const results = await Promise.allSettled(
        selectedMembers.map(uid =>
          notifyAssignedEmail(
            getMemberEmail(uid),
            getMemberName(uid),
            newTaskTitle.trim(),
            newTaskUrgent,
            newTaskDeadline ? new Date(newTaskDeadline).toLocaleDateString() : null
          )
        )
      );
      const sentCount = results.filter(r => r.status === 'fulfilled' && (r as any).value).length;
      setNewTaskTitle('');
      setSelectedMembers([]);
      setNewTaskUrgent(false);
      setNewTaskPerkValue(10);
      setNewTaskDeadline('');
      if (sentCount > 0) {
        toast.success(`Task added. Email sent to ${sentCount}/${selectedMembers.length} member(s).`);
      } else {
        toast.info('Task added, but email notifications were not delivered.');
      }
    } catch (err: any) { toast.error(err.message || 'Failed'); }
    setAdding(false);
  };

  const handleUpdatePerks = async (taskId: string) => {
    if (tempPerkValue > 50) {
      toast.error('Maximum perk reward is 50 points');
      return;
    }
    setUpdating(true);
    try {
      await updateTeamTask(taskId, { perkValue: tempPerkValue } as any);
      toast.success('Perk reward updated');
      setEditingPerksId(null);
    } catch (err: any) {
      toast.error('Failed to update perks');
    }
    setUpdating(false);
  };

  const handleSubmitProof = async (proof: { type: ProofType; value: string; fileName?: string }) => {
    if (!proofTask || !user) return;
    await submitTaskProof(proofTask.id, user.uid, proof);
    await addDoc(collection(db, "activity"), {
      userId: user.uid,
      type: "task_submitted",
      createdAt: serverTimestamp()
    });
    toast.success('Proof submitted! Waiting for leader verification.');
  };

  const handleVerify = async (task: TaskTask) => {
    if (!user) return;
    setVerifying(task.id);
    try {
      const result = await verifyTask(task.id, user.uid) as any;
      
      await addDoc(collection(db, "activity"), {
        userId: user.uid,
        type: "task_verified",
        createdAt: serverTimestamp()
      });

      // Notify all assigned members
      const assigned = task.assignedTo || [];
      const results = await Promise.allSettled(
        assigned.map(uid =>
          notifyVerifiedEmail(getMemberEmail(uid), getMemberName(uid), task.title)
        )
      );
      const sentCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

      if (result?.penaltyApplied) {
        toast.info(`Task verified. Deadline missed! ${result.penaltyAmount} perks deducted as penalty.`, {
          duration: 6000,
          description: `Deadline: ${new Date(result.deadline).toLocaleString()}`
        });
      } else {
        toast.success(`Task verified. Perks awarded! Email sent to ${sentCount}/${assigned.length} member(s).`);
      }
    } catch (err: any) { toast.error(err.message || 'Failed'); }
    setVerifying(null);
  };

  const handleReassign = async (taskId: string, assignedTo: string[], note: string) => {
    await updateTeamTask(taskId, { assignedTo, status: 'inprogress', proof: null } as any);
    const task = tasks.find(t => t.id === taskId);
    // Notify newly assigned members via email
    const results = await Promise.allSettled(
      assignedTo.map(uid =>
        notifyReassignedEmail(getMemberEmail(uid), getMemberName(uid), task?.title || 'Task', note)
      )
    );
    const sentCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    toast.success(`Task reassigned. Email sent to ${sentCount}/${assignedTo.length} member(s).`);
  };

  const handleUpdateTask = async (taskId: string) => {
    if (!editTitle.trim() || editMembers.length === 0) { toast.error('Fill all fields'); return; }
    if (editPerkValue > 50) { toast.error('Maximum perk reward is 50 points'); return; }
    
    setUpdating(true);
    try {
      const deadline = editDeadline ? new Date(editDeadline) : null;
      await updateTeamTask(taskId, { 
        title: editTitle.trim(), 
        assignedTo: editMembers, 
        isUrgent: editUrgent,
        perkValue: editPerkValue,
        deadline
      } as any);
      toast.success('Task updated');
      setEditingTaskId(null);
    } catch (err: any) { toast.error(err.message || 'Failed'); }
    setUpdating(false);
  };

  const handleUnsubmit = async (taskId: string) => {
    try {
      const { unsubmitTask } = await import('@/services/firestore');
      await unsubmitTask(taskId);
      toast.success('Task unsubmitted. You can now edit and re-submit.');
    } catch (err: any) {
      toast.error('Failed to unsubmit task');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    setDeleting(taskId);
    try { await deleteTeamTask(taskId); toast.success('Deleted'); }
    catch (err: any) { toast.error(err.message || 'Failed'); }
    setDeleting(null);
  };

  // Send pending reminder for a member
  const handleRemindMember = async (m: typeof members[number]) => {
    // 1. Check if email exists on the object
    if (!m.email) {
      console.error("Member object missing email:", m);
      toast.error(`Error: No email found for ${m.userName}. Refresh the page.`);
      return;
    }

    const pending = tasks
      .filter(t => t.assignedTo?.includes(m.userId) && t.status !== 'verified')
      .map(t => t.title);

    if (pending.length === 0) { 
      toast.info('No pending tasks for this member'); 
      return; 
    }

    // 2. Attempt the send
    const sent = await notifyPendingReminderEmail(m.email, m.userName || 'Member', pending);
    
    if (sent) {
      toast.success(`Reminder email sent to ${m.userName}`);
    } else {
      // This only triggers if the API key is missing or Resend API returns an error
      toast.error('Email failed. Check VITE_RESEND_API_KEY or Resend Dashboard.');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  /* ── Tab task renderer ───────────────────────────────────── */

  const renderTask = (task: TaskTask, tab: TaskTab) => {
    const isEditing      = editingTaskId === task.id;
    const isAssignedToMe = user && task.assignedTo?.includes(user.uid);
    const assignedNames  = (task.assignedTo || []).map(getMemberName);

    /* ── Edit mode ── */
    if (isEditing) return (
      <div key={task.id} className="p-4 rounded-xl border-2 border-primary bg-primary/5 space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-primary uppercase tracking-wider ml-1">Task Title</label>
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
            className="input-field" placeholder="Task title" />
        </div>
        
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-primary uppercase tracking-wider ml-1">Assigned Members</label>
          <div className="flex flex-wrap gap-2">
            {members.map(m => (
              <button key={m.userId}
                onClick={() => setEditMembers(p => p.includes(m.userId) ? p.filter(x => x !== m.userId) : [...p, m.userId])}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  editMembers.includes(m.userId) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}>
                {m.userName || 'User'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-primary uppercase tracking-wider ml-1">Perk Reward (1-50)</label>
            <input 
              type="number" 
              min={1} 
              max={50} 
              value={editPerkValue} 
              onChange={e => setEditPerkValue(Number(e.target.value))}
              className="input-field py-1.5" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-primary uppercase tracking-wider ml-1">Deadline (Optional)</label>
            <input 
              type="date" 
              value={editDeadline} 
              onChange={e => setEditDeadline(e.target.value)}
              className="input-field py-1.5" 
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setEditUrgent(v => !v)}
              className={`w-9 h-5 rounded-full flex items-center transition-colors ${
                editUrgent ? 'bg-red-500' : 'bg-secondary'
              }`}>
              <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${editUrgent ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
              Urgent
            </span>
          </label>

          <div className="flex gap-2">
            <button onClick={() => setEditingTaskId(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary transition-colors">Cancel</button>
            <button onClick={() => handleUpdateTask(task.id)} disabled={updating}
              className="bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5 focus:ring-2 focus:ring-primary focus:ring-offset-2">
              {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );

    /* ── Normal card ── */
    return (
      <div key={task.id} className={`p-4 rounded-xl border transition-all ${
        task.isUrgent && tab !== 'verified'
          ? 'bg-red-500/5 border-red-500/25'
          : tab === 'verified'   ? 'bg-green-500/5 border-green-500/20'
          : tab === 'submitted'  ? 'bg-primary/5 border-primary/20'
          : 'bg-secondary/30 border-border'
      }`}>
        <div className="flex items-start gap-3">
          {/* Status icon */}
          <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
            tab === 'verified'  ? 'bg-green-500/20' :
            tab === 'submitted' ? 'bg-primary/20'   : 'bg-secondary'
          }`}>
            {tab === 'verified'  ? <BadgeCheck className="w-3.5 h-3.5 text-green-600" /> :
             tab === 'submitted' ? <Send        className="w-3.5 h-3.5 text-primary"   /> :
             task.isUrgent
               ? <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
               : <Clock         className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-semibold ${tab === 'verified' ? 'text-green-700 line-through' : 'text-foreground'}`}>
                {task.title}
              </p>
              {task.isUrgent && tab !== 'verified' && <UrgentBadge />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Assigned to: {assignedNames.join(', ')}
              {isAssignedToMe && <span className="ml-1 text-primary font-medium">(You)</span>}
            </p>

            {/* Replace the "Potential Reward Display" section with this: */}
            {tab !== 'verified' && (
              <div className="mt-1 flex items-center gap-2">
                {isLeader && editingPerksId === task.id ? (
                  <div className="flex items-center gap-2 bg-amber-500/10 p-1 rounded border border-amber-500/20">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={tempPerkValue}
                      onChange={(e) => setTempPerkValue(Number(e.target.value))}
                      className="w-12 text-xs font-bold bg-transparent outline-none text-amber-700"
                      autoFocus
                    />
                    <button 
                      onClick={() => handleUpdatePerks(task.id)}
                      className="text-[10px] bg-amber-600 text-white px-1.5 py-0.5 rounded hover:bg-amber-700"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setEditingPerksId(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div 
                    className={`flex items-center gap-1 text-[10px] font-medium text-amber-600/80 ${isLeader ? 'cursor-pointer hover:text-amber-700 underline decoration-dotted' : ''}`}
                    onClick={() => {
                      if (isLeader) {
                        setEditingPerksId(task.id);
                        setTempPerkValue(task.perkValue ?? 10);
                      }
                    }}
                    title={isLeader ? "Click to edit reward" : ""}
                  >
                    <TrendingUp className="w-3 h-3" />
                    <span>Task Reward: {task.perkValue ?? 10} Perks</span>
                    {isLeader && <Edit className="w-2.5 h-2.5 ml-0.5" />}
                  </div>
                )}
              </div>
            )}

            {/* Proof — visible to leader only */}
            {isLeader && task.proof && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Submitted Proof</p>
                <ProofViewer proof={task.proof as any} />
              </div>
            )}

            {/* Verified by (Existing) */}
            {tab === 'verified' && task.verifiedBy && (
              <div className="space-y-1 mt-1">
                <p className="text-xs text-green-600">
                  Verified by {getMemberName(task.verifiedBy)}
                </p>
                
                {/* ✅ NEW: Awarded Perks Badge */}
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 uppercase">
                  <TrendingUp className="w-3 h-3" />
                  <span>+{task.perkValue ?? 10} Perks Awarded</span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
            {/* ✅ NEW: Member Unsubmit Option */}
            {tab === 'submitted' && isAssignedToMe && (
              <button 
                onClick={() => handleUnsubmit(task.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
                title="Retract submission to make changes"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Unsubmit
              </button>
            )}

            {/* Member: submit proof */}
            {tab === 'inprogress' && isAssignedToMe && (
              <button onClick={() => setProofTask(task)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                <Send className="w-3.5 h-3.5" /> Submit
              </button>
            )}

            {/* Leader: verify */}
            {tab === 'submitted' && isLeader && (
              <button onClick={() => handleVerify(task)} disabled={verifying === task.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition-colors">
                {verifying === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Verify
              </button>
            )}

            {/* Leader: reassign submitted task */}
            {tab === 'submitted' && isLeader && (
              <button onClick={() => setReassignTask(task)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 text-xs font-medium hover:bg-amber-500/20 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Reassign
              </button>
            )}

            {/* Leader: edit/delete in-progress tasks */}
            {isLeader && tab === 'inprogress' && (
              <>
                <button onClick={() => {
                  setEditingTaskId(task.id);
                  setEditTitle(task.title);
                  setEditMembers(task.assignedTo || []);
                  setEditUrgent(task.isUrgent || false);
                  setEditPerkValue(task.perkValue || 10);
                  // Convert Timestamp to YYYY-MM-DD for the date input
                  const d = (task.deadline as any)?.toDate?.() || null;
                  setEditDeadline(d ? d.toISOString().split('T')[0] : '');
                }}
                  className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(task.id)} disabled={deleting === task.id}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  {deleting === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const tabTasks = activeTab === 'inprogress' ? inProgressTasks : activeTab === 'submitted' ? submittedTasks : verifiedTasks;

  const tabConfig = [
    { id: 'inprogress' as TaskTab, label: 'In Progress', icon: Clock,     count: inProgressTasks.length, color: 'text-yellow-600' },
    { id: 'submitted'  as TaskTab, label: 'Submitted',   icon: Send,      count: submittedTasks.length,  color: 'text-primary'   },
    { id: 'verified'   as TaskTab, label: 'Verified',    icon: BadgeCheck, count: verifiedTasks.length,   color: 'text-green-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-foreground">Team Progress</h2>
            <p className="text-muted-foreground text-sm">
              {isLeader ? 'Manage tasks, verify or reassign submissions' : 'Submit proof to complete your tasks'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="btn-secondary">Back to Team</button>
      </div>

      {/* Overall progress */}
      <div className="card-base p-6">
        <h3 className="font-display font-bold text-lg text-foreground mb-4">Overall Progress</h3>
        <div className="flex items-center gap-4 mb-2">
          <div className="flex-1 h-4 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }} />
          </div>
          <span className="text-2xl font-bold text-primary">{overallProgress}%</span>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          {verifiedCount} of {totalTasks} tasks verified ·&nbsp;
          <span className="text-yellow-600">{inProgressTasks.length} in progress</span> ·&nbsp;
          <span className="text-primary">{submittedTasks.length} awaiting review</span>
          {tasks.filter(t => t.isUrgent && t.status !== 'verified').length > 0 && (
            <>
              &nbsp;·&nbsp;
              <span className="text-red-500 font-medium inline-flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5" />
                {tasks.filter(t => t.isUrgent && t.status !== 'verified').length} urgent
              </span>
            </>
          )}
        </p>

        {chartData.length > 0 && (
          <div className="mt-6">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v, 'Tasks verified']} />
                <Line type="monotone" dataKey="verified" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Member progress + Email reminder */}
      <div className="card-base p-6">
        <h3 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Member Progress
        </h3>
        <div className="space-y-4">
          {memberProgress.map(m => (
            <div key={m.userId} className="flex items-center gap-4">
              <div className="w-36 flex items-center gap-2 flex-shrink-0">
                <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.userName || 'User')}`}
                  className="w-8 h-8 rounded-full" alt="" />
                <span className="text-sm font-medium truncate">{m.userName || 'User'}</span>
              </div>
              <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${m.progress}%` }} />
              </div>
              <span className="text-xs text-muted-foreground w-20 text-right flex-shrink-0">
                {m.verified}/{m.total} ({m.progress}%)
              </span>
              {/* Email reminder button — leader only */}
              {isLeader && m.total > m.verified && (
                <button
                  onClick={() => handleRemindMember(m)}
                  title="Send email reminder"
                  className="flex-shrink-0 p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
                  <Mail className="w-4 h-4 text-primary" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add task (leader only) */}
      {isLeader && (
        <div className="card-base p-6">
          <h3 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-accent" /> Assign New Task
          </h3>
          <div className="space-y-4">
            <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
              placeholder="Task title..." className="input-field" />
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Assign to:</label>
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <button key={m.userId}
                    onClick={() => setSelectedMembers(p => p.includes(m.userId) ? p.filter(x => x !== m.userId) : [...p, m.userId])}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedMembers.includes(m.userId) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}>
                    {m.userName || 'User'}
                    {m.role && <span className="text-xs opacity-75 ml-1">({m.role})</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Urgent toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <div
                onClick={() => setNewTaskUrgent(v => !v)}
                className={`w-10 h-5 rounded-full flex items-center transition-colors ${
                  newTaskUrgent ? 'bg-red-500' : 'bg-secondary'
                }`}>
                <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${newTaskUrgent ? 'translate-x-5' : ''}`} />
              </div>
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                <AlertOctagon className={`w-4 h-4 ${newTaskUrgent ? 'text-red-500' : 'text-muted-foreground'}`} />
                Mark as Urgent
                {newTaskUrgent && <UrgentBadge />}
              </span>
            </label>

            {/* ✅ Perk Reward Input (Leader Only) */}
            {isLeader && (
              <div className="flex items-center gap-3 mt-3 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 w-fit">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-600 shrink-0" />
                  <label className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                    Task Reward:
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newTaskPerkValue}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setNewTaskPerkValue(val > 50 ? 50 : val);
                    }}
                    className="w-16 bg-background border border-amber-200 rounded-lg px-2 py-1 text-sm font-bold text-amber-700 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <span className="text-xs font-medium text-amber-600">Perks</span>
                </div>
              </div>
            )}

            {/* ✅ Deadline Picker (Leader Only) */}
            {isLeader && (
              <div className="flex items-center gap-3 mt-2 bg-rose-500/5 p-3 rounded-xl border border-rose-500/10 w-fit">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                  <label className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                    Deadline <span className="text-rose-400 font-normal normal-case">(optional — miss it = 30% penalty)</span>:
                  </label>
                </div>
                <input
                  type="date"
                  value={newTaskDeadline}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setNewTaskDeadline(e.target.value)}
                  className="bg-background border border-rose-200 rounded-lg px-2 py-1 text-sm text-rose-700 focus:ring-2 focus:ring-rose-400 outline-none"
                />
                {newTaskDeadline && (
                  <button
                    type="button"
                    onClick={() => setNewTaskDeadline('')}
                    className="text-rose-400 hover:text-rose-600 text-xs"
                  >✕ Clear</button>
                )}
              </div>
            )}

            <button onClick={handleAddTask}
              disabled={adding || !newTaskTitle.trim() || selectedMembers.length === 0}
              className="btn-primary flex items-center gap-2">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Task &amp; Notify via Email
            </button>
          </div>
        </div>
      )}

      {/* Task tabs */}
      <div className="card-base overflow-hidden">
        <div className="flex border-b border-border">
          {tabConfig.map(({ id, label, icon: Icon, count, color }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === id ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}>
              <Icon className={`w-4 h-4 ${activeTab === id ? 'text-primary' : color}`} />
              {label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}>{count}</span>
            </button>
          ))}
        </div>

        <div className="p-6 space-y-3">
          {tabTasks.length === 0 ? (
            <div className="text-center py-10">
              {activeTab === 'inprogress' && <Clock    className="w-10 h-10 text-muted-foreground mx-auto mb-3" />}
              {activeTab === 'submitted'  && <Send     className="w-10 h-10 text-muted-foreground mx-auto mb-3" />}
              {activeTab === 'verified'   && <BadgeCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />}
              <p className="text-muted-foreground text-sm">
                {activeTab === 'inprogress' && 'No tasks in progress'}
                {activeTab === 'submitted'  && 'No submissions awaiting review'}
                {activeTab === 'verified'   && 'No verified tasks yet'}
              </p>
            </div>
          ) : (
            tabTasks.map(task => renderTask(task, activeTab))
          )}
        </div>
      </div>

      {/* Modals */}
      {proofTask && (
        <SubmitProofModal
          task={proofTask}
          onClose={() => setProofTask(null)}
          onSubmit={handleSubmitProof}
        />
      )}

      {reassignTask && (
        <ReassignModal
          task={reassignTask}
          members={members}
          onClose={() => setReassignTask(null)}
          onReassign={handleReassign}
        />
      )}
    </div>
  );
};

export default TeamProgressPanel;