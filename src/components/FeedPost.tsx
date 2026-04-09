import { Heart, MessageCircle, Rocket, Search, Target, Sparkles, Share2, Bookmark, ChevronRight } from 'lucide-react';
import { FeedPost as FeedPostType, getSkillClass } from '../data/mockData';

interface FeedPostProps {
  post: FeedPostType;
  onPitch: () => void;
  onInvite: () => void;
  onViewProfile: () => void;
}

const FeedPost = ({ post, onPitch, onInvite, onViewProfile }: FeedPostProps) => {
  const getTypeIcon = () => {
    switch (post.type) {
      case 'building':
        return <Rocket className="w-3.5 h-3.5" />;
      case 'looking':
        return <Search className="w-3.5 h-3.5" />;
      case 'open':
        return <Target className="w-3.5 h-3.5" />;
    }
  };

  const getTypeLabel = () => {
    switch (post.type) {
      case 'building':
        return 'Building a Team';
      case 'looking':
        return 'Looking for Teammates';
      case 'open':
        return 'Open to Join';
    }
  };

  const getTypeColor = () => {
    switch (post.type) {
      case 'building':
        return 'bg-primary/10 text-primary';
      case 'looking':
        return 'bg-accent/10 text-accent';
      case 'open':
        return 'bg-emerald-500/10 text-emerald-600';
    }
  };

  return (
    <article className="card-base overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-5 pb-0">
        <div className="flex items-start gap-3 mb-3">
          <img
            src={post.user.avatar}
            alt={post.user.name}
            className="w-11 h-11 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all flex-shrink-0"
            onClick={onViewProfile}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="font-semibold text-foreground hover:text-primary cursor-pointer transition-colors text-[15px]"
                onClick={onViewProfile}
              >
                {post.user.name}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${getTypeColor()}`}>
                {getTypeIcon()}
                {getTypeLabel()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{post.user.role} • {post.timestamp}</p>
          </div>
        </div>

        {/* Content */}
        <div className="mb-3">
          <h4 className="font-display font-bold text-[15px] text-foreground mb-1.5">{post.title}</h4>
          <p className="text-muted-foreground text-sm leading-relaxed">{post.description}</p>
        </div>

        {/* Skills or Roles */}
        <div className="mb-3">
          {post.rolesNeeded && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Looking for:</p>
              <div className="flex flex-wrap gap-1.5">
                {post.rolesNeeded.map((role: string) => (
                  <span key={role} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}
          {post.skills && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-1.5">
                {post.skills.map((skill: string) => (
                  <span key={skill} className={`skill-tag ${getSkillClass(skill)}`}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Match Indicator */}
        {Math.random() > 0.5 && (
          <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">AI Match: Your skills align with this team's needs</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button className="post-interaction-btn">
            <Heart className="w-[18px] h-[18px]" />
            <span>{post.likes}</span>
          </button>
          <button className="post-interaction-btn">
            <MessageCircle className="w-[18px] h-[18px]" />
            <span>{post.comments}</span>
          </button>
          <button className="post-interaction-btn">
            <Bookmark className="w-[18px] h-[18px]" />
          </button>
          <button className="post-interaction-btn">
            <Share2 className="w-[18px] h-[18px]" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {post.type === 'building' && (
            <button onClick={onPitch} className="btn-primary text-sm px-4 py-1.5">
              Pitch Yourself <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </button>
          )}
          {post.type === 'looking' && (
            <button onClick={onInvite} className="btn-primary text-sm px-4 py-1.5">
              Invite to Team <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </button>
          )}
          {post.type === 'open' && (
            <button onClick={onInvite} className="btn-primary text-sm px-4 py-1.5">
              Pitch Your Team <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </button>
          )}
          <button onClick={onViewProfile} className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5">
            Profile <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};

export default FeedPost;
