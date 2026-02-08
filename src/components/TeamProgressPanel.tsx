import { useState, useEffect } from 'react';
import { BarChart3, CheckSquare, Users, Plus, Trash2, Loader2, Crown, Edit, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getTeamTasks, 
  createTeamTask, 
  updateTaskCompletion,
  subscribeToTeamTasks,
  updateTeamTask,
  deleteTeamTask,
  TeamTask
} from '@/services/firestore';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TeamProgressPanelProps {
  teamId: string;
  members: { userId: string; role: string; userName?: string }[];
  isLeader: boolean;
  onClose: () => void;
}

const TeamProgressPanel = ({ teamId, members, isLeader, onClose }: TeamProgressPanelProps) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  
  // Edit mode state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editSelectedMembers, setEditSelectedMembers] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    
    const unsubscribe = subscribeToTeamTasks(teamId, (teamTasks) => {
      setTasks(teamTasks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamId]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || selectedMembers.length === 0) {
      toast.error('Please enter a task and select at least one member');
      return;
    }

    setAdding(true);
    try {
      await createTeamTask(teamId, {
        title: newTaskTitle.trim(),
        assignedTo: selectedMembers,
        completed: false
      });
      setNewTaskTitle('');
      setSelectedMembers([]);
      toast.success('Task added');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add task');
    }
    setAdding(false);
  };

  const handleToggleTask = async (task: TeamTask) => {
    if (!user) return;
    
    // Check if user is assigned to this task
    if (!task.assignedTo.includes(user.uid)) {
      toast.error('You can only complete tasks assigned to you');
      return;
    }

    try {
      await updateTaskCompletion(task.id, !task.completed, user.uid);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update task');
    }
  };

  const startEditTask = (task: TeamTask) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditSelectedMembers(task.assignedTo);
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditTaskTitle('');
    setEditSelectedMembers([]);
  };

  const handleUpdateTask = async (taskId: string) => {
    if (!editTaskTitle.trim() || editSelectedMembers.length === 0) {
      toast.error('Please enter a task title and select at least one member');
      return;
    }

    setUpdating(true);
    try {
      await updateTeamTask(taskId, {
        title: editTaskTitle.trim(),
        assignedTo: editSelectedMembers
      });
      toast.success('Task updated');
      cancelEdit();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update task');
    }
    setUpdating(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    setDeleting(taskId);
    try {
      await deleteTeamTask(taskId);
      toast.success('Task deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete task');
    }
    setDeleting(null);
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const toggleEditMemberSelection = (memberId: string) => {
    setEditSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Calculate progress
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate member-wise progress
  const memberProgress = members.map(member => {
    const memberTasks = tasks.filter(t => t.assignedTo.includes(member.userId));
    const memberCompleted = memberTasks.filter(t => t.completed).length;
    return {
      ...member,
      total: memberTasks.length,
      completed: memberCompleted,
      progress: memberTasks.length > 0 ? Math.round((memberCompleted / memberTasks.length) * 100) : 0
    };
  });

  const tasksCompletedByDate: Record<string, number> = {};

  tasks.forEach(task => {
    if (task.completed && task.completedAt) {
      const date = task.completedAt
        .toDate()
        .toISOString()
        .split('T')[0]; // YYYY-MM-DD

      tasksCompletedByDate[date] =
        (tasksCompletedByDate[date] || 0) + 1;
    }
  });

  const progressData = Object.keys(tasksCompletedByDate)
    .sort()
    .map(date => ({
      date,
      tasksCompleted: tasksCompletedByDate[date],
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
              {isLeader ? 'Manage tasks and track progress' : 'View team progress and your tasks'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="btn-secondary">
          Back to Team
        </button>
      </div>

      {/* Overall Progress Line Chart */}
      <div className="card-base p-6">
        <h3 className="font-display font-bold text-lg text-foreground mb-4">Overall Project Progress</h3>
        
        <div className="mb-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex-1">
              <div className="h-4 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
            <span className="text-2xl font-bold text-primary">{overallProgress}%</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {completedTasks} of {totalTasks} tasks completed
          </p>
        </div>

        {/* Line Chart */}
        {totalTasks > 0 && (
          <div className="mt-6">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}`, 'Tasks completed']}
                />
                <Line
                  type="monotone"
                  dataKey="tasksCompleted"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  name="Tasks Completed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Member-wise Progress */}
      <div className="card-base p-6">
        <h3 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Member-wise Progress
        </h3>
        <div className="space-y-4">
          {memberProgress.map(member => (
            <div key={member.userId} className="flex items-center gap-4">
              <div className="w-32 flex items-center gap-2">
                <img
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.userName || 'User')}`}
                  alt={member.userName}
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-sm font-medium truncate">{member.userName || 'User'}</span>
              </div>
              <div className="flex-1">
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-accent to-accent/80 rounded-full transition-all duration-500"
                    style={{ width: `${member.progress}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-muted-foreground w-20 text-right">
                {member.completed}/{member.total} ({member.progress}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Role Assignment (Leader Only) */}
      {isLeader && (
        <div className="card-base p-6">
          <h3 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-accent" />
            Assign New Task
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Task Title
              </label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Enter task description..."
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Assign to Members (can select multiple)
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map(member => (
                  <button
                    key={member.userId}
                    onClick={() => toggleMemberSelection(member.userId)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedMembers.includes(member.userId)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {member.userName || 'User'}
                    {member.role && <span className="text-xs opacity-75 ml-1">({member.role})</span>}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleAddTask}
              disabled={adding || !newTaskTitle.trim() || selectedMembers.length === 0}
              className="btn-primary flex items-center gap-2"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Task
            </button>
          </div>
        </div>
      )}

      {/* Task List - ALL TASKS VISIBLE TO EVERYONE */}
      <div className="card-base p-6">
        <h3 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-primary" />
          All Tasks
        </h3>
        
        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {isLeader ? 'No tasks created yet. Add a task above to get started.' : 'No tasks in this team yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => {
              const isEditing = editingTaskId === task.id;
              const isAssignedToMe = user && task.assignedTo.includes(user.uid);
              const canCheck = isAssignedToMe; // Only assigned members can check
              const assignedNames = task.assignedTo.map(uid => 
                members.find(m => m.userId === uid)?.userName || 'Unknown'
              );

              if (isEditing) {
                // Edit Mode (Leader Only)
                return (
                  <div key={task.id} className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editTaskTitle}
                        onChange={(e) => setEditTaskTitle(e.target.value)}
                        className="input-field"
                        placeholder="Task title"
                      />
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          Assigned to:
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {members.map(member => (
                            <button
                              key={member.userId}
                              onClick={() => toggleEditMemberSelection(member.userId)}
                              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                editSelectedMembers.includes(member.userId)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                              }`}
                            >
                              {member.userName || 'User'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateTask(task.id)}
                          disabled={updating}
                          className="btn-primary flex-1 text-sm"
                        >
                          {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="btn-secondary flex-1 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={task.id} 
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    task.completed 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'bg-secondary/30 border-border'
                  }`}
                >
                  <button
                    onClick={() => handleToggleTask(task)}
                    disabled={!canCheck}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      task.completed
                        ? 'bg-primary border-primary text-primary-foreground'
                        : canCheck
                          ? 'border-muted-foreground hover:border-primary'
                          : 'border-muted-foreground/30 cursor-not-allowed opacity-50'
                    }`}
                    title={!canCheck ? 'This task is not assigned to you' : 'Toggle completion'}
                  >
                    {task.completed && <CheckSquare className="w-4 h-4" />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Assigned to: {assignedNames.join(', ')}
                      {isAssignedToMe && <span className="ml-2 text-primary font-medium">(You)</span>}
                    </p>
                  </div>

                  {/* Edit/Delete buttons - Leader only */}
                  {isLeader && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEditTask(task)}
                        className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        title="Edit task"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        disabled={deleting === task.id}
                        className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                        title="Delete task"
                      >
                        {deleting === task.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamProgressPanel;