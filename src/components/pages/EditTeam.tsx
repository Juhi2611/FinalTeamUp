import { useState, useEffect } from 'react';
import { Users, X, Plus, Sparkles, Save, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getTeam, updateTeam, Team } from '@/services/firestore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isFirebaseConfigured } from '@/lib/firebase';
import { toast } from 'sonner';
import DemoLockModal from "@/components/DemoLockModal";

interface EditTeamProps {
  teamId: string;
  onNavigate: (page: string) => void;
  onBack: () => void;
  onTeamUpdated?: (updatedTeam: Partial<Team>) => void;
}

const EditTeam = ({ teamId, onNavigate, onBack, onTeamUpdated }: EditTeamProps) => {
  const { isDemoUser } = useAuth();
  const [showDemoLock, setShowDemoLock] = useState(false);
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [hackathon, setHackathon] = useState('');
  const [city, setCity] = useState('');
  const [rolesNeeded, setRolesNeeded] = useState<string[]>([]);
  const [maxMembers, setMaxMembers] = useState(4);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ✅ Custom role state
  const [customRole, setCustomRole] = useState('');
  const [showAddRole, setShowAddRole] = useState(false);

  const availableRoles = [
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'UI/UX Designer',
    'ML Engineer',
    'Mobile Developer',
    'DevOps Engineer',
    'Product Manager',
    'Data Scientist',
  ];

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) return;
    
    setLoading(true);
    // Subscribe to real-time team updates
    const unsubscribe = onSnapshot(doc(db, 'teams', teamId), (snapshot) => {
      if (!snapshot.exists()) {
        toast.error('Team not found');
        onBack();
        return;
      }

      const teamData = { id: snapshot.id, ...snapshot.data() } as Team;

      if (teamData.leaderId !== user.uid) {
        toast.error('Only team leader can edit the team');
        onBack();
        return;
      }

      // Update state with latest data
      setTeam(teamData);
      setTeamName(teamData.name);
      setDescription(teamData.description);
      setHackathon(teamData.hackathon || '');
      setCity(teamData.city ?? '');
      setRolesNeeded(teamData.rolesNeeded || []);
      setMaxMembers(teamData.maxMembers);
      
      setLoading(false);
    }, (error) => {
      console.error('Error loading team:', error);
      toast.error('Failed to load team');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamId, user, onBack]);

  const toggleRole = (role: string) => {
    setRolesNeeded(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  // ✅ Add custom role handler
  const addCustomRole = () => {
    const role = customRole.trim();
    if (!role) return;

    // Add to rolesNeeded if not already there
    if (!rolesNeeded.includes(role)) {
      setRolesNeeded(prev => [...prev, role]);
    }

    setCustomRole('');
    setShowAddRole(false);
  };

  // ✅ Get all roles to display (predefined + custom selected)
  const displayRoles = [
    ...availableRoles,
    ...rolesNeeded.filter(role => !availableRoles.includes(role))
  ];

  const handleSave = async () => {
    if (!user || !isFirebaseConfigured() || !team) return;
    
    if (!city.trim()) {
      toast.error('Please enter a city');
      return;
    }
    
    if (!teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }
    
    if (!description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setSaving(true);
    
    const updatedData = {
      name: teamName.trim(),
      description: description.trim(),
      city: city.trim(),
      hackathon: hackathon.trim() || null,
      rolesNeeded,
      maxMembers
    };
    
    // ✅ Optimistically update parent immediately
    onTeamUpdated?.({ id: teamId, ...updatedData });
    
    try {
      await updateTeam(teamId, updatedData);
      toast.success('Team updated successfully!');
      onBack();
    } catch (error: any) {
      console.error('Error updating team:', error);
      toast.error(error.message || 'Failed to update team');
      // Note: we don't rollback the optimistic update since the subscription will fix it
    }
    
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-base p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Teams
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Edit Team</h1>
            <p className="text-muted-foreground">Update your team details</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="card-base p-6 space-y-6">
        {/* Team Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Team Name *
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g., AI Innovators"
            className="input-field"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Project Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your project idea and what makes it unique..."
            className="input-field min-h-[120px] resize-none"
          />
        </div>

        {/* Hackathon */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Hackathon (Optional)
          </label>
          <input
            type="text"
            value={hackathon}
            onChange={(e) => setHackathon(e.target.value)}
            placeholder="e.g., HackMIT 2024"
            className="input-field"
          />
        </div>

        {/* City */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            City *
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g., Mumbai, Bangalore, Delhi"
            className="input-field"
          />
        </div>

        {/* Max Team Size */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Maximum Team Size *
          </label>
          <select
            value={maxMembers}
            onChange={(e) => setMaxMembers(Number(e.target.value))}
            className="input-field"
          >
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
              <option key={size} value={size}>{size} members</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Current members: {team.members.length}
          </p>
        </div>

        {/* Roles Needed - ✅ UPDATED WITH CUSTOM ROLE SUPPORT */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Roles You're Looking For
          </label>
          <div className="flex flex-wrap gap-2">
            {displayRoles.map((role) => (
              <button
                key={role}
                onClick={() => toggleRole(role)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  rolesNeeded.includes(role)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {rolesNeeded.includes(role) ? (
                  <X className="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                {role}
              </button>
            ))}

            {/* ✅ Add Custom Role Button */}
            <button
              type="button"
              onClick={() => setShowAddRole(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-dashed border-border hover:bg-secondary transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add role
            </button>
          </div>

          {/* ✅ Custom Role Input */}
          {showAddRole && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="Enter custom role"
                className="flex-1 input-field"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomRole();
                  }
                  if (e.key === 'Escape') {
                    setShowAddRole(false);
                    setCustomRole('');
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={addCustomRole}
                className="btn-primary"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddRole(false);
                  setCustomRole('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* AI Suggestion */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-primary">AI Tip</p>
              <p className="text-sm text-muted-foreground mt-1">
                Keep your team details updated to attract the right teammates!
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button onClick={onBack} className="btn-secondary">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving || !teamName.trim() || !description.trim() || !city.trim()}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTeam;
