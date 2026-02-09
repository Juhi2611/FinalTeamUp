import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
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

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(
    initialConversationId || null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const previousMessagesLengthRef = useRef(0);

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

  useEffect(() => {
    if (selectedConversation) setSidebarCollapsed(true);
  }, [selectedConversation]);

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
    <div className="flex-1 flex md:grid md:grid-cols-[auto_1fr_320px] md:h-[calc(100vh-8rem)] md:max-h-[800px]">
      {/* ---------------- CONVERSATIONS ---------------- */}
      <div
        className={cn(
          'border-r border-border flex flex-col bg-card',
          selectedConversation && 'hidden md:flex',
          'w-full md:w-80'
        )}
      >
        <div className="p-4 border-b border-border flex justify-between">
          {!sidebarCollapsed && (
            <h2 className="font-bold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Messages
            </h2>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            {sidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
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
                {!sidebarCollapsed && (
                  <div className="flex-1">
                    <p className="font-medium">{other.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessage?.text}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- CHAT ---------------- */}
      <div className="flex flex-col bg-card">
        {selectedConversation && selectedConv ? (
          <>
            <div className="p-4 border-b border-border flex items-center gap-3">
              <img
                src={getOtherParticipant(selectedConv).avatar}
                className="w-10 h-10 rounded-full cursor-pointer"
                onClick={() =>
                  onViewProfile?.(
                    getOtherParticipant(selectedConv).id
                  )
                }
              />
              <h3 className="font-medium">
                {getOtherParticipant(selectedConv).name}
              </h3>
            </div>

            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {messages.map((msg) => {
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
                        'px-4 py-2 rounded-2xl max-w-[85%] md:max-w-[70%]',
                        isOwn
                          ? 'bg-primary text-white'
                          : 'bg-secondary'
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

            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-border flex gap-2 sticky bottom-0 bg-card"
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
                {sending ? <Loader2 className="animate-spin" /> : <Send />}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a conversation
          </div>
        )}
      </div>

      {/* ---------------- PRIVATE FILES ---------------- */}
      {selectedConversation && user && (
        <div className="hidden md:block">
          <PrivateFilesPanel
            conversationId={selectedConversation}
            currentUserId={user.uid}
          />
        </div>
      )}
    </div>
  );
};

export default Messages;
