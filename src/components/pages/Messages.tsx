import { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageCircle,
  Send,
  Loader2,
  Search,
  Paperclip,
  ArrowLeft
} from 'lucide-react';
import { useBlocks } from '@/contexts/BlockContext';
import { Ban, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToConversations,
  subscribeToMessages,
  sendMessage,
  markMessagesAsRead,
  getProfile,
  Conversation,
  Message,
} from '@/services/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import PrivateFilesPanel from '@/components/PrivateFilesPanel';
import DemoLockModal from "@/components/DemoLockModal";

interface MessagesProps {
  initialConversationId?: string | null;
  onBack?: () => void;
  onViewProfile?: (userId: string) => void;
  openAuth: () => void;
}

/* ─── Date helpers ─── */
function getDateLabel(timestamp: Timestamp | null): string {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const Messages = ({
  initialConversationId,
  onViewProfile,
  openAuth
}: MessagesProps) => {
  const [userProfiles, setUserProfiles] = useState<{ [key: string]: any }>({});
  const { user, isDemoUser } = useAuth();
  const [showDemoLock, setShowDemoLock] = useState(false);
  const { isBlockedByMe, wasBlockedByThem } = useBlocks();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(
    initialConversationId || null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const previousMessagesLengthRef = useRef(0);
  const [showFiles, setShowFiles] = useState(false);

  /* -------------------- SUBSCRIPTIONS -------------------- */

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToConversations(user.uid, (convs) => {
      setConversations(convs);
      setLoading(false);

      if (
        initialConversationId &&
        convs.some((c) => c.id === initialConversationId)
      ) {
        setSelectedConversation(initialConversationId);
      }
    });

    return unsubscribe;
  }, [user, initialConversationId]);

  useEffect(() => {
    if (!conversations.length) return;

    const fetchProfiles = async () => {
      const profiles: any = {};

      for (const conv of conversations) {
        const otherId = conv.participants.find(id => id !== user?.uid);
        if (otherId && !profiles[otherId]) {
          const profile = await getProfile(otherId);
          profiles[otherId] = profile;
        }
      }

      setUserProfiles(profiles);
    };

    fetchProfiles();
  }, [conversations]);

  useEffect(() => {
    if (!selectedConversation || !user) return;

    const unsubscribe = subscribeToMessages(selectedConversation, (msgs) => {
      setMessages(msgs);
      markMessagesAsRead(selectedConversation, user.uid);
    });

    return unsubscribe;
  }, [selectedConversation, user]);

  /* -------------------- SCROLL HANDLING -------------------- */

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    shouldAutoScrollRef.current =
      scrollHeight - scrollTop - clientHeight < 150;
  };

  useEffect(() => {
    const isNew = messages.length > previousMessagesLengthRef.current;
    const last = messages[messages.length - 1];
    const isOwn = last?.senderId === user?.uid;

    if (isNew && (isOwn || shouldAutoScrollRef.current)) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    previousMessagesLengthRef.current = messages.length;
  }, [messages, user?.uid]);

  /* -------------------- HELPERS -------------------- */

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isDemoUser) {
      setShowDemoLock(true);
      return;
    }

    if (!user || !selectedConversation || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(selectedConversation, user.uid, newMessage.trim());
      setNewMessage('');
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (timestamp: Timestamp | null) => {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp.toDate().getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatMessageTime = (timestamp: Timestamp | null) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getOtherParticipant = (conversation: Conversation) => {
    const otherId = conversation.participants.find(id => id !== user?.uid) || '';
    const profile = userProfiles[otherId];

    return {
      id: otherId,
      name: profile?.fullName || conversation.participantNames?.[otherId] || 'User',
      avatar: profile?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=User`
    };
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const other = getOtherParticipant(conv);
    return other.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Group messages by date for date separators
  const messagesWithDates = useMemo(() => {
    const result: { type: 'date' | 'message'; label?: string; msg?: Message }[] = [];
    let lastDateStr = '';

    for (const msg of messages) {
      const dateStr = getDateLabel(msg.createdAt);
      if (dateStr && dateStr !== lastDateStr) {
        result.push({ type: 'date', label: dateStr });
        lastDateStr = dateStr;
      }
      result.push({ type: 'message', msg });
    }

    return result;
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedConv = conversations.find(
    (c) => c.id === selectedConversation
  );

  /* ====================== UI ====================== */

  return (
    <div className="card-base overflow-hidden flex flex-1 min-h-screen md:min-h-0 md:h-[calc(100vh-8rem)]">
      {/* ════════════════════════════════════════════
          CONVERSATIONS LIST (Left panel)
         ════════════════════════════════════════════ */}
      <div
        id="tour-messages-list"
        className={cn(
          'border-r border-border/60 flex flex-col',
          selectedConversation && 'hidden md:flex',
          'w-full md:w-80'
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border/60">
          <h2 className="font-display font-bold text-lg text-foreground mb-3">Messages</h2>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/60 border border-border/40 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 transition"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No conversations found' : 'No messages yet'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const other = getOtherParticipant(conv);
              const isActive = selectedConversation === conv.id;
              const hasUnread = conv.lastMessage && !conv.lastMessage.read;
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={cn(
                    'w-full p-3.5 flex gap-3 text-left transition-all duration-150 relative border-b border-border/20',
                    isActive
                      ? 'bg-primary/5'
                      : 'hover:bg-secondary/60'
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />
                  )}

                  {/* Avatar + status dot */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={other.avatar}
                      className="w-11 h-11 rounded-full object-cover"
                      alt=""
                    />
                    <span className={cn(
                      "absolute -bottom-0.5 -right-0.5 msg-status-dot",
                      "online" // visual only
                    )} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={cn(
                        "text-sm truncate",
                        isActive ? "font-bold text-primary" : "font-semibold text-foreground"
                      )}>
                        {other.name}
                      </p>
                      <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 ml-2">
                        {conv.lastMessage?.createdAt ? formatTimestamp(conv.lastMessage.createdAt) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={cn(
                        "text-xs truncate flex-1",
                        hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
                      )}>
                        {conv.lastMessage?.text || 'Start a conversation'}
                      </p>
                      {hasUnread && (
                        <span className="msg-unread-badge ml-1.5">1</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          CHAT PANEL (Right)
         ════════════════════════════════════════════ */}
      <div id="tour-messages-chat" className="flex flex-col flex-1 bg-background/50">
        {!selectedConversation || !selectedConv ? (
          <div className="hidden md:flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-primary/40" />
              </div>
              <p className="text-muted-foreground font-medium">Select a conversation</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Choose a chat to start messaging</p>
            </div>
          </div>
        ) : (() => {
            const otherUserId = selectedConv.participants.find(id => id !== user?.uid);
            
            // ✅ CHECK: I blocked them
            if (otherUserId && isBlockedByMe(otherUserId)) {
              return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <Ban className="w-16 h-16 text-destructive opacity-50 mb-4" />
                  <h3 className="font-bold text-xl mb-2">User Blocked</h3>
                  <p className="text-muted-foreground mb-6">
                    You have blocked this user. Unblock them to continue messaging.
                  </p>
                  <button
                    onClick={async () => {
                      if (!user || !otherUserId) return;
                      try {
                        const { unblockUser } = await import('@/services/blockReportService');
                        await unblockUser(user.uid, otherUserId);
                        const { toast } = await import('sonner');
                        toast.success('User unblocked');
                      } catch (error: any) {
                        const { toast } = await import('sonner');
                        toast.error(error.message || 'Failed to unblock');
                      }
                    }}
                    className="btn-secondary bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30"
                  >
                    Unblock User
                  </button>
                </div>
              );
            }
            
            // ✅ CHECK: They blocked me
            if (otherUserId && wasBlockedByThem(otherUserId)) {
              return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <Users className="w-16 h-16 text-muted-foreground opacity-50 mb-4" />
                  <h3 className="font-bold text-xl mb-2">User Not Found</h3>
                  <p className="text-muted-foreground">
                    This conversation is no longer available.
                  </p>
                </div>
              );
            }
            
            // ✅ FILES VIEW
            if (showFiles) {
              return (
                <>
                  <div className="p-4 border-b border-border/60 flex justify-between items-center bg-card">
                    <span className="font-semibold text-sm">Private Files</span>
                    <button
                      onClick={() => setShowFiles(false)}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      Close
                    </button>
                  </div>
                  <PrivateFilesPanel
                    conversationId={selectedConversation}
                    currentUserId={user!.uid}
                  />
                </>
              );
            }
            
            // ✅ NORMAL CHAT UI
            const otherParticipant = getOtherParticipant(selectedConv);
            return (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-border/60 flex items-center justify-between bg-card">
                  <div className="flex items-center gap-3">
                    {/* Back button on mobile */}
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="md:hidden p-1 rounded-lg hover:bg-secondary"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="relative">
                      <img
                        src={otherParticipant.avatar}
                        className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition"
                        alt=""
                        onClick={() => otherUserId && onViewProfile?.(otherUserId)}
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 msg-status-dot online" />
                    </div>
                    <div>
                      <span className="font-semibold text-sm text-foreground block">{otherParticipant.name}</span>
                      <span className="text-[11px] text-emerald-500 font-medium">Online</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowFiles(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    Files
                  </button>
                </div>

                {/* Messages with date separators */}
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin"
                >
                  {messages.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-sm text-muted-foreground/50">No messages yet. Say hello! 👋</p>
                    </div>
                  )}
                  {messagesWithDates.map((item, idx) => {
                    if (item.type === 'date') {
                      return (
                        <div key={`date-${idx}`} className="msg-date-separator">
                          <span>{item.label}</span>
                        </div>
                      );
                    }

                    const msg = item.msg!;
                    const isOwn = msg.senderId === user?.uid;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex py-0.5',
                          isOwn ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div className={isOwn ? 'chat-bubble-own' : 'chat-bubble-other'}>
                          <p className="text-sm">{msg.text}</p>
                          <p className={cn(
                            "text-[10px] mt-1",
                            isOwn ? "text-white/60" : "text-muted-foreground/50"
                          )}>
                            {formatMessageTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-4 border-t border-border/60 flex gap-2 bg-card"
                >
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border/60 bg-secondary/40 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 transition"
                    placeholder="Type a message..."
                  />
                  <button
                    disabled={!newMessage.trim() || sending}
                    className={cn(
                      "p-2.5 rounded-xl transition-all duration-200",
                      newMessage.trim()
                        ? "text-white shadow-md hover:shadow-lg hover:scale-105"
                        : "bg-secondary text-muted-foreground"
                    )}
                    style={newMessage.trim() ? { background: 'var(--gradient-hero)' } : undefined}
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </>
            );
          })()
        }
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

export default Messages;
