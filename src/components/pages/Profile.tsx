import { useState, useEffect, useMemo } from 'react';
import PitchModal from '../PitchModal';
import IdentityVerificationModal from '../IdentityVerificationModal';
import { MapPin, Calendar, Award, Quote, Sparkles, Shield, ExternalLink, Loader2, Edit, Trash2, PenSquare, CheckCircle2, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { Users } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { ChevronUp } from 'lucide-react';
import Linkify from 'linkify-react';
import { getSkillClass } from '@/data/mockData';
import { Ban } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import EditPostModal from '../EditPostModal';
import { toast } from 'sonner';
import BlockReportModal from '../BlockReportModal';
import { unblockUser } from '@/services/blockReportService';
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
import StarRating from '@/components/StarRating';
import { useActivityHeatmap } from '@/hooks/useActivityHeatmap';
import { cn } from '@/lib/utils';
import { getCityById } from '@/utils/cityData';
import { useInstitutionName } from '@/utils/useInstitutionName';
import CertificationModal from "@/components/certification/CertificationModal";

interface ProfileProps {
  userId?: string;
  isOwnProfile?: boolean;
  userProfile?: UserProfile | null;
  onEditProfile?: () => void;
  onOpenVerification?: () => void;
  onMessage?: (userId: string) => void;
  onProfileUpdated?: (profile: UserProfile) => void;
  openAuth: () => void;
}

/* ─── Seed-based cover pattern generator ─── */
function generateCoverPattern(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);

  const shapes: string[] = [];
  const colors = [
    'hsl(174 72% 40% / 0.12)',
    'hsl(180 60% 48% / 0.10)',
    'hsl(190 80% 50% / 0.08)',
    'hsl(174 72% 40% / 0.06)',
    'hsl(25 95% 53% / 0.06)',
  ];

  for (let i = 0; i < 12; i++) {
    const x = ((abs * (i + 7) * 13) % 1000) / 10;
    const y = ((abs * (i + 3) * 17) % 1000) / 10;
    const r = 8 + ((abs * (i + 1) * 11) % 30);
    const color = colors[i % colors.length];
    shapes.push(`<circle cx="${x}%" cy="${y}%" r="${r}" fill="${color}" />`);
  }
  for (let i = 0; i < 20; i++) {
    const x = ((abs * (i + 11) * 23) % 1000) / 10;
    const y = ((abs * (i + 5) * 29) % 1000) / 10;
    const r = 2 + ((abs * (i + 2) * 7) % 4);
    shapes.push(`<circle cx="${x}%" cy="${y}%" r="${r}" fill="hsl(174 72% 40% / 0.15)" />`);
  }
  for (let i = 0; i < 6; i++) {
    const x1 = ((abs * (i + 9) * 19) % 1000) / 10;
    const y1 = ((abs * (i + 4) * 31) % 1000) / 10;
    const x2 = x1 + 10 + ((abs * (i + 6) * 13) % 20);
    const y2 = y1 + 5 + ((abs * (i + 8) * 7) % 15);
    shapes.push(`<line x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%" stroke="hsl(174 72% 40% / 0.08)" stroke-width="1.5" />`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">${shapes.join('')}</svg>`;
}

type ProfileTab = 'posts' | 'skills' | 'activity';

const Profile = ({ userId, isOwnProfile = true, userProfile: passedProfile, onEditProfile, onOpenVerification, onMessage, onProfileUpdated }: ProfileProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showBlockReportModal, setShowBlockReportModal] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);
  const { isHidden, isBlockedByMe, wasBlockedByThem, refreshBlocks } = useBlocks();
  const [profile, setProfile] = useState<UserProfile | null>(passedProfile || null);
  const [loading, setLoading] = useState(!passedProfile);
  const [myPosts, setMyPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showCertificationModal, setShowCertificationModal] = useState(false);
  const [leaderRating, setLeaderRating] = useState(0);

  const activeTab: ProfileTab = (searchParams.get('tab') as ProfileTab) || 'posts';
  const setActiveTab = (tab: ProfileTab) => setSearchParams({ tab }, { replace: true });

  const [skillVerification, setSkillVerification] = useState<SkillVerification | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(true);

  const targetUserId = userId || user?.uid;
  const isBlockedUser = user && targetUserId ? isHidden(targetUserId) : false;
  const { cells: heatmapCells, loading: heatmapLoading } = useActivityHeatmap(targetUserId);
  const coverSvg = useMemo(() => { if (!targetUserId) return ''; return generateCoverPattern(targetUserId); }, [targetUserId]);

  // Resolve institution name and city display name
  const collegeName = useInstitutionName(profile?.college);

  useEffect(() => {
    if (!targetUserId) return;
    const unsubscribe = subscribeToProfile(targetUserId, (updatedProfile) => {
      setProfile(updatedProfile);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [targetUserId]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !targetUserId) { setPostsLoading(false); return; }
    const unsubscribe = subscribeToUserPosts(targetUserId, (posts) => { setMyPosts(posts); setPostsLoading(false); });
    return () => unsubscribe();
  }, [targetUserId]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !targetUserId) { setVerificationLoading(false); return; }
    const unsubscribe = subscribeToSkillVerification(targetUserId, (verification) => { setSkillVerification(verification); setVerificationLoading(false); });
    return () => unsubscribe();
  }, [targetUserId]);

  const handleEditPost = async (postId: string, data: { title: string; description: string; tags: string[]; image?: File | null; removeImage?: boolean }) => {
    updatePost(postId, user.uid, data);
    toast.success('Post updated successfully!');
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;
    setDeletingPostId(postId);
    try {
      await deletePost(postId);
      toast.success('Post deleted successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete post');
    }
    setDeletingPostId(null);
  };

  const getMonthLabels = () => {
    const labels = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (2 - i), 1);
      labels.push(d.toLocaleString('default', { month: 'short' }));
    }
    return labels;
  };

  const handleDeleteProfile = async () => {
    const confirmText = prompt("This will permanently delete your account.\nType DELETE to continue.");
    if (confirmText !== "DELETE") { toast("Deletion cancelled"); return; }
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

  const isGitHubLinked = auth.currentUser?.providerData.some(p => p.providerId === 'github.com');

  const handleUnlinkGitHub = async () => {
    if (!auth.currentUser) return;
    try {
      await unlink(auth.currentUser, 'github.com');
      toast.success('GitHub disconnected successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to unlink GitHub');
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !user) return;
    const file = e.target.files[0];
    try {
      const avatarUrl = await uploadProfilePicture(user.uid, file);
      await updateProfile(user.uid, { avatar: avatarUrl });
      const updatedProfile = await getProfile(user.uid);
      if (updatedProfile) onProfileUpdated?.(updatedProfile);
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error('Upload failed');
    }
  };

  const submitRating = async (profileId: string, rating: number) => {
    if (!user) return;
    try {
      await updateProfile(profileId, {
        averageRating: rating,
        totalRatings: (profile?.totalRatings || 0) + 1,
      });
      toast.success('Rating submitted successfully');
    } catch (error: any) {
      console.error('Failed to submit rating:', error);
      toast.error(error.message || 'Failed to submit rating');
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

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!profile) return (
    <div className="card-base p-12 text-center">
      <p className="text-sm text-muted-foreground">Profile not found</p>
    </div>
  );

  if (!isOwnProfile && targetUserId) {
    if (isBlockedByMe(targetUserId)) return (
      <div className="card-base p-12 text-center">
        <Ban className="w-16 h-16 text-destructive mx-auto mb-4 opacity-50" />
        <h3 className="font-display font-bold text-xl text-foreground mb-2">User Blocked</h3>
        <p className="text-muted-foreground mb-6">You have blocked this user. Unblock them to view their profile.</p>
        <button onClick={async () => {
          if (!user || !targetUserId) return;
          try {
            await unblockUser(user.uid, targetUserId);
            toast.success(`Unblocked ${profile?.fullName || 'user'}`);
            refreshBlocks();
            const updatedProfile = await getProfile(targetUserId);
            setProfile(updatedProfile);
          } catch (error: any) { toast.error(error.message || 'Failed to unblock'); }
        }} className="btn-secondary bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30">
          Unblock User
        </button>
      </div>
    );
    if (wasBlockedByThem(targetUserId)) return (
      <div className="card-base p-12 text-center">
        <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="font-display font-bold text-xl text-foreground mb-2">User Not Found</h3>
        <p className="text-muted-foreground">This profile is not available.</p>
      </div>
    );
  }

  const totalProfileSkills = profile.skills?.length || 0;
  const verifiedSkillsCount = skillVerification?.verifiedSkills.length || 0;
  const hasVerifiedSkills = (skillVerification?.status === 'verified' && verifiedSkillsCount > 0) || profile.isSkillVerified;
  const visiblePosts = showAllPosts ? myPosts : myPosts.slice(0, 2);
  const languageUsage = skillVerification?.stats?.languageUsage ?? [];

  const getSkillLevel = (percent: number) => {
    if (percent >= 80) return { label: 'Expert', color: 'text-emerald-600' };
    if (percent >= 60) return { label: 'Advanced', color: 'text-teal-600' };
    if (percent >= 40) return { label: 'Intermediate', color: 'text-amber-600' };
    return { label: 'Beginner', color: 'text-orange-500' };
  };

  const heatmapColors = ['bg-muted/60', 'bg-primary/20', 'bg-primary/40', 'bg-primary/60', 'bg-primary'];

  return (
    <div className="space-y-5">

      {/* ═══ Hero Cover + Identity — full-width card ═══ */}
      <div className="card-base overflow-hidden">
        {/* Cover pattern — taller, more visual */}
        <div
          className="relative h-44 sm:h-52 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: coverSvg.replace('viewBox="0 0 800 200"', 'viewBox="0 0 800 200" style="width:100%;height:100%"') }}
          style={{ background: 'hsl(var(--secondary))' }}
        />

        {/* Profile info row - overlapping cover */}
        <div className="px-6 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">

            {/* Avatar + name block */}
            <div id="tour-header-profile" className="flex items-end gap-4">
              <div className="relative z-10 flex-shrink-0">
                <img
                  src={
                    profile.avatar
                      ? `${profile.avatar}?t=${Date.now()}`
                      : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.fullName || 'User')}`
                  }
                  className="w-[120px] h-[120px] rounded-full object-cover border-4 border-card shadow-lg cursor-pointer -mt-3"
                  onClick={() => isOwnProfile && document.getElementById('avatarInput')?.click()}
                />
                {isOwnProfile && (
                  <button
                    onClick={() => document.getElementById('avatarInput')?.click()}
                    className="absolute bottom-1 right-1 bg-card p-1.5 rounded-full shadow-md hover:bg-secondary transition border border-border"
                  >
                    <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              {isOwnProfile && (
                <input id="avatarInput" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              )}

              <div className="mb-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground">{profile.fullName}</h1>
                  {(hasVerifiedSkills || profile.isProfileVerified || profile.teamId || (profile.teamIds && profile.teamIds.length > 0)) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {hasVerifiedSkills && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1CB0A3]/15 border border-[#1CB0A3]/30 text-[11px] font-medium text-[#1CB0A3]">
                          <ShieldCheck className="w-3 h-3" />
                          Skills Verified
                        </span>
                      )}
                      {profile.isProfileVerified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-[11px] font-medium text-blue-500">
                          <ShieldCheck className="w-3 h-3" />
                          Identity Verified
                        </span>
                      )}
                      {(profile.teamId || (profile.teamIds && profile.teamIds.length > 0)) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary">
                          <Shield className="w-3 h-3" />
                          In a Team
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {profile.username && (
                  <p className="text-sm text-muted-foreground/70">@{profile.username}</p>
                )}
                <p className="text-sm text-muted-foreground font-medium">{profile.primaryRole}</p>
                {(profile.averageRating ?? 0) > 0 && (
                  <div className="mt-1">
                    <StarRating rating={profile.averageRating ?? 0} readonly size="sm" showValue totalRatings={profile.totalRatings} />
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {!isOwnProfile && (
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <button className="btn-primary text-sm py-1.5 px-4" onClick={() => setShowPitchModal(true)}>Pitch Your Team</button>
                <button onClick={() => onMessage?.(targetUserId!)} className="btn-secondary text-sm py-1.5 px-4">Message</button>
                <button onClick={() => setShowBlockReportModal(true)} className="btn-secondary text-sm py-1.5 px-3 text-destructive flex items-center gap-1">
                  <Flag className="w-3.5 h-3.5" /> Report
                </button>
              </div>
            )}
            {isOwnProfile && (
              <div className="flex flex-row items-center gap-2">
                <button
                  onClick={() => setShowCertificationModal(true)}
                  className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Award className="w-3.5 h-3.5" />
                  Verified Portfolio
                </button>

                <button
                  onClick={onEditProfile}
                  className="btn-secondary text-sm py-1.5 px-4 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
              </div>
            )}
          </div>

          {/* Quick meta row — uses resolved city/college names */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {profile.city && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />{getCityById(profile.city)?.name || profile.city}
              </span>
            )}
            {(collegeName || profile.college) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />{collegeName || profile.college}{profile.yearOfStudy ? ` · ${profile.yearOfStudy}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="border-t border-border/40 px-4 flex gap-0 overflow-x-auto">
          {([
            { id: 'posts' as ProfileTab, label: 'Posts', count: myPosts.length },
            { id: 'skills' as ProfileTab, label: 'Skills', count: profile.skills?.length || 0 },
            { id: 'activity' as ProfileTab, label: 'Activity' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn('profile-tab', activeTab === tab.id && 'active')}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 text-[11px] opacity-60">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Content — 2-col layout ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

        {/* ── Main Content Column ── */}
        <div className="space-y-5 min-w-0">

          {/* ── Tab: Posts ── */}
          {activeTab === 'posts' && (
            <>
              {/* Bio / Summary */}
              {profile.bio && (
                <div className="card-base p-5">
                  <h2 className="section-title mb-3 flex items-center gap-2">
                    <Quote className="w-4 h-4 text-primary/60" />
                    Summary
                  </h2>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    <Linkify options={{ target: '_blank', rel: 'noopener noreferrer', className: 'text-primary underline' }}>
                      {profile.bio}
                    </Linkify>
                  </div>
                </div>
              )}

              {/* Media & Resume */}
              <div className="card-base p-5">
                <h2 className="section-title mb-4">Media & Resume</h2>
                {!profile?.cvUrl && !profile?.videoUrl ? (
                  <div
                    onClick={() => navigate('/upload')}
                    className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-secondary/50 transition"
                  >
                    <p className="text-muted-foreground text-sm">No media uploaded yet</p>
                    {isOwnProfile && <p className="text-primary text-sm mt-1 font-medium">Click to upload Resume or Video</p>}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {profile.cvUrl && (
                      <a href={profile.cvUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition text-sm">
                        📄 View Resume
                      </a>
                    )}
                    {profile.videoUrl && <video src={profile.videoUrl} controls className="w-full rounded-xl border" />}
                  </div>
                )}
              </div>

              {/* Posts */}
              <div className="card-base p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="section-title flex items-center gap-2">
                    <PenSquare className="w-4 h-4" />
                    {isOwnProfile ? 'My Posts' : 'Posts'}
                  </h2>
                  {myPosts.length > 2 && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{myPosts.length} posts</span>
                      <button onClick={() => setShowAllPosts(prev => !prev)} className="text-xs text-primary hover:underline">
                        {showAllPosts ? 'Show less' : 'See all'}
                      </button>
                    </div>
                  )}
                </div>

                {postsLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : myPosts.length === 0 ? (
                  <div className="text-center py-8">
                    <PenSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-muted-foreground">
                      {isOwnProfile ? "You haven't created any posts yet" : "No posts yet"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visiblePosts.map((post) => (
                      <div key={post.id} className="p-4 rounded-xl bg-secondary/30 border border-border/60 hover:border-border transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground mb-1 text-sm">{post.title}</h3>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{post.description}</p>
                            {post.tags && post.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {post.tags.map((tag, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground">#{tag}</span>
                                ))}
                              </div>
                            )}
                            <p className="text-[11px] text-muted-foreground/70">{formatTimestamp(post.createdAt)}</p>
                          </div>
                          {isOwnProfile && user?.uid === post.authorId && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button onClick={() => setEditingPost(post)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeletePost(post.id)} disabled={deletingPostId === post.id}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                                {deletingPostId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {showAllPosts && myPosts.length > 2 && (
                  <button onClick={() => setShowAllPosts(false)} className="mt-4 mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition">
                    <ChevronUp className="w-4 h-4" /> Show less
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── Tab: Skills ── */}
          {activeTab === 'skills' && (
            <>
              {profile.skills && profile.skills.length > 0 && (
                <div id="tour-profile-stats" className="card-base p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="section-title">Skills</h2>
                    {hasVerifiedSkills && (
                      <span className="text-xs text-skill-mobile flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />{verifiedSkillsCount} verified
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill, idx) => {
                      const normalize = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();
                      const isVerified = skillVerification?.verifiedSkills.some(vs => normalize(vs) === normalize(skill.name));
                      return (
                        <span key={idx} className={`skill-tag text-sm ${getSkillClass(skill.name)} ${isVerified ? 'ring-2 ring-skill-mobile' : ''}`}>
                          {isVerified && <ShieldCheck className="w-3 h-3 inline mr-1" />}
                          {skill.name}
                          <span className="ml-1 opacity-70">({skill.proficiency})</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {skillVerification?.sources?.github && skillVerification?.stats?.languageUsage?.length > 0 && (
                <div className="card-base p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Github className="w-4 h-4 text-primary" />
                    <h2 className="section-title text-sm">GitHub Language Stats</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Based on your GitHub repository activity</p>
                  <div className="space-y-2.5">
                    {languageUsage.map(({ language, percent }) => {
                      const level = getSkillLevel(percent);
                      return (
                        <div key={language}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{language}</span>
                            <span className={`${level.color} font-semibold`}>{percent}% · {level.label}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-secondary">
                            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    <a href={skillVerification.sources.github.profileUrl} target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      @{skillVerification.sources.github.username}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Tab: Activity ── */}
          {activeTab === 'activity' && (
            <div className="card-base p-5">
              <h2 className="section-title mb-1">Activity Heatmap</h2>
              <p className="text-xs text-muted-foreground mb-4">Tasks completed, posts created, and teams joined · last 3 months</p>

              {heatmapLoading ? (
                <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(13, 1fr)', gridTemplateRows: 'repeat(7, 1fr)' }}>
                  {Array.from({ length: 91 }).map((_, i) => (
                    <div key={i} className="w-full aspect-square rounded-[3px] bg-muted/40 animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between pl-14 pr-2 text-[12px] font-medium text-muted-foreground/60">
                      {getMonthLabels().map((month) => (
                        <span key={month} className="w-10 text-left">{month}</span>
                      ))}
                    </div>

                    <div className="flex gap-4 items-start">
                      <div
                        className="flex flex-col justify-between text-[11px] font-medium text-muted-foreground/40 w-8 -ml-4"
                        style={{ height: 'calc(7 * 27px + 6 * 4px)' }}
                      >
                        <span className="h-[27px] flex items-center rotate-[-90deg]">Mon</span>
                        <span className="h-[27px] flex items-center rotate-[-90deg]">Wed</span>
                        <span className="h-[27px] flex items-center rotate-[-90deg]">Fri</span>
                      </div>

                      <div
                        className="grid gap-[4px] -ml-3"
                        style={{
                          gridTemplateRows: 'repeat(7, 1fr)',
                          gridAutoFlow: 'column'
                        }}
                      >
                        {heatmapCells.map((level, i) => (
                          <div
                            key={i}
                            className={cn(
                              'w-[27px] h-[27px] rounded-[4px] transition-all duration-300 hover:ring-2 hover:ring-primary/50',
                              heatmapColors[level]
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-2">
                    <span className="text-[9px] text-muted-foreground/60">Less</span>
                    {heatmapColors.map((c, i) => <div key={i} className={cn('w-3 h-3 rounded-[2px]', c)} />)}
                    <span className="text-[9px] text-muted-foreground/60">More</span>
                  </div>
                </>
              )}

              <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-border/40">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{myPosts.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Posts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{profile.skills?.length || 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Skills</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{verifiedSkillsCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Verified</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Sidebar Column ── */}
        <div className="space-y-4">

          {/* Quick Info */}
          <div className="card-base p-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Profile Details</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">Full Name</p>
                  <p className="text-sm text-foreground">{profile.fullName}</p>
                </div>
              </div>
              {profile.primaryRole && (
                <div className="flex items-start gap-3">
                  <Award className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">Role</p>
                    <p className="text-sm text-foreground">{profile.primaryRole}</p>
                  </div>
                </div>
              )}
              {profile.city && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">Location</p>
                    <p className="text-sm text-foreground">{getCityById(profile.city)?.name || profile.city}</p>
                  </div>
                </div>
              )}
              {(collegeName || profile.college) && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">Education</p>
                    <p className="text-sm text-foreground">{collegeName || profile.college}</p>
                    {profile.yearOfStudy && <p className="text-xs text-muted-foreground">{profile.yearOfStudy}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Identity Verification Card */}
          <div id="tour-profile-badges" className="card-base p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identity Verification</h2>
            </div>

            {profile.isProfileVerified ? (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  <p className="text-sm font-medium text-blue-500">Identity Verified</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your identity has been confirmed via official documents.
                </p>
              </div>
            ) : isOwnProfile ? (
              <button
                onClick={() => setShowIdentityModal(true)}
                className="w-full p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-primary/10 border border-blue-500/20 hover:from-blue-500/20 hover:to-primary/20 transition-all text-left"
              >
                <p className="text-sm font-medium text-blue-600 mb-1">Verify Your Identity</p>
                <p className="text-xs text-muted-foreground">Verify using Aadhaar, Passport, or Driving License</p>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                <p className="text-sm text-muted-foreground">Identity not verified yet</p>
              </div>
            )}
          </div>

          {/* Top Skills preview in sidebar */}
          {profile.skills && profile.skills.length > 0 && activeTab === 'posts' && (
            <div className="card-base p-5">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Skills</h2>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.slice(0, 8).map((skill, idx) => (
                  <span key={idx} className={`skill-tag text-xs ${getSkillClass(skill.name)}`}>{skill.name}</span>
                ))}
                {profile.skills.length > 8 && (
                  <button onClick={() => setActiveTab('skills')} className="text-xs text-primary hover:underline px-1">
                    +{profile.skills.length - 8} more
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Skill Verification Card */}
          <div className="card-base p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Skill Verification</h2>
            </div>

            {verificationLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : hasVerifiedSkills ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-skill-mobile/10 border border-skill-mobile/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-skill-mobile" />
                    <p className="text-sm font-medium text-skill-mobile">Skills Verified</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Verified on {skillVerification.verifiedAt?.toDate().toLocaleDateString()}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {skillVerification.verifiedSkills.slice(0, 5).map((skill, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-xs bg-skill-mobile/20 text-skill-mobile">{skill}</span>
                    ))}
                    {skillVerification.verifiedSkills.length > 5 && (
                      <span className="text-xs text-muted-foreground px-2">+{skillVerification.verifiedSkills.length - 5} more</span>
                    )}
                  </div>
                </div>
                {isOwnProfile && isGitHubLinked && (
                  <button onClick={handleUnlinkGitHub} className="w-full p-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition text-xs">
                    Unlink GitHub Account
                  </button>
                )}
                <div className="text-xs text-muted-foreground space-y-1">
                  {skillVerification.sources.github && (
                    <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-skill-mobile" /><span>GitHub verified</span></div>
                  )}
                  {skillVerification.sources.certificates && skillVerification.sources.certificates.length > 0 && (
                    <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-skill-mobile" /><span>{skillVerification.sources.certificates.length} certificate(s)</span></div>
                  )}
                </div>
              </div>
            ) : isOwnProfile ? (
              <button onClick={onOpenVerification}
                className="w-full p-3 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 hover:from-primary/20 hover:to-accent/20 transition-all text-left">
                <p className="text-sm font-medium text-primary mb-1">Verify Your Skills</p>
                <p className="text-xs text-muted-foreground">Boost credibility with GitHub or certificates</p>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                <p className="text-sm text-muted-foreground">Skills not verified yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Modals ═══ */}
      {editingPost && (
        <EditPostModal post={editingPost} onClose={() => setEditingPost(null)} onSubmit={handleEditPost} />
      )}
      {showPitchModal && !isOwnProfile && (
        <PitchModal
          type="pitch"
          recipientName={profile.fullName}
          recipientId={targetUserId}
          onClose={() => setShowPitchModal(false)}
          onSend={async (message) => { console.log('Pitch sent:', message); }}
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
      {showCertificationModal && profile && (
        <CertificationModal
          open={showCertificationModal}
          onOpenChange={setShowCertificationModal}
          userProfile={profile}
        />
      )}
      {showIdentityModal && isOwnProfile && (
        <IdentityVerificationModal
          onClose={() => setShowIdentityModal(false)}
          onComplete={(updatedFields) => {
            if (profile) setProfile({ ...profile, ...updatedFields });
          }}
        />
      )}
    </div>
  );
};

export default Profile;