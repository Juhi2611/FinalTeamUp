import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getBlockedUsers, getBlockedByUsers } from '@/services/blockReportService';

interface BlockContextType {
  hiddenUserIds: Set<string>; // All hidden (for backwards compatibility)
  blockedByMe: Set<string>;    // Users I blocked
  blockedMe: Set<string>;      // Users who blocked me
  isHidden: (userId: string) => boolean;
  isBlockedByMe: (userId: string) => boolean;
  wasBlockedByThem: (userId: string) => boolean;
  refreshBlocks: () => void;
}

const BlockContext = createContext<BlockContextType>({
  hiddenUserIds: new Set(),
  blockedByMe: new Set(),
  blockedMe: new Set(),
  isHidden: () => false,
  isBlockedByMe: () => false,
  wasBlockedByThem: () => false,
  refreshBlocks: () => {}
});

export const useBlocks = () => useContext(BlockContext);

export const BlockProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [blockedByMe, setBlockedByMe] = useState<Set<string>>(new Set());
  const [blockedMe, setBlockedMe] = useState<Set<string>>(new Set());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!user) {
      setBlockedByMe(new Set());
      setBlockedMe(new Set());
      return;
    }

    const loadBlocks = async () => {
      const [iBlocked, blockedMeList] = await Promise.all([
        getBlockedUsers(user.uid),
        getBlockedByUsers(user.uid)
      ]);
      
      setBlockedByMe(new Set(iBlocked));
      setBlockedMe(new Set(blockedMeList));
    };

    loadBlocks();
  }, [user, refreshTrigger]);

  const hiddenUserIds = new Set([...blockedByMe, ...blockedMe]);
  const isHidden = (userId: string) => hiddenUserIds.has(userId);
  const isBlockedByMe = (userId: string) => blockedByMe.has(userId);
  const wasBlockedByThem = (userId: string) => blockedMe.has(userId);
  const refreshBlocks = () => setRefreshTrigger(prev => prev + 1);

  return (
    <BlockContext.Provider value={{ 
      hiddenUserIds, 
      blockedByMe,
      blockedMe,
      isHidden, 
      isBlockedByMe,
      wasBlockedByThem,
      refreshBlocks 
    }}>
      {children}
    </BlockContext.Provider>
  );
};
