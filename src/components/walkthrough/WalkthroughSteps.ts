import React from 'react';

export type WalkthroughStep = {
  id: string;
  title: string;
  description: string;
  targetId?: string; // If provided, uses live DOM target
  mockId?: string;   // If targetId is not found or not provided, uses MockUI
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  duration?: number;
};

export const walkthroughSteps: WalkthroughStep[] = [
  {
    id: 'dashboard',
    title: 'Welcome to TeamUp',
    description: 'Your central hub. Navigate features, track progress, and stay updated from the home dashboard.',
    targetId: 'tour-nav-feed', 
    position: 'right',
    duration: 5000,
  },
  {
    id: 'discover',
    title: 'Discover People',
    description: 'Find your perfect teammates. Filter by skills, interests, and availability to build your squad.',
    targetId: 'tour-nav-discover',
    position: 'right',
    duration: 5000,
  },
  {
    id: 'available_teammates',
    title: 'Available Teammates',
    description: 'Live suggestions for people looking for a team right now. Connect instantly!',
    targetId: 'tour-right-teammates',
    position: 'left',
    duration: 5000,
  },
  {
    id: 'discover_teams',
    title: 'Discover Teams',
    description: 'Looking to join a project? Browse teams that are actively recruiting.',
    targetId: 'tour-nav-discover-teams',
    position: 'right',
    duration: 5000,
  },
  {
    id: 'available_teams',
    title: 'Teams Hiring Now',
    description: 'A quick view of the top teams currently looking for members with your skills.',
    targetId: 'tour-right-teams',
    position: 'left',
    duration: 5000,
  },
  {
    id: 'interviews',
    title: 'Seamless Interviews',
    description: 'Schedule, conduct, and manage interviews with an intuitive integrated flow.',
    targetId: 'tour-nav-interviews',
    position: 'right',
    duration: 5000,
  },
  {
    id: 'platform_stats',
    title: 'Platform Activity',
    description: 'See the pulse of the community with live platform stats on active users and teams.',
    targetId: 'tour-right-stats',
    position: 'left',
    duration: 5000,
  },
  {
    id: 'user_profile',
    title: 'Your Portfolio',
    description: 'Manage your profile, showcase badges, and track your stats as you grow on TeamUp.',
    targetId: 'tour-header-profile', 
    position: 'bottom',
    duration: 5000,
  }
];
