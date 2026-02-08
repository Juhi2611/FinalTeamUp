import { useState, useEffect } from 'react';

const STORAGE_KEY = 'teamup-sidebar-state';

interface SidebarState {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

export const useSidebarState = () => {
  const [leftCollapsed, setLeftCollapsed] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).leftCollapsed || false;
      } catch {
        return false;
      }
    }
    return false;
  });

  const [rightCollapsed, setRightCollapsed] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).rightCollapsed || false;
      } catch {
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    const state: SidebarState = { leftCollapsed, rightCollapsed };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [leftCollapsed, rightCollapsed]);

  const toggleLeft = () => setLeftCollapsed(prev => !prev);
  const toggleRight = () => setRightCollapsed(prev => !prev);

  return {
    leftCollapsed,
    rightCollapsed,
    toggleLeft,
    toggleRight,
    setLeftCollapsed,
    setRightCollapsed
  };
};
