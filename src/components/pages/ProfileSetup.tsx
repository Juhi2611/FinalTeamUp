import { useState, useEffect } from 'react';
import { User, GraduationCap, Briefcase, Code, Save, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createProfile, updateProfile, UserProfile, invalidateSkillVerification, getSkillVerification } from '@/services/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { toast } from 'sonner';
import { isValidUsername, getUsernameError } from '@/utils/username';
import { isUsernameAvailable, generateUniqueUsername } from '@/services/firestore';

interface ProfileSetupProps {
  existingProfile?: UserProfile | null;
  onComplete: () => void;
  onOpenVerification?: () => void;
}

const yearOptions = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'] as const;
const roleOptions = [
  'Frontend Developer',
  'Backend Developer',
  'UI/UX Designer',
  'Tester',
  'Full Stack Developer',
  'ML Engineer',
  'Mobile Developer',
  'DevOps Engineer',
  'Product Manager'
] as const;
const proficiencyOptions = ['Beginner', 'Intermediate', 'Pro'] as const;

const ProfileSetup = ({ existingProfile, onComplete, onOpenVerification }: ProfileSetupProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
 const [formData, setFormData] = useState<{
  fullName: string;
  username: string;
  college: string;
  yearOfStudy: string;
  primaryRole: string; // 👈 THIS FIXES EVERYTHING
  bio: string;
  skills: { name: string; proficiency: 'Beginner' | 'Intermediate' | 'Pro' }[];
}>({
  fullName: existingProfile?.fullName || '',
  username: existingProfile?.username || '',
  college: existingProfile?.college || '',
  yearOfStudy: existingProfile?.yearOfStudy || 'First Year',
  primaryRole: existingProfile?.primaryRole || 'Frontend Developer',
  bio: existingProfile?.bio || '',
  skills: existingProfile?.skills || [{ name: '', proficiency: 'Beginner' }]
});


  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [customRole, setCustomRole] = useState('');
  const [showAddRole, setShowAddRole] = useState(false);


  const validateUsername = async (username: string) => {
    setCheckingUsername(true);

    const formatError = getUsernameError(username);
    if (formatError) {
      setUsernameError(formatError);
      setCheckingUsername(false);
      return false;
    }

    const available = await isUsernameAvailable(username, user?.uid);
    if (!available) {
      setUsernameError('Username is already taken');
      setCheckingUsername(false);
      return false;
    }

    setUsernameError(null);
    setCheckingUsername(false);
    return true;
  };

  useEffect(() => {
    const generateIfNeeded = async () => {
      if (!existingProfile && formData.fullName && !formData.username) {
        const generated = await generateUniqueUsername(formData.fullName);
        setFormData(prev => ({ ...prev, username: generated }));
      }
    };
    generateIfNeeded();
  }, [formData.fullName]);

  const addSkill = () => {
    setFormData(prev => ({
      ...prev,
      skills: [...prev.skills, { name: '', proficiency: 'Beginner' as const }]
    }));
  };

  const updateSkill = (index: number, field: 'name' | 'proficiency', value: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.map((skill, i) => 
        i === index ? { ...skill, [field]: value } : skill
      )
    }));
  };

  const removeSkill = (index: number) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  };

  const addCustomRole = () => {
  const role = customRole.trim();
  if (!role) return;

  setFormData(prev => ({
    ...prev,
    primaryRole: role
  }));

  setCustomRole('');
  setShowAddRole(false);
};
  const renderedRoles = [
    ...roleOptions,
    ...(formData.primaryRole && !roleOptions.includes(formData.primaryRole as (typeof roleOptions)[number])
      ? [formData.primaryRole]
      : [])
  ];

  /**
   * Check if skills have changed compared to existing profile
   * This is crucial for invalidating verification
   */
  const haveSkillsChanged = (): boolean => {
    if (!existingProfile) return false;
    
    const currentSkills = formData.skills
      .filter(s => s.name.trim())
      .map(s => s.name.toLowerCase())
      .sort();
    
    const existingSkills = (existingProfile.skills || [])
      .map(s => s.name.toLowerCase())
      .sort();

    if (currentSkills.length !== existingSkills.length) return true;
    
    return !currentSkills.every((skill, index) => skill === existingSkills[index]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1️⃣ Full name validation
    if (!formData.fullName.trim()) {
      setError('Full name is required');
      return;
    }

    // 2️⃣ Username validation (ADD HERE 👇)
    if (!formData.username.trim()) {
      setError('Username is required');
      return;
    }

    const usernameValid = await validateUsername(formData.username);
    if (!usernameValid) {
      setError('Please fix username errors');
      return;
    }

    // 3️⃣ Skills validation
    const validSkills = formData.skills.filter(s => s.name.trim());

    // 4️⃣ Only now start loading
    setLoading(true);
    
    if (isFirebaseConfigured() && user) {
      try {
        const profileData = {
          email: user.email || '',
          fullName: formData.fullName,
          username: formData.username.toLowerCase(),
          college: formData.college,
          yearOfStudy: formData.yearOfStudy as UserProfile['yearOfStudy'],
          primaryRole: formData.primaryRole as UserProfile['primaryRole'],
          bio: formData.bio,
          skills: validSkills as UserProfile['skills'],
          avatar: existingProfile?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formData.fullName)}`
        };

        // CRITICAL: Check if skills changed and invalidate verification if needed
        if (existingProfile) {
          const skillsChanged = haveSkillsChanged();
          
          await updateProfile(user.uid, profileData);
          
          // Invalidate verification if skills changed
          if (skillsChanged) {
            const currentVerification = await getSkillVerification(user.uid);
            if (currentVerification && currentVerification.status === 'verified') {
              await invalidateSkillVerification(user.uid, 'profile_edited');
              toast.info('Your skill verification was removed because you edited your skills. Please verify again.', {
                duration: 8000,
                action: {
                  label: 'Verify Now',
                  onClick: () => {
                    onOpenVerification?.();
                  }
                }
              });
            }
          }
        } else {
          await createProfile(user.uid, profileData);
        }
      } catch (err) { 
        
        setError('Failed to save profile. Please try again.');
        setLoading(false);
        return;
      }
    }
    
    setLoading(false);
    
    // Show verification toast for new profiles
    if (!existingProfile) {
      toast('Verify your skills to increase credibility.', {
        duration: 10000,
        action: {
          label: 'Verify',
          onClick: () => {
            onOpenVerification?.();
          }
        }
      });
    }
    
    onComplete();
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="card-base p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-primary/10">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-foreground">
                {existingProfile ? 'Edit Profile' : 'Complete Your Profile'}
              </h1>
              <p className="text-muted-foreground">Tell us about yourself</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Skill Edit Warning */}
            {existingProfile && haveSkillsChanged() && (
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Skills Changed</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    If you have verified skills, changing them will remove your verification badge. You'll need to verify again.
                  </p>
                </div>
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <h2 className="section-title flex items-center gap-2">
                <User className="w-4 h-4" />
                Basic Information
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="John Doe"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Username *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>

                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => {
                      const value = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9._-]/g, '');
                      setFormData(prev => ({ ...prev, username: value }));
                      setUsernameError(null);
                    }}
                    onBlur={() => formData.username && validateUsername(formData.username)}
                    placeholder="johndoe"
                    className={`input-field pl-8 ${usernameError ? 'border-destructive' : ''}`}
                    required
                  />

                  {checkingUsername && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {usernameError && (
                  <p className="text-xs text-destructive mt-1">{usernameError}</p>
                )}

                <p className="text-xs text-muted-foreground mt-1">
                  Letters, numbers, dots, underscores, and hyphens only
                </p>
              </div>


              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Short Bio
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself in a few sentences..."
                  className="input-field min-h-[80px] resize-none"
                />
              </div>
            </div>

            {/* Education */}
            <div className="space-y-4">
              <h2 className="section-title flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Education
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  College / University
                </label>
                <input
                  type="text"
                  value={formData.college}
                  onChange={(e) => setFormData(prev => ({ ...prev, college: e.target.value }))}
                  placeholder="Stanford University"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Year of Study
                </label>
                <select
                  value={formData.yearOfStudy}
                  onChange={(e) => setFormData(prev => ({ ...prev, yearOfStudy: e.target.value as typeof yearOptions[number] }))}
                  className="input-field"
                >
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Role */}
            <div className="space-y-4">
              <h2 className="section-title flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Primary Role
              </h2>
              
              <div className="flex flex-wrap gap-2">
                {renderedRoles.map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() =>
                      setFormData(prev => ({ ...prev, primaryRole: role }))
                    }
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      formData.primaryRole === role
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {role}
                  </button>
                ))}

                {/* Add custom role button */}
                <button
                  type="button"
                  onClick={() => setShowAddRole(true)}
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-dashed border-border hover:bg-secondary"
                >
                  + Add role
                </button>
              </div>
                {showAddRole && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      placeholder="Enter custom role"
                      className="flex-1 input-field"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addCustomRole();
                      }}
                    />
                    <button
                      type="button"
                      onClick={addCustomRole}
                      className="btn-primary"
                    >
                      Add
                    </button>
                  </div>
                )}

            </div>

            {/* Skills */}
            <div className="space-y-4">
              <h2 className="section-title flex items-center gap-2">
                <Code className="w-4 h-4" />
                Skills
              </h2>
              
              {formData.skills.map((skill, index) => (
                <div key={index} className="flex gap-3">
                  <input
                    type="text"
                    value={skill.name}
                    onChange={(e) => updateSkill(index, 'name', e.target.value)}
                    placeholder="e.g., React, Python..."
                    className="input-field flex-1"
                  />
                  <select
                    value={skill.proficiency}
                    onChange={(e) => updateSkill(index, 'proficiency', e.target.value)}
                    className="input-field w-32"
                  >
                    {proficiencyOptions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  {formData.skills.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSkill(index)}
                      className="btn-ghost text-destructive"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              
              <button
                type="button"
                onClick={addSkill}
                className="btn-outline text-sm"
              >
                + Add Skill
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {existingProfile ? 'Update Profile' : 'Complete Setup'}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
