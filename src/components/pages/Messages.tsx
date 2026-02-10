import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Send,
  Loader2
} from 'lucide-react';
import { useBlocks } from '@/contexts/BlockContext';
import { Ban, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToConversations,
  subscribeToMessages,
  sendMessage,
  markMessagesAsRead,
  Conversation,
  Message,
} from '@/services/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import PrivateFilesPanel from '@/components/PrivateFilesPanel';

interface MessagesProps {
  initialConversationId?: string | null;
  onBack?: () => void;
  onViewProfile?: (userId: string) => void;
}

const Messages = ({
  initialConversationId,
  onViewProfile,
}: MessagesProps) => {
  const { user } = useAuth();
  const { isBlockedByMe, wasBlockedByThem } = useBlocks();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(
    initialConversationId || null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

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
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return timestamp.toDate().toLocaleDateString();
  };

  const getOtherParticipant = (conversation: Conversation) => {
    const otherId =
      conversation.participants.find((id) => id !== user?.uid) || '';
    return {
      id: otherId,
      name: conversation.participantNames?.[otherId] || 'User',
      avatar:
        conversation.participantAvatars?.[otherId] ||
        `https://api.dicebear.com/7.x/initials/svg?seed=User`,
    };
  };

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
    <div className="flex flex-1 min-h-screen md:min-h-0 md:h-[calc(100vh-8rem)]">
      {/* ---------------- CONVERSATIONS ---------------- */}
      <div
        className={cn(
          'border-r border-border flex flex-col bg-card',
          selectedConversation && 'hidden md:flex',
          'w-full md:w-80'
        )}
      >
        <div className="p-4 border-b border-border flex justify-between">
          <h2>Messages</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => {
            const other = getOtherParticipant(conv);
            return (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={cn(
                      'w-full p-4 flex gap-3 text-left hover:bg-secondary',
                      selectedConversation === conv.id && 'bg-secondary'
                    )}
                  >
                <img
                  src={other.avatar}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1">
                  <p className="font-medium">{other.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.lastMessage?.text}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- CHAT ---------------- */}
<div className="flex flex-col bg-card flex-1">
  {!selectedConversation || !selectedConv ? (
    <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground">
      Select a conversation
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
                  // Refresh will happen via BlockContext
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
      
      // ✅ NORMAL CHAT UI (if not blocked)
      if (showFiles) {
        return (
          <>
            {/* Files Header */}
            <div className="p-4 border-b border-border flex justify-between items-center">
              <span className="font-medium">Private Files</span>
              <button
                onClick={() => setShowFiles(false)}
                className="text-sm text-primary hover:underline"
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
      
      return (
        <>
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={getOtherParticipant(selectedConv).avatar}
                className="w-10 h-10 rounded-full"
                alt=""
              />
              <span className="font-medium">
                {getOtherParticipant(selectedConv).name}
              </span>
            </div>
            <button
              onClick={() => setShowFiles(true)}
              className="text-sm font-medium text-primary hover:underline"
            >
              Files
            </button>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {messages.map(msg => {
              const isOwn = msg.senderId === user?.uid;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    isOwn ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'px-4 py-2 rounded-2xl max-w-[70%]',
                      isOwn ? 'bg-primary text-white' : 'bg-secondary'
                    )}
                  >
                    <p>{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {formatTimestamp(msg.createdAt)}
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
            className="p-4 border-t border-border flex gap-2 bg-card"
          >
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 px-4 py-2 rounded-full border"
              placeholder="Type a message..."
            />
            <button
              disabled={!newMessage.trim() || sending}
              className="p-3 rounded-full bg-primary text-white"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </>
      );
    })()
  }
</div>
      </div>

  );
};

export default Messages;
