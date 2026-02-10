import { useState, useEffect } from 'react';
import PitchModal from '../PitchModal';
import { MapPin, Calendar, Award, Quote, Sparkles, Shield, ExternalLink, Loader2, Edit, Trash2, PenSquare, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getProfile, 
  subscribeToUserPosts, 
  updatePost, 
  deletePost, 
  UserProfile, 
  FeedPost,
  getSkillVerification,
  subscribeToSkillVerification,
  SkillVerification
} from '@/services/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import Linkify from 'linkify-react';
import { getSkillClass } from '@/data/mockData';
import { Timestamp } from 'firebase/firestore';
import EditPostModal from '../EditPostModal';
import { toast } from 'sonner';
import BlockReportModal from '../BlockReportModal';
import { useBlocks } from '@/contexts/BlockContext';
import { Flag } from 'lucide-react';
import { Camera } from 'lucide-react';
import { updateProfile, subscribeToProfile } from '@/services/firestore';
import { uploadProfilePicture } from '@/services/firestore';
import { deleteUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { deleteUserCompletely } from '@/services/firestore';
import { unlink } from 'firebase/auth';
import { Github } from 'lucide-react';

interface ProfileProps {
  userId?: string;
  isOwnProfile?: boolean;
  userProfile?: UserProfile | null;
  onEditProfile?: () => void;
  onOpenVerification?: () => void;
  onMessage?: (userId: string) => void;
  onProfileUpdated?: (profile: UserProfile) => void; // ✅ ADD
}

const Profile = ({ userId, isOwnProfile = true, userProfile: passedProfile, onEditProfile, onOpenVerification, onMessage, onProfileUpdated }: ProfileProps) => {
  const { user } = useAuth();
  const [showBlockReportModal, setShowBlockReportModal] = useState(false);
  const { isHidden, refreshBlocks } = useBlocks();
  const [profile, setProfile] = useState<UserProfile | null>(passedProfile || null);
  const [loading, setLoading] = useState(!passedProfile);
  const [myPosts, setMyPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [showPitchModal, setShowPitchModal] = useState(false);

  
  // Skill verification state
  const [skillVerification, setSkillVerification] = useState<SkillVerification | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(true);

  const targetUserId = userId || user?.uid;

  useEffect(() => {
  if (!targetUserId) return;

  const unsubscribe = subscribeToProfile(targetUserId, (updatedProfile) => {
    setProfile(updatedProfile);
    setLoading(false);
  });

  return () => unsubscribe();
}, [targetUserId]);

  // Subscribe to user's posts
  useEffect(() => {
    if (!isFirebaseConfigured() || !targetUserId) {
      setPostsLoading(false);
      return;
    }

    const unsubscribe = subscribeToUserPosts(targetUserId, (posts) => {
      setMyPosts(posts);
      setPostsLoading(false);
    });

    return () => unsubscribe();
  }, [targetUserId]);

  // Subscribe to skill verification
  useEffect(() => {
    if (!isFirebaseConfigured() || !targetUserId) {
      setVerificationLoading(false);
      return;
    }

    const unsubscribe = subscribeToSkillVerification(targetUserId, (verification) => {
      setSkillVerification(verification);
      setVerificationLoading(false);
    });

    return () => unsubscribe();
  }, [targetUserId]);

  const handleEditPost = async (
    postId: string,
    data: {
      title: string;
      description: string;
      tags: string[];
      image?: File | null;
      removeImage?: boolean;
    }
  ) => {
    updatePost(postId, user.uid, data);
    toast.success('Post updated successfully!');
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }
    
    setDeletingPostId(postId);
    try {
      await deletePost(postId);
      toast.success('Post deleted successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete post');
    }
    setDeletingPostId(null);
  };

const handleDeleteProfile = async () => {
  const confirmText = prompt(
    "This will permanently delete your account.\nType DELETE to continue."
  );

  if (confirmText !== "DELETE") {
    toast("Deletion cancelled");
    return;
  }

  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No authenticated user");

    await deleteUserCompletely(currentUser.uid);
    await deleteUser(currentUser);

    toast.success("Account deleted successfully");
    window.location.href = "/";
  } catch (err: any) {
    console.error(err);
    toast.error("Failed to delete account");
  }
};

const isGitHubLinked = auth.currentUser?.providerData.some(
  p => p.providerId === 'github.com'
);

const handleUnlinkGitHub = async () => {
  if (!auth.currentUser) return;

  try {
    await unlink(auth.currentUser, 'github.com');
    toast.success('GitHub disconnected successfully');
  } catch (err: any) {
    console.error(err);
    toast.error(err.message || 'Failed to unlink GitHub');
  }
};

const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || !user) return;

    const file = e.target.files[0];

    try {
      const avatarUrl = await uploadProfilePicture(user.uid, file);

      await updateProfile(user.uid, { avatar: avatarUrl });

      // 🔑 FETCH FRESH PROFILE & NOTIFY PARENT
      const updatedProfile = await getProfile(user.uid);
      if (updatedProfile) {
        onProfileUpdated?.(updatedProfile);
      }

      toast.success('Profile picture updated');
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Upload failed');
    }
  };
  const formatTimestamp = (timestamp: Timestamp | null): string => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card-base p-12 text-center">
        <p className="text-sm sm:text-base text-muted-foreground">Profile not found</p>
      </div>
    );
  }

  // Check if user has verified skills
  const totalProfileSkills = profile.skills?.length || 0;
