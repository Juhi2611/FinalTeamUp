import { useState, useEffect } from 'react';
import { Bell, Check, X, Clock, Send, Loader2, Eye, CheckCheck, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

interface NotificationsProps {
  onNavigateToMessages?: (conversationId: string) => void;
  onViewProfile?: (userId: string) => void;
}

const Notifications: React.FC<NotificationsProps> = ({ onNavigateToMessages, onViewProfile }) => {
  const { isDemoUser } = useAuth();
  const [showDemoLock, setShowDemoLock] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState<Invitation[]>([]);
  const [outgoing, setOutgoing] = useState<Invitation[]>([]);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invitations' | 'all'>('invitations');

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
    await markNotificationAsRead(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await markAllNotificationsAsRead(user.uid);
    toast.success('All notifications marked as read');
  };

  const handleNotificationClick = async (notification: NotificationType) => {
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

  const getNotificationIcon = (type: NotificationType['type']) => {
    switch (type) {
      case 'MESSAGE': return <MessageCircle className="w-4 h-4" />;
      case 'INVITE': return <Send className="w-4 h-4" />;
      case 'ACCEPTED': return <CheckCheck className="w-4 h-4" />;
      case 'REJECTED': return <X className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
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
  const messageNotifications = notifications.filter(n => n.type === 'MESSAGE');
  const unreadMessages = messageNotifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loader2 className="animate-spin h-6 w-6 text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-base p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Bell className="w-6 h-6 text-primary" />
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
              className="btn-secondary text-sm"
              onClick={handleMarkAllAsRead}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'invitations'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            Invitations ({incoming.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({notifications.length})
          </button>
        </div>
      </div>

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <div className="space-y-3">
          {incoming.length === 0 ? (
            <div className="card-base p-8 text-center">
              <Send className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No pending invitations</p>
            </div>
          ) : (
            incoming.map((inv) => (
  <div key={inv.id} className="card-base p-4">
    <div className="flex items-start gap-3">
      
      {/* Sender Avatar — CLICKABLE */}
      <img
  src={`https://api.dicebear.com/7.x/initials/svg?seed=${inv.fromUserName}`}
  alt={inv.fromUserName}
  className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition"
  onClick={(e) => {
    e.stopPropagation();
    if (onViewProfile) {
      onViewProfile(inv.fromUserId);
    }
  }}
/>

      <div className="flex-1 min-w-0">

        {/* Sender Name — CLICKABLE */}
        <p className="text-foreground mb-1">
  <span className="font-semibold">{inv.fromUserName}</span> invited you to join{' '}
  <span className="font-semibold">{inv.teamName}</span>
</p>
{inv.teamDescription && (
  <p className="text-sm text-muted-foreground mb-2">
    {inv.teamDescription}
  </p>
)}




        {inv.message && (
          <p className="text-sm text-muted-foreground italic mb-2">
            "{inv.message}"
          </p>
        )}

        <p className="text-xs text-muted-foreground mb-3">
          {formatTimestamp(inv.createdAt)}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => handleRespond(inv, true)}
            disabled={processingId === inv.id}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            {processingId === inv.id ? (
              <Loader2 className="animate-spin h-4 w-4" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Accept
          </button>

          <button
            onClick={() => handleRespond(inv, false)}
            disabled={processingId === inv.id}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <X className="w-4 h-4" />
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

      {/* All Notifications Tab */}
      {activeTab === 'all' && (
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="card-base p-8 text-center">
              <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No notifications</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`card-base p-4 cursor-pointer transition-colors ${
                  !notif.read ? 'bg-primary/5 border-primary/20' : 'hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-start gap-3">
  <img
    src={`https://api.dicebear.com/7.x/initials/svg?seed=${notif.fromUserName}`}
    alt={notif.fromUserName}
    className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition flex-shrink-0"
    onClick={(e) => {
      e.stopPropagation();
      if (onViewProfile) {
        onViewProfile(notif.fromUserId);
      }
    }}
  />
                  <div className="flex-1 min-w-0">
                    {notif.type === 'MESSAGE' ? (
                      <>
                        <p className="text-foreground mb-1">
                          <strong>{notif.fromUserName}</strong> sent you a message
                        </p>
                        {notif.message && (
                          <p className="text-sm text-muted-foreground mb-2">"{notif.message}"</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-foreground mb-1">
                          {notif.type === 'ACCEPTED' && (
                            <>
                              <strong>{notif.fromUserName}</strong> accepted your invitation to{' '}
                              <strong>{notif.teamName}</strong>
                            </>
                          )}
                          {notif.type === 'REJECTED' && (
                            <>
                              <strong>{notif.fromUserName}</strong> declined your invitation to{' '}
                              <strong>{notif.teamName}</strong>
                            </>
                          )}
                          {notif.type === 'JOIN_REQUEST' && (
                            <>
                              <strong>{notif.fromUserName}</strong> requested to join{' '}
                              <strong>{notif.teamName}</strong>
                            </>
                          )}
                          {notif.type === 'INVITE' && (
                            <>
                              <strong>{notif.fromUserName}</strong> invited you to{' '}
                              <strong>{notif.teamName}</strong>
                            </>
                          )}
                        </p>
                        {notif.message && (
                          <p className="text-sm text-muted-foreground mb-2">"{notif.message}"</p>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(notif.createdAt)}
                      </p>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
