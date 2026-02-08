import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { subscribeToHiddenUsers } from '@/services/blockReportService';

interface BlockContextType {
  hiddenUserIds: Set<string>;
  isHidden: (userId: string) => boolean;
  refreshBlocks: () => void;
}

const BlockContext = createContext<BlockContextType>({
  hiddenUserIds: new Set(),
  isHidden: () => false,
  refreshBlocks: () => {}
});

export const useBlocks = () => useContext(BlockContext);

export const BlockProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!user) {
      setHiddenUserIds(new Set());
      return;
    }

    const unsubscribe = subscribeToHiddenUsers(user.uid, (hiddenIds) => {
      setHiddenUserIds(hiddenIds);
    });

    return () => unsubscribe();
  }, [user, refreshTrigger]);

  const isHidden = (userId: string): boolean => hiddenUserIds.has(userId);
  const refreshBlocks = () => setRefreshTrigger(prev => prev + 1);

  return (
    <BlockContext.Provider value={{ hiddenUserIds, isHidden, refreshBlocks }}>
      {children}
    </BlockContext.Provider>
  );
};
