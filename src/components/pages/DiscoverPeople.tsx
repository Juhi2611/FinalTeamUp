import { useState, useEffect } from 'react';
import { Search, MessageCircle, Users, Filter, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  subscribeToAllUsers,
  getAvailableRoles,
  sendInvitation,
  getUserTeams,
  createTeam,
  getProfile,
  UserProfile 
} from '@/services/firestore';
import { isFirebaseConfigured } from '@/lib/firebase'; 
import { useBlocks } from '@/contexts/BlockContext';
import { unblockUser } from '@/services/blockReportService';
import { getSkillClass } from '@/data/mockData';
import PitchModal from '../PitchModal';
import { toast } from 'sonner';
import { getAvailableCities } from '@/services/firestore';
import { ChevronDown } from 'lucide-react';
import { motion } from "framer-motion";

interface DiscoverPeopleProps {
  onViewProfile: (userId: string) => void;
}

const DiscoverPeople = ({ onViewProfile }: DiscoverPeopleProps) => {
  const [cityFilter, setCityFilter] = useState('');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const { hiddenUserIds, isBlockedByMe, wasBlockedByThem, refreshBlocks } = useBlocks();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<UserProfile | null>(null);
  const [sending, setSending] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);

  // ✅ 1️⃣ Load cities (ONCE)
  useEffect(() => {
    const loadCities = async () => {
      const cities = await getAvailableCities();
      const sorted = cities.filter(Boolean).sort((a, b) => a.localeCompare(b));
      setAvailableCities(sorted);
    };

    loadCities();
  }, []);

  // ✅ 2️⃣ Load users & subscriptions
  useEffect(() => {
    if (!isFirebaseConfigured() || !user) {
      setLoading(false);
      return;
    }

    getProfile(user.uid).then(setCurrentUserProfile);
    loadRoles();

    const unsubscribe = subscribeToAllUsers(user.uid, (fetchedUsers) => {
      setUsers(fetchedUsers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const loadRoles = async () => {
    if (!isFirebaseConfigured()) return;
    const roles = await getAvailableRoles();
    setAvailableRoles(roles);
  };
  const handleSendInvite = async (targetUser: UserProfile, message: string) => {
  if (!user || !targetUser.id) return;
  setSending(true);
  
  try {
    // Get user's teams
    const userTeams = await getUserTeams(user.uid);
    
    // Check if user has any teams
    if (userTeams.length === 0) {
      toast.error("You don't have any teams. Please create a team first.");
      setSending(false);
      setShowModal(null);
      return;
    }
    
    // Find teams where user is the leader
    const leaderTeams = userTeams.filter(team => team.leaderId === user.uid);
    
    // Check if user is a leader of any team
    if (leaderTeams.length === 0) {
      toast.error("Only team leaders can send invitations.");
      setSending(false);
      setShowModal(null);
      return;
    }
    
    // Use the first team where user is leader
    const teamId = leaderTeams[0].id;
    const teamName = leaderTeams[0].name;
    
    const profile = await getProfile(user.uid);
    
    // Send invitation
    await sendInvitation({
      teamId,
      teamName,
      fromUserId: user.uid,
      fromUserName: profile?.fullName || user.email?.split('@')[0] || 'User',
      toUserId: targetUser.id,
      toUserName: targetUser.fullName || 'User',
      message,
      type: 'invite'
    });
    
    toast.success(`Invitation sent to ${targetUser.fullName}`);
  } catch (error: any) {
    console.error('Error sending invitation:', error);
    toast.error(error.message || 'Failed to send invitation');
  }
  
  setSending(false);
  setShowModal(null);
};

  // Filter by search term and role
  // Filter by search term, role, and block status
// Filter by search term, role, and block status
const filteredUsers = users.filter((u) => {
  const term = searchTerm.toLowerCase();
  const matchesSearch = 
    (u.fullName?.toLowerCase().includes(term) || '') ||
    (u.primaryRole?.toLowerCase().includes(term) || '') ||
    (u.skills?.some(skill => skill.name.toLowerCase().includes(term)) || false);
  
  const matchesRole = !roleFilter || u.primaryRole === roleFilter;
  
  const matchesCity =
    !cityFilter ||
    u.city?.toLowerCase() === cityFilter.toLowerCase();

  return matchesSearch && matchesRole && matchesCity;
});

// Get user status
const getUserStatus = (u: UserProfile): { label: string; color: string; canInvite: boolean } => {
  if (!u.teamIds || u.teamIds.length === 0) {
    return { label: '🟢 Available', color: 'bg-skill-mobile/10 text-skill-mobile', canInvite: true };
  }
  if (u.leaderOfTeamIds && u.leaderOfTeamIds.length > 0) {
    return { 
      label: `🟡 Leading ${u.leaderOfTeamIds.length} Team${u.leaderOfTeamIds.length > 1 ? 's' : ''}`, 
      color: 'bg-accent/10 text-accent', 
      canInvite: true 
    };
  }
  return { 
    label: `🔵 In ${u.teamIds.length} Team${u.teamIds.length > 1 ? 's' : ''}`, 
    color: 'bg-primary/10 text-primary', 
    canInvite: true 
  };
};

// Check if current user can invite (must have a team or be able to create one)
const canCurrentUserInvite = currentUserProfile?.isTeamLeader || !currentUserProfile?.teamId || currentUserProfile?.teamId;

if (loading) {
  return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

return (
  <div className="space-y-6">
    {/* Header */}
    <div className="card-base p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Discover People</h1>
          <p className="text-muted-foreground">Find talented teammates for your project</p>
        </div>
      </div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="mt-6 space-y-4"
      >  
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, role, or skill..."
            className="input-field pl-12 w-full"
          />
        </div>

        {/* Filters */}
        <div className="w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            {/* Role Filter */}
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="input-field pl-11 pr-12 w-full appearance-none"
              >
                <option value="">All Roles</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>

            {/* City Filter */}
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="input-field pl-11 pr-12 w-full appearance-none"
              >
                <option value="">All Cities</option>
                {availableCities.map(city => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>

    {/* Status Legend */}
    <div className="card-base p-4">
      <p className="text-sm font-medium text-foreground mb-3">User Status:</p>
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-skill-mobile"></span>
          Available - Can be invited
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent"></span>
          Creating a Team - Team leader
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary"></span>
          Joined a Team - Already in a team
        </span>
      </div>
    </div>

    {/* People Grid */}
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.06,
          },
        },
      }}
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      {filteredUsers
        .filter(u => !wasBlockedByThem(u.id)) // ✅ Hide users who blocked ME
        .map((u) => {
          const status = getUserStatus(u);
          const iBlockedThem = isBlockedByMe(u.id); // ✅ Only show grey UI if I blocked them
          
          return (
            <motion.div
              key={u.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
              }}
              whileHover={iBlockedThem ? {} : { y: -4, scale: 1.01 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={`card-base p-5 ${iBlockedThem ? 'bg-muted/30 border-destructive/20' : 'card-interactive'}`}
            >
              <div className="flex items-start gap-4">
                <motion.img
                  src={u.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.fullName || 'User')}`}
                  alt={u.fullName}
                  whileHover={iBlockedThem ? {} : { scale: 1.08 }}
                  transition={{ duration: 0.12 }}
                  className={`avatar w-14 h-14 ${iBlockedThem ? 'grayscale opacity-40' : 'cursor-pointer hover:ring-2 hover:ring-primary/30'}`}
                  onClick={iBlockedThem ? undefined : () => onViewProfile(u.id)}
                />
                
                <div className="flex-1 min-w-0">
                  {iBlockedThem ? (
                    // BLOCKED USER UI
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-muted-foreground/50">
                          {u.fullName}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                          🚫 Blocked
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground/40 mb-4">You cannot interact with this user</p>
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.12 }}
                        onClick={async () => {
                          if (!user) return;
                          try {
                            await unblockUser(user.uid, u.id);
                            toast.success(`Unblocked ${u.fullName}`);
                            refreshBlocks();
                          } catch (error: any) {
                            toast.error(error.message || 'Failed to unblock');
                          }
                        }}
                        className="btn-secondary bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30 w-full"
                      >
                        Unblock
                      </motion.button>
                    </>
                  ) : (
                    // NORMAL USER UI
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 
                          className="font-semibold text-foreground hover:text-primary cursor-pointer transition-colors truncate"
                          onClick={() => onViewProfile(u.id)}
                        >
                          {u.fullName}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{u.primaryRole}</p>
                      
                      {/* Skills */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {u.skills?.slice(0, 4).map((skill, idx) => (
                          <span key={idx} className={`skill-tag ${getSkillClass(skill.name)}`}>
                            {skill.name}
                          </span>
                        ))}
                        {u.skills && u.skills.length > 4 && (
                          <span className="skill-tag bg-muted text-muted-foreground">
                            +{u.skills.length - 4} more
                          </span>
                        )}
                      </div>

                      {/* College & City */}
                      {(u.college || u.city) && (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4">
                          {u.college && <span>{u.college}</span>}
                          {u.yearOfStudy && <span>• {u.yearOfStudy}</span>}
                          {u.city && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                              📍 {u.city}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {status.canInvite ? (
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            transition={{ duration: 0.12 }}
                            onClick={() => setShowModal(u)}
                            disabled={sending}
                            className="btn-primary text-sm flex-1"
                          >
                            Invite to Team
                          </motion.button>
                        ) : (
                          <button 
                            disabled
                            className="btn-secondary text-sm flex-1 opacity-50 cursor-not-allowed"
                          >
                            {u.isTeamLeader ? 'Team Leader' : 'Already in Team'}
                          </button>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          transition={{ duration: 0.12 }}
                          onClick={() => onViewProfile(u.id)}
                          className="btn-secondary text-sm flex items-center gap-1.5"
                        >
                          View Profile
                        </motion.button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
    </motion.div>

    {/* Empty State */}
    {filteredUsers.filter(u => !wasBlockedByThem(u.id)).length === 0 && (
      <div className="card-base p-12 text-center">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-display font-bold text-lg text-foreground mb-2">No users found</h3>
        <p className="text-muted-foreground">
          {searchTerm || roleFilter 
            ? `No users matching your filters` 
            : 'Be the first to join!'}
        </p>
      </div>
    )}

    {/* Modal */}
    {showModal && (
      <PitchModal
        type="invite"
        recipientName={showModal.fullName || 'User'}
        recipientId={showModal.id}
        onClose={() => setShowModal(null)}
        onSend={(message) => handleSendInvite(showModal, message)}
      />
    )}
  </div>
);};

export default DiscoverPeople;
