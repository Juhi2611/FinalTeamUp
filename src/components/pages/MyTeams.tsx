import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import {
  MoreVertical,
  FolderKanban,
  Folder,
  Users,
  BarChart3,
  Sparkles,
  Settings,
  Edit,
  CheckCircle,
  LogOut,
  Trash2,
  Loader2,
  Plus,
  Crown,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import EditTeam from './EditTeam';
import { 
  subscribeToUserTeams, 
  subscribeToTeamMembers,
  subscribeToJoinRequests,
  getAvailableUsers,
  removeTeamMember,
  terminateTeam,
  respondToInvitation,
  Team, 
  TeamMember, 
  UserProfile,
  Invitation
} from '@/services/firestore';
import { declareTeamComplete } from '@/services/firestore';
import TeamManagementPanel from '../TeamManagementPanel';
import { isFirebaseConfigured } from '@/lib/firebase';
import { getTeamRecommendations } from '@/services/geminiService';
import { toast } from 'sonner';
import TeamProgressPanel from '@/components/TeamProgressPanel';
import DemoLockModal from "@/components/DemoLockModal";

interface MyTeamsProps {
  onNavigate: (page: string) => void;
  onViewWorkspace?: (teamId: string) => void;
  onViewProfile?: (userId: string) => void;
  onViewFiles?: (teamId: string) => void;
}

interface TeamWithMembers extends Team {
  loadedMembers: (TeamMember & { profile: UserProfile | null })[];
}

const MyTeams = ({ onNavigate, onViewWorkspace, onViewProfile, onViewFiles }: MyTeamsProps) => {
  const [openRecommendationTeamId, setOpenRecommendationTeamId] = useState<string | null>(null);
  const { isDemoUser } = useAuth();
  const [showDemoLock, setShowDemoLock] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendationsByTeam, setRecommendationsByTeam] = useState<
  Record<string, {
    missingRoles: string[];
    recommendedUsers: { user: UserProfile; reason: string }[];
    explanation: string;
  }>
>({});
  const [loadingRecommendationsByTeam, setLoadingRecommendationsByTeam] = useState<Record<string, boolean>>({});
  const [joinRequests, setJoinRequests] = useState<Invitation[]>([]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<string | null>(null);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showProgress, setShowProgress] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const handleDeclareComplete = async (teamId: string) => {
  if (!user) return;

  // ✅ Optimistically update UI
  setTeams(prev =>
    prev.map(team =>
      team.id === teamId
        ? { ...team, status: 'complete' }
        : team
    )
  );

  try {
    await declareTeamComplete(teamId, user.uid);
    toast.success('Team marked as complete');
  } catch (err) {
    // rollback if needed
    setTeams(prev =>
      prev.map(team =>
        team.id === teamId
          ? { ...team, status: 'active' }
          : team
      )
    );
    toast.error('Failed to declare team complete');
  }
};

  const [showTeamManagement, setShowTeamManagement] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) {
    setLoading(false);
    return;
    }
    const memberUnsubscribers = new Map<string, () => void>();
    // Subscribe to user's teams in real-time
    const unsubscribe = subscribeToUserTeams(user.uid, async (userTeams) => {
      // Clear old member subscriptions for teams no longer in list
      const currentTeamIds = new Set(userTeams.map(t => t.id));
      memberUnsubscribers.forEach((unsub, teamId) => {
        if (!currentTeamIds.has(teamId)) {
          unsub();
          memberUnsubscribers.delete(teamId);
        }
      });
    
    // Replace entire teams list with subscription data (this is the source of truth)
    setTeams(prevTeams => {
      // Only update if the team list actually changed
      const prevTeamIds = new Set(prevTeams.map(t => t.id));
      const hasChanged = 
        prevTeamIds.size !== currentTeamIds.size ||
        Array.from(prevTeamIds).some(id => !currentTeamIds.has(id));
      
      if (!hasChanged) {
        // Keep existing state if team IDs haven't changed
        return prevTeams;
      }
      
      // Team list changed, rebuild from subscription
      return [];
    });
    
    // Subscribe to members for each team
    userTeams.forEach((team) => {
      if (!memberUnsubscribers.has(team.id)) {
        const unsubMembers = subscribeToTeamMembers(team.id, (members) => {
          setTeams(prevTeams => {
            const updated = prevTeams.map(t =>
              t.id === team.id ? { ...t, loadedMembers: members } : t
            );
            // Add team if it doesn't exist yet
            if (!updated.find(t => t.id === team.id)) {
              updated.push({ ...team, loadedMembers: members });
            }
            return updated;
          });
        });
        memberUnsubscribers.set(team.id, unsubMembers);
      }
    });
    setLoading(false);
    // Subscribe to join requests if user is a leader
    userTeams.forEach(team => {
      if (team.leaderId === user.uid) {
        subscribeToJoinRequests(team.id, setJoinRequests);
      }
    });
  });
  return () => {
    unsubscribe();
    memberUnsubscribers.forEach(unsub => unsub());
  };
}, [user]);

  const loadRecommendations = async (team: TeamWithMembers) => {
  setLoadingRecommendationsByTeam(prev => ({
    ...prev,
    [team.id]: true
  }));

  try {
    const availableUsers = await getAvailableUsers(user?.uid);

    const currentMembers = team.loadedMembers.map(m => ({
      role: m.role,
      name: m.profile?.fullName || "",
      skills: m.profile?.skills || [],
      bio: m.profile?.bio || ""
    }));

    const recs = await getTeamRecommendations(team, currentMembers, availableUsers);

    setRecommendationsByTeam(prev => ({
      ...prev,
      [team.id]: recs
    }));
  } catch (error) {
    console.error("Error loading recommendations:", error);
  }

  setLoadingRecommendationsByTeam(prev => ({
    ...prev,
    [team.id]: false
  }));
};

  const handleLeaveTeam = async (teamId: string) => {
  if (!user) return;
  setActionLoading(true);
  
  // Optimistically remove the team from UI immediately
  setTeams(prevTeams => prevTeams.filter(t => t.id !== teamId));
  setShowLeaveConfirm(null);
  
  try {
    await removeTeamMember(teamId, user.uid);
    toast.success('You have left the team');
  } catch (error: any) {
    console.error('Error leaving team:', error);
    toast.error(error.message || 'Failed to leave team');
  }
  
  setActionLoading(false);
};


  const handleTerminateTeam = async (teamId: string) => {
  if (!user) return;
  setActionLoading(true);
  
  // Optimistically remove the team from UI immediately
  setTeams(prevTeams => prevTeams.filter(t => t.id !== teamId));
  setShowTerminateConfirm(null);
  
  try {
    await terminateTeam(teamId, user.uid);
    toast.success('Team terminated successfully');
  } catch (error) {
    console.warn('Terminate team cleanup warning:', error);
    // Still show success since team is already removed from UI
    toast.success('Team terminated successfully');
  }
  
  setActionLoading(false);
};

  const handleRespondToJoinRequest = async (request: Invitation, status: 'accepted' | 'rejected') => {
    setActionLoading(true);
    try {
      await respondToInvitation(request.id, status);
      toast.success(status === 'accepted' ? `${request.fromUserName} has joined the team!` : 'Request declined');
    } catch (error: any) {
      console.error('Error responding to request:', error);
      toast.error(error.message || 'Failed to respond to request');
    }
    setActionLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'forming':
        return 'bg-accent/10 text-accent';
      case 'active':
        return 'bg-skill-mobile/10 text-skill-mobile';
      case 'complete':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-primary/10 text-primary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'forming':
        return 'Forming';
      case 'active':
        return 'Active';
      case 'complete':
        return 'Complete';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
if (editingTeamId) {
  return (
    <EditTeam
      teamId={editingTeamId}
      onNavigate={onNavigate}
      onBack={() => setEditingTeamId(null)}
      onTeamUpdated={(updatedTeam) => {
        // ✅ Optimistically update the team in UI immediately
        setTeams(prevTeams =>
          prevTeams.map(t =>
            t.id === updatedTeam.id
              ? { ...t, ...updatedTeam }
              : t
          )
        );
      }}
    />
  );
}
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-base p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <FolderKanban className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-foreground">My Teams</h1>
              <p className="text-muted-foreground">Manage your hackathon teams</p>
            </div>
          </div>
          <button onClick={() => onNavigate('build')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Team
          </button>
        </div>
      </div>

      {/* Join Requests (for team leaders) */}
      {joinRequests.length > 0 && (
        <div className="card-base p-6 border-l-4 border-accent">
          <h2 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            Join Requests ({joinRequests.length})
          </h2>
          <div className="space-y-3">
            {joinRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(request.fromUserName)}`}
                    alt={request.fromUserName}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-foreground">{request.fromUserName}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.message || 'Wants to join your team'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRespondToJoinRequest(request, 'rejected')}
                    disabled={actionLoading}
                    className="btn-secondary text-sm"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleRespondToJoinRequest(request, 'accepted')}
                    disabled={actionLoading}
                    className="btn-primary text-sm"
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teams List */}
      <div className="space-y-4">
        {teams.map((team) => {
          const isLeader = team.leaderId === user?.uid;
          const isCompleted = team.status === 'complete';
          
          return (
            <div key={team.id} className="card-base card-interactive p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-display font-bold text-xl text-foreground">{team.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(team.status)}`}>
                      {getStatusLabel(team.status)}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground">
                      {team.loadedMembers.length}/{team.maxMembers} members
                    </span>
                    {isLeader && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        Leader
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground">{team.description}</p>
                  {team.hackathon && (
                    <p className="text-sm text-primary mt-1">🎯 {team.hackathon}</p>
                  )}
                  {team.city && (
                    <p className="text-sm text-muted-foreground mt-1">📍 {team.city}</p>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() =>
                      setOpenMenu(openMenu === team.id ? null : team.id)
                    }
                    className="p-2 rounded-lg hover:bg-secondary"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                
                  {openMenu === team.id && (
                    <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                  
                      {/* View Workspace */}
                      <button
                        onClick={() => {
                          setOpenMenu(null);
                          onViewWorkspace?.(team.id);
                        }}
                        className="menu-item"
                      >
                        <FolderKanban className="w-4 h-4" />
                        View Workspace
                      </button>
                  
                      {/* View Files */}
                      <button
                        onClick={() => {
                          setOpenMenu(null);
                          navigate(`/teams/${team.id}/files`);
                        }}
                        className="menu-item"
                      >
                        <Folder className="w-4 h-4" />
                        View Files
                      </button>
                  
                      {/* Progress — ALWAYS visible */}
                        <button
                          onClick={() => {
                            setOpenMenu(null);
                            setShowProgress(team.id);
                          }}
                          className="menu-item"
                        >
                          <BarChart3 className="w-4 h-4" />
                          Progress
                        </button>
                        
                        {!isCompleted && (
                          <>
                            {/* Find Teammates */}
                            <button
                              onClick={() => {
                                setOpenMenu(null);
                                onNavigate('discover');
                              }}
                              className="menu-item"
                            >
                              <Users className="w-4 h-4" />
                              Find Teammates
                            <button
  onClick={() => {
    setOpenMenu(null);
    setOpenRecommendationTeamId(team.id); // ✅ ADD THIS
    loadRecommendations(team);
  }}
  className="menu-item"
>
  <Sparkles className="w-4 h-4" />
  AI Suggestions
</button>
                            )}
                          </>
                        )}
                  
                      {/* Team Management */}
                      <button
                        onClick={() => {
                          setOpenMenu(null);
                          setShowTeamManagement(team.id);
                        }}
                        className="menu-item"
                      >
                        <Settings className="w-4 h-4" />
                        Team Management
                      </button>
                  
                      {/* Edit Team (Leader only) */}
                      {isLeader && (
                        <button
                          onClick={() => {
                            setOpenMenu(null);
                            setEditingTeamId(team.id);
                          }}
                          className="menu-item"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Team
                        </button>
                      )}
                  
                      {/* Declare Complete (Leader + not completed) */}
                      {isLeader && !isCompleted && (
                        <button
                          onClick={() => {
                            setOpenMenu(null);
                            handleDeclareComplete(team.id);
                          }}
                          className="menu-item text-skill-mobile"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Declare Complete
                        </button>
                      )}
                  
                      {/* Leave Team (Non-leader) */}
                      {!isLeader && (
                        <button
                          onClick={() => {
                            setOpenMenu(null);
                            setShowLeaveConfirm(team.id);
                          }}
                          className="menu-item text-destructive hover:bg-destructive/10"
                        >
                          <LogOut className="w-4 h-4" />
                          Leave Team
                        </button>
                      )}
                  
                      {/* Terminate Team (Leader) */}
                      {isLeader && (
                        <button
                          onClick={() => {
                            setOpenMenu(null);
                            setShowTerminateConfirm(team.id);
                          }}
                          className="menu-item text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                          Terminate Team
                        </button>
                      )}
                    </div>
                  )}
                </div>
            </div>

               {/* Members */}
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  Team Members ({team.loadedMembers.length})
                </p>
                <div className="flex flex-col gap-2">
                {/* Avatars row */}
                <div className="flex -space-x-1 sm:-space-x-2">
                  {team.loadedMembers.map((member) => (
                    <img
                      key={member.id}
                      src={
                        member.profile?.avatar ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                          member.profile?.fullName || 'User'
                        )}`
                      }
                      alt={member.profile?.fullName || 'Team member'}
                      title={`${member.profile?.fullName} - ${member.role}`}
                      onClick={() => onViewProfile?.(member.userId)}
                      className="w-9 h-9 rounded-full border-2 border-card cursor-pointer hover:scale-110 transition-transform"
                    />
                  ))}
                </div>
              
                {/* Names row */}
                <div className="flex flex-wrap gap-1">
                  {team.loadedMembers.map((member, idx) => (
                    <span key={member.id} className="text-sm text-muted-foreground">
                      <span
                        onClick={() => onViewProfile?.(member.userId)}
                        className="text-primary cursor-pointer hover:underline"
                      >
                        {member.profile?.fullName || 'Unknown'}
                      </span>
                      <span className="text-xs text-primary"> ({member.role})</span>
                      {idx < team.loadedMembers.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              </div>
              </div>

              {/* Roles Needed */}
              {team.rolesNeeded && team.rolesNeeded.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Roles Needed:</p>
                  <div className="flex flex-wrap gap-2">
                    {team.rolesNeeded.map((role, idx) => (
                      <span key={idx} className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}

                            {/* AI Recommendations */}
 {openRecommendationTeamId === team.id && (
  <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
    <div className="flex items-start gap-3">
      <Sparkles className="w-5 h-5 text-primary mt-0.5" />

      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="font-medium text-primary mb-2">AI Recommendations</p>

          <button
            onClick={() => setOpenRecommendationTeamId(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Close ✕
          </button>
        </div>

        {/* ✅ LOADER INSERT HERE */}
        {loadingRecommendationsByTeam[team.id] ? (
          <p className="text-sm text-muted-foreground">
            Loading AI suggestions...
          </p>
        ) : recommendationsByTeam[team.id] ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              {recommendationsByTeam[team.id].explanation}
            </p>

            {recommendationsByTeam[team.id].missingRoles.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-foreground mb-1">
                  Missing Roles:
                </p>

                <div className="flex flex-wrap gap-1">
                  {recommendationsByTeam[team.id].missingRoles.map((role, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {recommendationsByTeam[team.id].recommendedUsers.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-2">
                  Recommended Users:
                </p>

                <div className="space-y-2">
                  {recommendationsByTeam[team.id].recommendedUsers.map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded bg-secondary/50"
                    >
                      <img
                        src={
                          rec.user.avatar ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                            rec.user.fullName || "User"
                          )}`
                        }
                        alt={rec.user.fullName}
                        className="w-8 h-8 rounded-full"
                      />

                      <div>
                        <p className="text-sm font-medium">{rec.user.fullName}</p>
                        <p className="text-xs text-muted-foreground">{rec.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No AI suggestions available.
          </p>
        )}
      </div>
    </div>
  </div>
)}
                </div>
          );
        })}
      </div>

      {/* Empty State */}
      {teams.length === 0 && (
        <div className="card-base p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display font-bold text-lg text-foreground mb-2">No teams yet</h3>
          <p className="text-muted-foreground mb-4">Start your hackathon journey by creating a team or joining one</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => onNavigate('build')} className="btn-primary">
              Create a Team
            </button>
            <button onClick={() => onNavigate('discover-teams')} className="btn-secondary">
              Find a Team
            </button>
          </div>
        </div>
      )}

      {/* Leave Team Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="modal-overlay" onClick={() => setShowLeaveConfirm(null)}>
          <div className="modal-content animate-scale-in max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h2 className="font-display font-bold text-xl text-foreground">Leave Team?</h2>
                <p className="text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to leave this team? You will need to request to join again if you change your mind.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowLeaveConfirm(null)} 
                className="btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button 
                onClick={() => handleLeaveTeam(showLeaveConfirm)}
                disabled={actionLoading}
                className="btn-primary bg-destructive hover:bg-destructive/90 flex items-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                Leave Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Team Confirmation Modal */}
      {showTerminateConfirm && (
        <div className="modal-overlay" onClick={() => setShowTerminateConfirm(null)}>
          <div className="modal-content animate-scale-in max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <Trash2 className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h2 className="font-display font-bold text-xl text-foreground">Terminate Team?</h2>
                <p className="text-sm text-muted-foreground">This action is permanent</p>
              </div>
            </div>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to terminate this team? All members will be removed and the team will be deleted permanently. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowTerminateConfirm(null)} 
                className="btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button 
                onClick={() => handleTerminateTeam(showTerminateConfirm)}
                disabled={actionLoading}
                className="btn-primary bg-destructive hover:bg-destructive/90 flex items-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Terminate Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Panel */}
      {showProgress && (
        <div className="modal-overlay" onClick={() => setShowProgress(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {(() => {
              const team = teams.find(t => t.id === showProgress);
              if (!team) return null;
              return (
                <TeamProgressPanel
                  teamId={showProgress}
                  members={team.members}
                  isLeader={team.leaderId === user?.uid}
                  onClose={() => setShowProgress(null)}
                />
              );
            })()}
          </div>
        </div>
      )}

      {showTeamManagement && (
        <div className="modal-overlay" onClick={() => setShowTeamManagement(null)}>
          <div
            className="bg-card rounded-2xl p-6 w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const team = teams.find(t => t.id === showTeamManagement);
              if (!team) return null;

              return (
                <TeamManagementPanel
                  team={team}
                  currentUserId={user!.uid}
                  isLeader={team.leaderId === user?.uid}
                  onClose={() => setShowTeamManagement(null)}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};


export default MyTeams;