const verifiedSkillsCount = skillVerification?.verifiedSkills.length || 0;

const hasVerifiedSkills =
  skillVerification?.status === 'verified' &&
  totalProfileSkills > 0 &&
  verifiedSkillsCount === totalProfileSkills;

  const languageUsage =
    skillVerification?.stats?.languageUsage ?? [];

  const getSkillLevel = (percent: number) => {
    if (percent >= 80) return { label: 'Expert', color: 'text-emerald-600' };
    if (percent >= 60) return { label: 'Advanced', color: 'text-teal-600' };
    if (percent >= 40) return { label: 'Intermediate', color: 'text-amber-600' };
    return { label: 'Beginner', color: 'text-orange-500' };
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="card-base overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-primary to-primary/70" />
        <div className="px-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between -mt-1 gap-4">
            <div className="flex items-end gap-4">
              <div className="relative">
  <img
    src={
      profile.avatar
        ? `${profile.avatar}?t=${Date.now()}`
        : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
            profile.fullName || 'User'
          )}`
    }
    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl sm:rounded-full object-cover border-4 border-card cursor-pointer"
    onClick={() =>
      isOwnProfile &&
      document.getElementById('avatarInput')?.click()
    }
  />

  {/* Camera Icon */}
  {isOwnProfile && (
    <button
      onClick={() =>
        document.getElementById('avatarInput')?.click()
      }
      className="absolute bottom-1 right-1 bg-white p-1.5 rounded-full shadow hover:bg-gray-100 transition"
    >
      <Camera className="w-4 h-4 text-gray-700" />
    </button>
  )}
</div>

{isOwnProfile && (
  <input
    id="avatarInput"
    type="file"
    accept="image/*"
    className="hidden"
    onChange={handleAvatarChange}
  />
)}
              <div className="mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground">{profile.fullName}</h1>
                  {profile.username && (
                    <span className="text-xs sm:text-sm text-sm sm:text-base text-muted-foreground">
                      @{profile.username}
                    </span>
                  )}

                  
                  {(hasVerifiedSkills || profile.teamId) && (
                  <div className="flex items-center gap-2">
                    {hasVerifiedSkills && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1CB0A3]/70 border border-[#1CB0A3]/40 backdrop-blur-sm">
                        <ShieldCheck className="w-4 h-4 text-white" />
                        <span className="text-xs font-medium text-white">
                          Skills Verified
                        </span>
                      </span>
                    )}

                    {profile.teamId && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1CB0A3]/70 border border-[#1CB0A3]/40 backdrop-blur-sm">
                        <Shield className="w-4 h-4 text-white" />
                        <span className="text-xs font-medium text-white">
                          In a Team
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
                <p className="text-sm sm:text-base text-muted-foreground">{profile.primaryRole}</p>
                {profile.college && (
                  <p className="text-sm text-sm sm:text-base text-muted-foreground">{profile.college} • {profile.yearOfStudy}</p>
                )}
                {profile.city && (
                  <div className="flex items-center gap-1 text-sm text-sm sm:text-base text-muted-foreground mt-1">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.city}</span>
                  </div>
                )}
              </div>
            </div>
            {isOwnProfile && onEditProfile && (
              <button onClick={onEditProfile} className="btn-secondary flex items-center gap-2">
                <Edit className="w-4 h-4" />
                Edit Profile
              </button>
            )}
            {!isOwnProfile && (
            <div className="flex items-center gap-2">
              <button className="btn-primary" onClick={() => setShowPitchModal(true)}>
                Pitch Your Team
              </button>

              <button onClick={() => onMessage?.(targetUserId!)} className="btn-secondary text-sm">
                Message
              </button>

              <button
                onClick={() => setShowBlockReportModal(true)}
                className="btn-secondary text-sm flex items-center gap-1.5 text-destructive"
              >
                <Flag className="w-4 h-4" />
                Block / Report
              </button>
            </div>
          )}

          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bio */}
          {profile.bio && (
            <div className="card-base p-6">
              <h2 className="section-title mb-3">About</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{profile.bio && (
                <div className="card-base p-6">
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    <Linkify
                      options={{
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        className: 'text-primary underline'
                      }}
                    >
                      {profile.bio}
                    </Linkify>
                  </p>
                </div>
              )}
              </p>
            </div>
          )}

          {/* Skills with Verification Indicator */}
          {profile.skills && profile.skills.length > 0 && (
            <div className="card-base p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title">Skills</h2>
                {hasVerifiedSkills && (
                  <span className="text-xs text-skill-mobile flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {verifiedSkillsCount} verified
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, idx) => {
                  const normalize = (s: string) =>
                    s.toLowerCase().replace(/\(.*?\)/g, '').trim();

                  const isVerified = skillVerification?.verifiedSkills.some(
                    vs => normalize(vs) === normalize(skill.name)
                  );
                  
                  return (
                    <span 
                      key={idx} 
                      className={`skill-tag text-sm ${getSkillClass(skill.name)} ${isVerified ? 'ring-2 ring-skill-mobile' : ''}`}
                    >
                      {isVerified && <ShieldCheck className="w-3 h-3 inline mr-1" />}
                      {skill.name}
                      <span className="ml-1 opacity-70">({skill.proficiency})</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* My Posts Section */}
          <div className="card-base p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title flex items-center gap-2">
                <PenSquare className="w-4 h-4" />
                {isOwnProfile ? 'My Posts' : 'Posts'}
              </h2>
              <span className="text-xs sm:text-sm text-sm sm:text-base text-muted-foreground">
                {myPosts.length} {myPosts.length === 1 ? 'post' : 'posts'}
              </span>
            </div>
            
            {postsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : myPosts.length === 0 ? (
              <div className="text-center py-8">
                <PenSquare className="w-10 h-10 text-sm sm:text-base text-muted-foreground mx-auto mb-3" />
                <p className="text-sm sm:text-base text-muted-foreground">
                  {isOwnProfile ? "You haven't created any posts yet" : "No posts yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myPosts.map((post) => (
                  <div key={post.id} className="p-4 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground mb-1">{post.title}</h3>
                        <p className="text-sm text-sm sm:text-base text-muted-foreground mb-2 line-clamp-2">{post.description}</p>
                        
                        {/* Tags */}
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {post.tags.map((tag, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-sm sm:text-base text-muted-foreground">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <p className="text-xs text-sm sm:text-base text-muted-foreground">
                          {formatTimestamp(post.createdAt)}
                        </p>
                      </div>
                      
                      {/* Edit/Delete buttons - only for own posts */}
                      {isOwnProfile && user?.uid === post.authorId && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setEditingPost(post)}
                            className="p-2 rounded-lg hover:bg-secondary transition-colors text-sm sm:text-base text-muted-foreground hover:text-foreground"
                            title="Edit post"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            disabled={deletingPostId === post.id}
                            className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-sm sm:text-base text-muted-foreground hover:text-destructive"
                            title="Delete post"
                          >
                            {deletingPostId === post.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quote */}
          
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="card-base p-6">
            <h2 className="section-title mb-4">Status</h2>

            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              profile.teamId || profile.isTeamLeader
                ? 'bg-muted text-sm sm:text-base text-muted-foreground'
                : 'bg-skill-mobile/10 text-skill-mobile'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                profile.teamId || profile.isTeamLeader
                  ? 'bg-muted-foreground'
                  : 'bg-skill-mobile'
              }`} />

              {profile.isTeamLeader
                ? 'Team Leader'
                : profile.teamId
                ? 'In a Team'
                : 'Available'}
            </div>
          </div>

          {/* Skill Verification */}
          <div className="card-base p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="section-title text-sm">Skill Verification</h2>
            </div>
            
            {verificationLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : hasVerifiedSkills ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-skill-mobile/10 border border-skill-mobile/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-skill-mobile" />
                    <p className="text-sm font-medium text-skill-mobile">Skills Verified</p>
                  </div>
                  <p className="text-xs text-sm sm:text-base text-muted-foreground mb-2">
                    Verified on {skillVerification.verifiedAt?.toDate().toLocaleDateString()}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {skillVerification.verifiedSkills.slice(0, 5).map((skill, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-xs bg-skill-mobile/20 text-skill-mobile">
                        {skill}
                      </span>
                    ))}
                    {skillVerification.verifiedSkills.length > 5 && (
                      <span className="text-xs text-sm sm:text-base text-muted-foreground px-2">
                        +{skillVerification.verifiedSkills.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                {isOwnProfile && isGitHubLinked && (
                  <button
                    onClick={handleUnlinkGitHub}
                    className="w-full mb-3 p-2 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition text-sm"
                  >
                    Unlink GitHub Account
                  </button>
                )}
                
                {/* Verification Sources */}
                <div className="text-xs text-sm sm:text-base text-muted-foreground space-y-1">
                  {skillVerification.sources.github && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-skill-mobile" />
                      <span>GitHub verified</span>
                    </div>
                  )}
                  {skillVerification.sources.certificates && skillVerification.sources.certificates.length > 0 && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-skill-mobile" />
                      <span>{skillVerification.sources.certificates.length} certificate(s) verified</span>
                    </div>
                  )}
                </div>
              </div>
            ) : isOwnProfile ? (
              <button
                onClick={onOpenVerification}
                className="w-full p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 hover:from-primary/20 hover:to-accent/20 transition-all text-left"
              >
                <p className="text-sm font-medium text-primary mb-1">Verify Your Skills</p>
                <p className="text-xs text-sm sm:text-base text-muted-foreground">
                  Increase credibility with GitHub or certificates
                </p>
              </button>
            ) : (
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <p className="text-sm text-sm sm:text-base text-muted-foreground">
                  Skills not verified yet
                </p>
              </div>
            )}
          </div>

          {/* GitHub Stats */}
          {skillVerification?.sources?.github &&
            skillVerification?.stats?.languageUsage?.length > 0 && (
            <div className="card-base p-6">
              <div className="flex items-center gap-2 mb-4">
                <Github className="w-4 h-4 text-primary" />
                <h2 className="section-title text-sm">GitHub Stats</h2>
              </div>

              {/* Metrics */}
              <div className="space-y-2">
                <p className="text-xs text-sm sm:text-base text-muted-foreground">
                  Language Proficiency (based on GitHub usage)
                </p>

                {languageUsage.map(({ language, percent }) => {
                  const level = getSkillLevel(percent);

                  return (
                    <div key={language}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{language}</span>
                        <span className={`${level.color} font-semibold`}>
                          {percent}% · {level.label}
                        </span>
                      </div>

                      <div className="h-1.5 rounded-full bg-secondary">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* GitHub link */}
              <a
                href={skillVerification.sources.github.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                @{skillVerification.sources.github.username}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Edit Post Modal */}
      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSubmit={handleEditPost}
        />
      )}
      {showPitchModal && !isOwnProfile && (
  <PitchModal
    type="pitch"
    recipientName={profile.fullName}
    recipientId={targetUserId}
    onClose={() => setShowPitchModal(false)}
    onSend={async (message) => {
      console.log('Pitch sent:', message);
      // TODO: save pitch / send notification / message
    }}
  />
)}
{showBlockReportModal && user && profile && (
  <BlockReportModal
    targetUserId={profile.id}
    targetUserName={profile.fullName || 'User'}
    currentUserId={user.uid}
    onClose={() => setShowBlockReportModal(false)}
    onBlockComplete={refreshBlocks}
  />
)}
{isOwnProfile && (
  <div className="card-base p-6 border border-destructive/30">
    <h2 className="section-title text-destructive mb-2">
      Danger Zone
    </h2>

    <button
      onClick={handleDeleteProfile}
      className="w-full mt-3 p-3 rounded-lg bg-destructive text-white"
    >
      Delete Profile Permanently
    </button>

    <p className="text-xs text-sm sm:text-base text-muted-foreground mt-2">
      This action cannot be undone.
    </p>
  </div>
)}

    </div>
  );
};

export default Profile;
