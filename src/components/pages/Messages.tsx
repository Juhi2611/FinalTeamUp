import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, ArrowLeft, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToConversations,
  subscribeToMessages,
  sendMessage,
  markMessagesAsRead,
  Conversation,
  Message
} from '@/services/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface MessagesProps {
  initialConversationId?: string | null;
  onBack?: () => void;
}

const Messages = ({ initialConversationId, onBack }: MessagesProps) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const previousMessagesLengthRef = useRef(0);

  // Subscribe to conversations
  useEffect(() => {
    if (!isFirebaseConfigured() || !user) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToConversations(user.uid, (convs) => {
      setConversations(convs);
      setLoading(false);
      
      if (initialConversationId && convs.some(c => c.id === initialConversationId)) {
        setSelectedConversation(initialConversationId);
      }
    });

    return () => unsubscribe();
  }, [user, initialConversationId]);

  // Subscribe to messages when conversation is selected
  useEffect(() => {
    if (!isFirebaseConfigured() || !selectedConversation || !user) {
      return;
    }

    const unsubscribe = subscribeToMessages(selectedConversation, (msgs) => {
      setMessages(msgs);
      markMessagesAsRead(selectedConversation, user.uid);
    });

    return () => unsubscribe();
  }, [selectedConversation, user]);

  // Auto-collapse sidebar when conversation is selected on desktop
  useEffect(() => {
    if (selectedConversation) {
      setSidebarCollapsed(true);
    }
  }, [selectedConversation]);

  // Check if user is near bottom of scroll
  const isNearBottom = () => {
    if (!messagesContainerRef.current) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const threshold = 150;
    
    return scrollHeight - scrollTop - clientHeight < threshold;
  };

  // Handle scroll event to detect if user manually scrolled up
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      shouldAutoScrollRef.current = isNearBottom();
    }
  };

  // Smart auto-scroll
  useEffect(() => {
    const isNewMessage = messages.length > previousMessagesLengthRef.current;
    const lastMessage = messages[messages.length - 1];
    const isOwnMessage = lastMessage?.senderId === user?.uid;

    if (isNewMessage && (isOwnMessage || shouldAutoScrollRef.current)) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    previousMessagesLengthRef.current = messages.length;
  }, [messages, user?.uid]);

  // Reset auto-scroll when switching conversations
  useEffect(() => {
    shouldAutoScrollRef.current = true;
    previousMessagesLengthRef.current = 0;
  }, [selectedConversation]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedConversation || !newMessage.trim() || sending) return;

    setSending(true);
    shouldAutoScrollRef.current = true;

    try {
      await sendMessage(selectedConversation, user.uid, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
    setSending(false);
  };

  const formatTimestamp = (timestamp: Timestamp | null): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getOtherParticipant = (conversation: Conversation) => {
    const otherId = conversation.participants.find(id => id !== user?.uid) || '';
    return {
      id: otherId,
      name: conversation.participantNames?.[otherId] || 'User',
      avatar: conversation.participantAvatars?.[otherId] || `https://api.dicebear.com/7.x/initials/svg?seed=User`
    };
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="flex-1 flex h-[calc(100vh-8rem)] max-h-[800px]">
      {/* Conversation List - Collapsible */}
      <div className={cn(
        "border-r border-border flex flex-col bg-card rounded-l-xl transition-all duration-300",
        selectedConversation && "hidden md:flex",
        sidebarCollapsed ? "w-16" : "w-80"
      )}>
        {/* Header with collapse button */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          {!sidebarCollapsed && (
            <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Messages
            </h2>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors ml-auto"
            title={sidebarCollapsed ? "Expand" : "Collapse"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {conversations.length === 0 ? (
            !sidebarCollapsed && (
              <div className="p-4 text-center text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm mt-1">Start a conversation from someone's profile</p>
              </div>
            )
          ) : (
            conversations.map((conv) => {
              const other = getOtherParticipant(conv);
              const isSelected = selectedConversation === conv.id;
              
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversation(conv.id);
                    setSidebarCollapsed(true);
                  }}
                  className={cn(
                    "w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left border-b border-border/50",
                    isSelected && "bg-secondary",
                    sidebarCollapsed && "justify-center px-2"
                  )}
                  title={sidebarCollapsed ? other.name : undefined}
                >
                  <img
                    src={other.avatar}
                    alt={other.name}
                    className={cn(
                      "rounded-full object-cover flex-shrink-0",
                      sidebarCollapsed ? "w-10 h-10" : "w-12 h-12"
                    )}
                  />
                  {!sidebarCollapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">{other.name}</h3>
                        {conv.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessage.senderId === user?.uid ? 'You: ' : ''}
                            {conv.lastMessage.text}
                          </p>
                        )}
                      </div>
                      {conv.lastMessage?.sentAt && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTimestamp(conv.lastMessage.sentAt)}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat View */}
      <div className={cn(
        "flex-1 flex flex-col bg-card rounded-r-xl",
        !selectedConversation && "hidden md:flex"
      )}>
        {selectedConversation && selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="md:hidden p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              {/* Desktop: Show expand button */}
              {sidebarCollapsed && (
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  className="hidden md:block p-2 hover:bg-secondary rounded-lg transition-colors"
                  title="Show conversations"
                >
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
              
              <img
                src={getOtherParticipant(selectedConv).avatar}
                alt={getOtherParticipant(selectedConv).name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <h3 className="font-medium text-foreground">
                {getOtherParticipant(selectedConv).name}
              </h3>
            </div>

            {/* Messages */}
            <div 
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            >
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.senderId === user?.uid;
                  
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        isOwn ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2",
                          isOwn
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-secondary text-foreground rounded-bl-md"
                        )}
                      >
                        <p className="break-words">{msg.text}</p>
                        <p className={cn(
                          "text-xs mt-1",
                          isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {formatTimestamp(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 rounded-full border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select a conversation</p>
              <p className="text-sm mt-1">Choose from your existing conversations or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;