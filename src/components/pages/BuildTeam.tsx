import { useState } from 'react';
import { Users, Plus, X, Sparkles, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createTeam, getProfile, createFeedPost } from '@/services/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { toast } from 'sonner';
import DemoLockModal from "@/components/DemoLockModal";

interface BuildTeamProps {
  onNavigate: (page: string) => void;
  openAuth: () => void;   // 👈 ADD THIS
}

const BuildTeam = ({ onNavigate, openAuth }: BuildTeamProps) => {
  const { isDemoUser } = useAuth();
  const [showDemoLock, setShowDemoLock] = useState(false);
  const { user } = useAuth();
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [hackathon, setHackathon] = useState('');
  const [rolesNeeded, setRolesNeeded] = useState<string[]>([]);
  const [maxMembers, setMaxMembers] = useState(4);
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState('');
  
  
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

  const handlePost = async () => {

    // 🚫 GUEST MODE BLOCK
    if (isDemoUser) {
      setShowDemoLock(true);
      return;
    }

    if (!user || !isFirebaseConfigured()) return;

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

    setLoading(true);

    try {
      await createTeam({
        name: teamName,
        description,
        city: city.trim(),
        hackathon: hackathon.trim() || null,
        leaderId: user.uid,
        status: 'forming',
        rolesNeeded,
        maxMembers
      });

      toast.success('Team created successfully!');
      onNavigate('teams');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create team');
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-base p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Build Your Team</h1>
            <p className="text-muted-foreground">Create a team and find the perfect teammates</p>
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
            You (the leader) count as 1 member
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
                A well-balanced team typically needs a mix of technical and design skills. 
                Consider adding roles that complement your own expertise!
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button onClick={() => onNavigate('feed')} className="btn-secondary">
            Cancel
          </button>
          <button 
            onClick={handlePost} 
            disabled={loading || !teamName.trim() || !description.trim() || !city.trim()}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Create Team
          </button>
        </div>
      </div>
      <DemoLockModal
  open={showDemoLock}
  onClose={() => setShowDemoLock(false)}
  onSignup={() => {
    setShowDemoLock(false);
    openAuth();
  }}
/>
    </div>
  );
};

export default BuildTeam;
