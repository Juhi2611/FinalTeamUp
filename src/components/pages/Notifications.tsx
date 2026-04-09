import { useState, useEffect } from 'react';
import { Bell, Check, X, Clock, Send, Loader2, Eye, CheckCheck, MessageCircle, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBlocks } from '@/contexts/BlockContext';
import { Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  subscribeToInvitations,
  subscribeToNotifications,
  respondToInvitation,
  getProfile,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  Invitation,
  Notification as NotificationType
} from '@/services/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import DemoLockModal from "@/components/DemoLockModal";
import { cn } from '@/lib/utils';

interface NotificationsProps {
  onNavigateToMessages?: (conversationId: string) => void;
  onViewProfile?: (userId: string) => void;
  openAuth: () => void;
}

const Notifications: React.FC<NotificationsProps> = ({ onNavigateToMessages, onViewProfile, openAuth }) => {
  const { user } = useAuth();
  const { isDemoUser } = useAuth();
  const [showDemoLock, setShowDemoLock] = useState(false);

  const blockDemo = () => {
    if (isDemoUser) {
      setShowDemoLock(true);
      return true;
    }
    return false;
  };
  const { wasBlockedByThem } = useBlocks();
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState<Invitation[]>([]);
  const [outgoing, setOutgoing] = useState<Invitation[]>([]);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invitations' | 'all'>('invitations');
  useEffect(() => {
  const loadProfiles = async () => {
    const ids = [
      ...new Set([
        ...notifications.map(n => n.fromUserId),
        ...incoming.map(i => i.fromUserId)
      ])
    ];

    const profilesMap: Record<string, any> = {};

    await Promise.all(
      ids.map(async (id) => {
        if (!id) return;
        const profile = await getProfile(id);
        if (profile) {
          profilesMap[id] = profile;
        }
      })
    );

    setUserProfiles(profilesMap);
  };

  if (notifications.length || incoming.length) {
    loadProfiles();
  }
}, [notifications, incoming]);
  useEffect(() => {
    if (!isFirebaseConfigured() || !user) {
      setLoading(false);
      return;
    }

    const unsubInvitations = subscribeToInvitations(user.uid, (inc, out) => {
      setIncoming(inc);
      setOutgoing(out);
      setLoading(false);
    });

    const unsubNotifications = subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
    });

    return () => {
      unsubInvitations();
      unsubNotifications();
    };
  }, [user]);

  const handleRespond = async (invitation: Invitation, accept: boolean) => {
    if (blockDemo()) return;
    if (!user) return;
    setProcessingId(invitation.id);

    try {
      // Users can join multiple teams - no check needed
      await respondToInvitation(
        invitation.id,
        accept ? 'accepted' : 'rejected',
        accept ? invitation.teamId : undefined,
        accept ? user.uid : undefined,
        accept ? 'Member' : undefined
      );

      toast.success(accept ? `Joined ${invitation.teamName}!` : 'Invitation declined');
    } catch (error: any) {
      console.error('Error responding to invitation:', error);
      toast.error(error.message || 'Failed to respond to invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    if (blockDemo()) return;
    await markNotificationAsRead(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    if (blockDemo()) return;
    if (!user) return;
    await markAllNotificationsAsRead(user.uid);
    toast.success('All notifications marked as read');
  };

  const handleNotificationClick = async (notification: NotificationType) => {
    if (notification.type === 'MESSAGE') {
      if (blockDemo()) return;
    }
    // Mark as read
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }

    // Handle MESSAGE notifications
    if (notification.type === 'MESSAGE' && notification.conversationId && onNavigateToMessages) {
      onNavigateToMessages(notification.conversationId);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-accent/10 text-accent';
      case 'accepted': return 'bg-skill-mobile/10 text-skill-mobile';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const getNotificationBarClass = (type: NotificationType['type']) => {
    switch (type) {
      case 'MESSAGE': return 'message';
      case 'INVITE': return 'invite';
      case 'ACCEPTED': return 'accepted';
      case 'REJECTED': return 'rejected';
      default: return 'default';
    }
  };

  const getNotificationIcon = (type: NotificationType['type']) => {
    switch (type) {
      case 'MESSAGE': return <MessageCircle className="w-4 h-4 text-primary" />;
      case 'INVITE': return <Send className="w-4 h-4 text-accent" />;
      case 'ACCEPTED': return <CheckCheck className="w-4 h-4 text-skill-mobile" />;
      case 'REJECTED': return <X className="w-4 h-4 text-destructive" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
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

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ═══════════════════════════════════════════
          HEADER
         ═══════════════════════════════════════════ */}
      <div className="card-base p-6">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 relative">
              <Bell className="w-6 h-6 text-primary" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-foreground">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              className="btn-secondary text-xs flex items-center gap-1.5"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* ── Segment Control Tabs ── */}
        <div className="segment-control">
          <button
            onClick={() => setActiveTab('invitations')}
            className={cn("segment-control-item", activeTab === 'invitations' && 'active')}
          >
            Invitations
            {incoming.length > 0 && (
              <span className={cn(
                "ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full",
                activeTab === 'invitations' ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"
              )}>
                {incoming.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={cn("segment-control-item", activeTab === 'all' && 'active')}
          >
            All Notifications
            {notifications.length > 0 && (
              <span className={cn(
                "ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full",
                activeTab === 'all' ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {notifications.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          INVITATIONS TAB
         ═══════════════════════════════════════════ */}
      {activeTab === 'invitations' && (
        <div className="space-y-3">
          {incoming.length === 0 ? (
            <div className="card-base p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Send className="w-7 h-7 text-primary/40" />
              </div>
              <p className="text-muted-foreground font-medium">No pending invitations</p>
              <p className="text-sm text-muted-foreground/60 mt-1">When someone invites you to a team, it'll appear here.</p>
            </div>
          ) : (
            incoming.map((inv) => (
              <div key={inv.id} className="notification-item">
                {/* Left accent bar */}
                <div className="notification-bar invite" />

                {/* Avatar */}
                <img
                  src={
                    userProfiles[inv.fromUserId]?.avatar ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${inv.fromUserName}`
                  }
                  alt={inv.fromUserName}
                  className="w-11 h-11 rounded-full object-cover cursor-pointer hover:opacity-80 transition flex-shrink-0 ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onViewProfile) {
                      if (wasBlockedByThem(inv.fromUserId)) {
                        toast.error('User not found');
                        return;
                      }
                      onViewProfile(inv.fromUserId);
                    }
                  }}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm mb-1">
                    <span className="font-semibold">{inv.fromUserName}</span> invited you to join{' '}
                    <span className="font-semibold text-primary">{inv.teamName}</span>
                  </p>
                  {inv.teamDescription && (
                    <p className="text-xs text-muted-foreground mb-1.5 line-clamp-1">{inv.teamDescription}</p>
                  )}
                  {inv.message && (
                    <p className="text-xs text-muted-foreground italic mb-2">"{inv.message}"</p>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground/60">{formatTimestamp(inv.createdAt)}</span>
                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={() => handleRespond(inv, true)}
                        disabled={processingId === inv.id}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                      >
                        {processingId === inv.id ? (
                          <Loader2 className="animate-spin h-3.5 w-3.5" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Accept
                      </button>
                      <button
                        onClick={() => handleRespond(inv, false)}
                        disabled={processingId === inv.id}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          ALL NOTIFICATIONS TAB
         ═══════════════════════════════════════════ */}
      {activeTab === 'all' && (
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="card-base p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Bell className="w-7 h-7 text-primary/40" />
              </div>
              <p className="text-muted-foreground font-medium">No notifications yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Activity updates will show up here.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={cn("notification-item", !notif.read && 'unread')}
              >
                {/* Left accent bar */}
                <div className={cn("notification-bar", getNotificationBarClass(notif.type))} />

                {/* Avatar */}
                <img
                  src={
                    userProfiles[notif.fromUserId]?.avatar ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${notif.fromUserName}`
                  }
                  alt={notif.fromUserName}
                  className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition flex-shrink-0 ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onViewProfile) {
                      if (wasBlockedByThem(notif.fromUserId)) {
                        toast.error('User not found');
                        return;
                      }
                      onViewProfile(notif.fromUserId);
                    }
                  }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {notif.type === 'MESSAGE' ? (
                    <p className="text-sm text-foreground">
                      <strong>{notif.fromUserName}</strong> sent you a message
                    </p>
                  ) : (
                    <p className="text-sm text-foreground">
                      {notif.type === 'ACCEPTED' && (
                        <><strong>{notif.fromUserName}</strong> accepted your invitation to <strong className="text-primary">{notif.teamName}</strong></>
                      )}
                      {notif.type === 'REJECTED' && (
                        <><strong>{notif.fromUserName}</strong> declined your invitation to <strong>{notif.teamName}</strong></>
                      )}
                      {notif.type === 'JOIN_REQUEST' && (
                        <><strong>{notif.fromUserName}</strong> requested to join <strong className="text-primary">{notif.teamName}</strong></>
                      )}
                      {notif.type === 'INVITE' && (
                        <><strong>{notif.fromUserName}</strong> invited you to <strong className="text-primary">{notif.teamName}</strong></>
                      )}
                    </p>
                  )}
                  {notif.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">"{notif.message}"</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-muted-foreground/60">{formatTimestamp(notif.createdAt)}</span>
                    <div className="flex items-center gap-1">
                      {getNotificationIcon(notif.type)}
                    </div>
                  </div>
                </div>

                {/* Unread dot */}
                {!notif.read && (
                  <div className="flex-shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary block" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

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

export default Notifications;
