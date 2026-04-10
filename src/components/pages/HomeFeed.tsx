import { useState, useEffect } from 'react';
import { Rocket, Search, Target, PenSquare, Loader2, Users, MessageCircle, Plus, Heart, Bookmark, Share2, Image, BarChart3, Activity, ChevronLeft, ChevronRight, TrendingUp, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToFeedPosts, createUserPost, FeedPost as FeedPostType } from '@/services/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { getSkillClass } from '@/data/mockData';
import { Timestamp } from 'firebase/firestore';
import { useBlocks } from '@/contexts/BlockContext';
import CreatePostModal from '../CreatePostModal';
import { toast } from 'sonner';
import DemoLockModal from "@/components/DemoLockModal";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "@/services/firestore";


interface HomeFeedProps {
  onNavigate: (page: string) => void;
  onViewProfile: (userId: string) => void;
  openAuth: () => void;
  profile: UserProfile | null;
}

const HomeFeed = ({ onNavigate, onViewProfile, openAuth, profile }: HomeFeedProps) => {

  const [showReminder, setShowReminder] = useState(false);
  const { user, isDemoUser } = useAuth();
  const [showDemoLock, setShowDemoLock] = useState(false);
  const [filter, setFilter] = useState<'all' | 'team_created' | 'member_joined' | 'looking_for_team' | 'user_post'>('all');
  const [posts, setPosts] = useState<FeedPostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { hiddenUserIds } = useBlocks();
  const navigate = useNavigate();
  const [trendScroll, setTrendScroll] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToFeedPosts((fetchedPosts) => {
      const filteredPosts = fetchedPosts.filter(
        post => !hiddenUserIds.has(post.authorId)
      );
      setPosts(filteredPosts);
      setLoading(false);
    }, user?.uid);

    const checkReminder = async () => {
      if (!user) return;

      try {
        const docRef = doc(db, "profiles", user.uid);
        const userSnap = await getDoc(docRef);

        if (!userSnap.exists()) return;

        const data = userSnap.data();
        const hasUploaded = data.cvUploaded || data.videoUploaded;

        if (!hasUploaded) {
          setShowReminder(true);
        } else {
          setShowReminder(false);
        }
      } catch (err) {
        console.error("Reminder error:", err);
      }
    };

    checkReminder();

    return () => unsubscribe();
  }, [hiddenUserIds, user]);


  const handleCreatePost = async (data: {
    title: string;
    description: string;
    tags: string[];
    image?: File | null;
  }) => {
    if (!user) return;
    await createUserPost(user.uid, {
      title: data.title,
      description: data.description,
      tags: data.tags,
      image: data.image || null,
    });
    toast.success('Post created successfully!');
  };

  const filteredPosts = filter === 'all'
    ? posts
    : posts.filter((post) => post.type === filter);

  const filters = [
    { id: 'all', label: 'All Posts', icon: null },
    { id: 'team_created', label: 'New Teams', icon: Rocket },
    { id: 'member_joined', label: 'Member Updates', icon: Users },
    { id: 'user_post', label: 'Community Posts', icon: MessageCircle },
  ];

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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'team_created':
        return <Rocket className="w-3.5 h-3.5" />;
      case 'member_joined':
        return <Users className="w-3.5 h-3.5" />;
      case 'looking_for_team':
        return <Search className="w-3.5 h-3.5" />;
      case 'open_to_join':
        return <Target className="w-3.5 h-3.5" />;
      case 'user_post':
        return <MessageCircle className="w-3.5 h-3.5" />;
      default:
        return <Rocket className="w-3.5 h-3.5" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'team_created':
        return 'bg-primary/10 text-primary';
      case 'member_joined':
        return 'bg-emerald-500/10 text-emerald-600';
      case 'looking_for_team':
        return 'bg-accent/10 text-accent';
      case 'open_to_join':
        return 'bg-sky-500/10 text-sky-600';
      case 'user_post':
        return 'bg-violet-500/10 text-violet-600';
      default:
        return 'bg-primary/10 text-primary';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'team_created':
        return 'New Team';
      case 'member_joined':
        return 'Member Joined';
      case 'open_to_join':
        return 'Open to Join';
      case 'user_post':
        return 'Post';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading feed...</p>
        </div>
      </div>
    );
  }

  // Build trend items from unique post authors/teams
  const trendItems = posts.slice(0, 6).map((post, i) => ({
    name: post.authorName,
    tags: i % 3 === 0 ? ['Trending'] : i % 3 === 1 ? ['New'] : ['Active'],
  }));

  return (
    <div className="max-w-[720px] mx-auto space-y-5">

      {/* ──── Active Team Trends ──── */}
      {trendItems.length > 0 && (
        <div className="card-base p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground font-display">Active Team Trends</h2>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTrendScroll(Math.max(0, trendScroll - 1))}
                className="p-1 rounded-full hover:bg-secondary transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              {/* Dots indicator */}
              <div className="flex gap-1 mx-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === trendScroll % 3 ? 'bg-primary' : 'bg-border'}`} />
                ))}
              </div>
              <button
                onClick={() => setTrendScroll(trendScroll + 1)}
                className="p-1 rounded-full hover:bg-secondary transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {trendItems.map((trend, idx) => (
              <div key={idx} className="trend-chip">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">{trend.name?.charAt(0)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{trend.name}</span>
                  <div className="flex gap-1">
                    {trend.tags.map(tag => (
                      <span key={tag} className={`text-[10px] font-semibold ${tag === 'Trending' ? 'text-rose-500' : tag === 'New' ? 'text-primary' : 'text-emerald-500'}`}>
                        {tag === 'Trending' ? '🔥' : tag === 'New' ? '✨' : '💚'} {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ──── Post Composer ──── */}
      <div className="post-composer">
        <div className="flex items-center gap-3 mb-3">
          <img
            src={
              profile?.avatar ||
              user?.photoURL ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile?.fullName || "User")}`
            }
            alt="You"
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
          <button
            onClick={() => {
              if (isDemoUser) {
                setShowDemoLock(true);
                return;
              }
              setShowCreateModal(true);
            }}
            className="post-composer-input text-left"
          >
            Start a discussion or share with your team...
          </button>
          <button
            onClick={() => {
              if (isDemoUser) {
                setShowDemoLock(true);
                return;
              }
              setShowCreateModal(true);
            }}
            className="btn-primary flex-shrink-0 px-5"
          >
            Post <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
        <div className="flex items-center gap-1 border-t border-border/60 pt-3">
          <button
            onClick={() => {
              if (isDemoUser) { setShowDemoLock(true); return; }
              setShowCreateModal(true);
            }}
            className="post-composer-action"
          >
            <Image className="w-4 h-4 text-sky-500" />
            <span>Photo/Video</span>
          </button>
          <button
            onClick={() => {
              if (isDemoUser) { setShowDemoLock(true); return; }
              setShowCreateModal(true);
            }}
            className="post-composer-action"
          >
            <BarChart3 className="w-4 h-4 text-amber-500" />
            <span>Poll</span>
          </button>
          <button
            onClick={() => {
              if (isDemoUser) { setShowDemoLock(true); return; }
              setShowCreateModal(true);
            }}
            className="post-composer-action"
          >
            <Activity className="w-4 h-4 text-emerald-500" />
            <span>Activity</span>
          </button>
          <div className="flex-1" />
          <button
            onClick={() => {
              if (isDemoUser) { setShowDemoLock(true); return; }
              setShowCreateModal(true);
            }}
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            Post <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ──── Filters ──── */}
      <div className="flex w-full gap-2 py-1">
        {filters.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setFilter(id as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${filter === id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-card border border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* ──── Feed Posts ──── */}
      <div className="space-y-4">
        {filteredPosts.map((post) => (
          <article key={post.id} className="card-base overflow-hidden">
            {/* Post Header */}
            <div className="p-5 pb-0">
              <div className="flex items-start gap-3 mb-3">
                <img
                  src={post.authorAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(post.authorName)}`}
                  alt={post.authorName}
                  className="w-11 h-11 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all flex-shrink-0"
                  onClick={() => onViewProfile(post.authorId)}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="font-semibold text-foreground hover:text-primary cursor-pointer transition-colors text-[15px]"
                      onClick={() => onViewProfile(post.authorId)}
                    >
                      {post.authorName}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${getTypeBadge(post.type)}`}>
                      {getTypeIcon(post.type)}
                      {getTypeLabel(post.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {post.authorRole && (
                      <span className="text-xs text-muted-foreground">{post.authorRole}</span>
                    )}
                    <span className="text-xs text-muted-foreground/60">•</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(post.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Post Content */}
              <div className="mb-3">
                <h3 className="font-semibold text-foreground text-[15px] mb-1.5">{post.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{post.description}</p>
              </div>

              {/* Post Image */}
              {post.imageUrl && (
                <div className="mt-3 -mx-5 mb-0">
                  <img
                    src={post.imageUrl}
                    alt="Post"
                    className="w-full object-cover max-h-[400px]"
                  />
                </div>
              )}

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {post.tags.map((tag, idx) => (
                    <span key={idx} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Roles Needed */}
              {post.rolesNeeded && post.rolesNeeded.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1.5">Looking for:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {post.rolesNeeded.map((role, idx) => (
                      <span key={idx} className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {post.skills && post.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {post.skills.map((skill, idx) => (
                    <span key={idx} className={`skill-tag ${getSkillClass(skill)}`}>
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Post Footer — Social interactions ── */}
            <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button className="post-interaction-btn">
                  <Heart className="w-[18px] h-[18px]" />
                  <span>{Math.floor(Math.random() * 120 + 5)}</span>
                </button>
                <button className="post-interaction-btn">
                  <MessageCircle className="w-[18px] h-[18px]" />
                  <span>{Math.floor(Math.random() * 30 + 1)}</span>
                </button>
                <button className="post-interaction-btn">
                  <Bookmark className="w-[18px] h-[18px]" />
                  <span>{Math.floor(Math.random() * 15)}</span>
                </button>
                <button className="post-interaction-btn">
                  <Share2 className="w-[18px] h-[18px]" />
                  <span>Share</span>
                </button>
              </div>
              <button
                onClick={() => onViewProfile(post.authorId)}
                className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                View Profile <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Empty State */}
      {filteredPosts.length === 0 && !loading && (
        <div className="card-base p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-display font-bold text-lg text-foreground mb-2">No posts available right now</h3>
          <p className="text-muted-foreground mb-6 max-w-xs mx-auto">Please try again later or be the first to create a post!</p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Create a Post
          </button>
        </div>
      )}

      {/* Create Post Modal */}
      {showCreateModal && (
        <CreatePostModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreatePost}
        />
      )}
      <DemoLockModal
        open={showDemoLock}
        onClose={() => setShowDemoLock(false)}
        onSignup={() => {
          setShowDemoLock(false);
          openAuth();
        }}
      />
      {showReminder && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
          <div className="bg-card p-8 rounded-2xl shadow-2xl text-center max-w-md border border-border/60">

            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>

            <h2 className="text-xl font-bold text-foreground mb-2 font-display">
              Complete Your Profile 🚀
            </h2>

            <p className="text-muted-foreground mb-6">
              Upload your CV or Intro Video to get better team matches.
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => onNavigate("upload")}
                className="btn-primary"
              >
                📄 Upload CV
              </button>

              <button
                onClick={() => onNavigate("upload")}
                className="btn-secondary"
              >
                🎥 Upload Video
              </button>
            </div>

            <button
              onClick={() => setShowReminder(false)}
              className="mt-5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Remind me later
            </button>

          </div>
        </div>
      )}

    </div>
  );
};

export default HomeFeed;
