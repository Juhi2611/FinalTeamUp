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

export const walkthroughPages: Record<string, WalkthroughStep[]> = {
  feed: [
    {
      id: 'dashboard',
      title: 'Welcome to TeamUp',
      description: 'Your central hub. Navigate features, track progress, and stay updated from the home dashboard.',
      targetId: 'tour-nav-feed', 
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
      id: 'available_teams',
      title: 'Teams Hiring Now',
      description: 'A quick view of the top teams currently looking for members with your skills.',
      targetId: 'tour-right-teams',
      position: 'left',
      duration: 5000,
    },
    {
      id: 'platform_stats',
      title: 'Platform Activity',
      description: 'See the pulse of the community with live platform stats on active users and teams.',
      targetId: 'tour-right-stats',
      position: 'left',
      duration: 5000,
    }
  ],
  discover: [
    {
      id: 'discover_people',
      title: 'Discover Talent',
      description: 'Browse through thousands of potential teammates. Our AI matches researchers, developers, and designers based on your project needs.',
      targetId: 'tour-nav-discover',
      position: 'right',
      duration: 5000,
    },
    {
      id: 'view_switcher',
      title: 'Custom Views',
      description: 'Switch between Swipe, Grid, and Detailed views to find talent in the way that suits you best.',
      targetId: 'tour-view-switcher',
      position: 'bottom',
      duration: 5000,
    },
    {
      id: 'filters',
      title: 'Advanced Filtering',
      description: 'Filter by skills, city, availability, and more to narrow down your search.',
      targetId: 'tour-discover-filters',
      position: 'bottom',
      duration: 5000,
    },
    {
      id: 'swiping',
      title: 'Match & Connect',
      description: 'Swipe right to connect or left to skip. Match scores help you identify the best synergy.',
      targetId: 'tour-people-stack',
      position: 'top',
      duration: 5000,
    }
  ],
  'discover-teams': [
    {
      id: 'discover_teams_nav',
      title: 'Join a Project',
      description: 'Looking for a mission? Explore teams that are actively recruiting for roles that match your skills.',
      targetId: 'tour-nav-discover-teams',
      position: 'right',
      duration: 5000,
    },
    {
      id: 'team_filters',
      title: 'Find Your Niche',
      description: 'Search for teams by industry, tech stack, or phase of development.',
      targetId: 'tour-teams-filters',
      position: 'bottom',
      duration: 5000,
    },
    {
      id: 'team_cards',
      title: 'Team Portfolios',
      description: 'Check team stats, current members, and open roles before sending a join request.',
      targetId: 'tour-teams-grid',
      position: 'top',
      duration: 5000,
    }
  ],
  teams: [
    {
      id: 'my_teams',
      title: 'Your Projects',
      description: 'Manage all the teams you lead or are a part of from this central location.',
      targetId: 'tour-nav-teams',
      position: 'right',
      duration: 5000,
    },
    {
      id: 'teams_list',
      title: 'Team Cards',
      description: 'Quickly access workspace, chat, and task dashboards for each of your projects.',
      targetId: 'tour-teams-list',
      position: 'top',
      duration: 5000,
    }
  ],
  interviews: [
    {
      id: 'interviews_nav',
      title: 'Hiring Pipeline',
      description: 'Keep track of all your upcoming and past interviews in one place.',
      targetId: 'tour-nav-interviews',
      position: 'right',
      duration: 5000,
    },
    {
      id: 'interview_stats',
      title: 'Interview Stats',
      description: 'Monitor your success rate and total interviews conducted.',
      targetId: 'tour-interviews-stats',
      position: 'bottom',
      duration: 5000,
    },
    {
      id: 'interview_list',
      title: 'Schedule & Launch',
      description: 'View meeting links, reschedule, or start the interview instantly.',
      targetId: 'tour-interviews-list',
      position: 'top',
      duration: 5000,
    }
  ],
  profile: [
    {
      id: 'profile_header',
      title: 'Your Professional Brand',
      description: 'This is how other users and teams see you. Showcase your best work here.',
      targetId: 'tour-header-profile',
      position: 'bottom',
      duration: 5000,
    },
    {
      id: 'profile_stats',
      title: 'Skill Matrix',
      description: 'Your skills and experience levels are verified and displayed for maximum impact.',
      targetId: 'tour-profile-stats',
      position: 'right',
      duration: 5000,
    },
    {
      id: 'profile_badges',
      title: 'Achievements',
      description: 'Earn badges for fast responses, successful collaborations, and skill verifications.',
      targetId: 'tour-profile-badges',
      position: 'left',
      duration: 5000,
    }
  ],
  settings: [
    {
      id: 'settings_profile',
      title: 'Profile Settings',
      description: 'Update your personal information, skills, and social links.',
      targetId: 'tour-settings-profile',
      position: 'bottom',
      duration: 5000,
    },
    {
      id: 'settings_account',
      title: 'Account Management',
      description: 'Manage your email, password, and connected accounts like GitHub.',
      targetId: 'tour-settings-account',
      position: 'bottom',
      duration: 5000,
    }
  ],
  messages: [
    {
      id: 'conversations_list',
      title: 'Your Chats',
      description: 'Access all your direct messages and team chats from the sidebar.',
      targetId: 'tour-messages-list',
      position: 'right',
      duration: 5000,
    },
    {
      id: 'chat_area',
      title: 'Real-time Messaging',
      description: 'Collaborate with your teammates instantly using our real-time chat interface.',
      targetId: 'tour-messages-chat',
      position: 'left',
      duration: 5000,
    }
  ],
  workspace: [
    {
      id: 'workspace_tasks',
      title: 'Task Management',
      description: 'Create, assign, and track tasks for your team project.',
      targetId: 'tour-workspace-tasks',
      position: 'bottom',
      duration: 5000,
    },
    {
      id: 'workspace_timeline',
      title: 'Project Timeline',
      description: 'Visualise your project progress and upcoming milestones.',
      targetId: 'tour-workspace-timeline',
      position: 'bottom',
      duration: 5000,
    }
  ],
  notifications: [
    {
      id: 'notifications_center',
      title: 'Stay Notified',
      description: 'Never miss an update. Track team invites, join requests, and interview updates.',
      targetId: 'tour-notifications-list',
      position: 'bottom',
      duration: 5000,
    }
  ],
  leaderboard: [
    {
      id: 'leaderboard_top',
      title: 'Top Performers',
      description: 'See the most active users and teams on the platform.',
      targetId: 'tour-leaderboard-list',
      position: 'bottom',
      duration: 5000,
    },
    {
      id: 'perks_shop',
      title: 'Redeem Perks',
      description: 'Use your earned perks to unlock special features and profile badges.',
      targetId: 'tour-leaderboard-shop',
      position: 'bottom',
      duration: 5000,
    }
  ]
};
