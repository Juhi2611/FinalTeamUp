  import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc,
    query, 
    where, 
    orderBy,
    addDoc,
    serverTimestamp,
    onSnapshot,
    Unsubscribe,
    limit,
    arrayUnion,
    arrayRemove,
  } from 'firebase/firestore';
  import { supabase } from '@/lib/supabase';
  import { Timestamp } from 'firebase/firestore';
  import { generateUsernameFromName, isValidUsername } from '@/utils/username';
  import { isBlocked } from './blockReportService';
  import { db, isFirebaseConfigured } from '@/lib/firebase';
  import { getHiddenUsers } from './blockReportService';
  import type { 
    UserProfile, 
    Team, 
    TeamMember, 
    Invitation, 
    WorkspaceLog,
    Notification,
    FeedPost,
    TeamTask,
    Message,
    Conversation,
    SkillVerification
  } from '@/types/firestore.types';
  import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
  } from 'firebase/storage';
  import { storage } from '@/lib/firebase';
  export type { UserProfile, Team, TeamMember, Invitation, WorkspaceLog, Notification, FeedPost, TeamTask, Message, Conversation, SkillVerification };
  // ========================
  // PROFILE FUNCTIONS
  // ========================
  export const getProfile = async (userId: string): Promise<UserProfile | null> => {
    if (!isFirebaseConfigured()) return null;
    const docRef = doc(db, 'profiles', userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as UserProfile : null;
  };
  export const createProfile = async (userId: string, data: Partial<UserProfile>): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    await setDoc(doc(db, 'profiles', userId), {
      ...data,
      username: data.username || null,
      teamIds: [],
      leaderOfTeamIds: [],
      createdAt: serverTimestamp()
    });
  };
  
  export const updateProfile = async (
  userId: string,
  data: Partial<UserProfile>
): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  if (!userId) throw new Error('User ID is required for profile update');

  const updateData: any = {
    ...data,
    updatedAt: serverTimestamp()
  };

  if (data.username !== undefined) {
    updateData.username = data.username.toLowerCase();
  }

  await updateDoc(doc(db, 'profiles', userId), updateData);
};
  // ========================
  // SKILL VERIFICATION FUNCTIONS
  // ========================
  export const getSkillVerification = async (userId: string): Promise<SkillVerification | null> => {
    if (!isFirebaseConfigured()) return null;
    
    const q = query(
      collection(db, 'skillVerifications'),
      where('userId', '==', userId),
      where('status', '==', 'verified'),
      orderBy('verifiedAt', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SkillVerification;
  };
  export const createSkillVerification = async (
  userId: string,
  data: Omit<SkillVerification, 'id' | 'userId' | 'verifiedAt'>
): Promise<string> => {
  if (!isFirebaseConfigured()) return '';
  
  // Invalidate any existing verifications
  const existing = await getSkillVerification(userId);
  if (existing) {
    await updateDoc(doc(db, 'skillVerifications', existing.id), {
      status: 'invalidated',
      invalidatedAt: serverTimestamp(),
      invalidationReason: 'manual'
    });
  }
  
  const docRef = await addDoc(collection(db, 'skillVerifications'), {
    ...data,
    userId,
    verifiedAt: serverTimestamp()
  });
  
  return docRef.id;
};
  export const invalidateSkillVerification = async (
    userId: string,
    reason: 'profile_edited' | 'manual' | 'expired'
  ): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    
    const verification = await getSkillVerification(userId);
    if (!verification) return;
    
    await updateDoc(doc(db, 'skillVerifications', verification.id), {
      status: 'invalidated',
      invalidatedAt: serverTimestamp(),
      invalidationReason: reason
    });
  };
  export const subscribeToSkillVerification = (
    userId: string,
    onUpdate: (verification: SkillVerification | null) => void
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    const q = query(
      collection(db, 'skillVerifications'),
      where('userId', '==', userId),
      where('status', '==', 'verified'),
      orderBy('verifiedAt', 'desc'),
      limit(1)
    );
    
    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        onUpdate(null);
        return;
      }
      onUpdate({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SkillVerification);
    });
  };
  // ========================
  // DISCOVER PEOPLE FUNCTIONS
  // ========================
  export const getAllUsers = async (excludeUserId?: string): Promise<UserProfile[]> => {
    if (!isFirebaseConfigured()) return [];
    const q = query(collection(db, 'profiles'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
      .filter(user => user.id !== excludeUserId);
  };
  // Subscribe to all users in real-time
  export const subscribeToAllUsers = (
    excludeUserId: string,
    onUpdate: (users: UserProfile[]) => void
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    const q = query(collection(db, 'profiles'), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
        .filter(user => user.id !== excludeUserId);
      onUpdate(users);
    });
  };
  export const getAvailableUsers = async (excludeUserId?: string): Promise<UserProfile[]> => {
    if (!isFirebaseConfigured()) return [];
    // Return all users since users can join multiple teams now
    const q = query(collection(db, 'profiles'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
      .filter(user => user.id !== excludeUserId);
  };
  export const getAvailableUsersByRole = async (role: string, excludeUserId?: string): Promise<UserProfile[]> => {
    if (!isFirebaseConfigured()) return [];
    const q = query(
      collection(db, 'profiles'),
      where('primaryRole', '==', role)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
      .filter(user => user.id !== excludeUserId);
  };
  export const getAvailableRoles = async (): Promise<string[]> => {
    if (!isFirebaseConfigured()) return [];
    const snapshot = await getDocs(collection(db, 'profiles'));
    const roles = new Set<string>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.primaryRole) roles.add(data.primaryRole);
    });
    return Array.from(roles);
  };
  // ========================
  // TEAM FUNCTIONS
  // ========================
  export const createTeam = async (data: Omit<Team, 'id' | 'createdAt' | 'members'>): Promise<string> => {
    if (!isFirebaseConfigured()) return '';
    
    const leaderProfile = await getProfile(data.leaderId);
    const leaderName = leaderProfile?.fullName || 'User';
    
    const docRef = await addDoc(collection(db, 'teams'), {
      ...data,
      leaderName,
      members: [{ userId: data.leaderId, role: 'Team Leader', userName: leaderName }],
      createdAt: serverTimestamp()
    });
    
    // Update user's teamIds and leaderOfTeamIds arrays
    await updateDoc(doc(db, 'profiles', data.leaderId), {
      teamIds: arrayUnion(docRef.id),
      leaderOfTeamIds: arrayUnion(docRef.id)
    });
    
    // Create feed post for team creation
    await createFeedPost({
      authorId: data.leaderId,
      authorName: leaderName,
      authorAvatar: leaderProfile?.avatar,
      authorRole: leaderProfile?.primaryRole,
      type: 'team_created',
      title: `🚀 Created team: ${data.name}`,
      description: data.description,
      teamId: docRef.id,
      teamName: data.name,
      rolesNeeded: data.rolesNeeded
    });
    
    return docRef.id;
  };
  export const getTeam = async (teamId: string): Promise<Team | null> => {
    if (!isFirebaseConfigured()) return null;
    const docSnap = await getDoc(doc(db, 'teams', teamId));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Team : null;
  };
  export const getUserTeams = async (userId: string): Promise<Team[]> => {
    if (!isFirebaseConfigured()) return [];
    
    // Get user's profile to check teamIds array
    const profile = await getProfile(userId);
    if (!profile?.teamIds || profile.teamIds.length === 0) return [];
    
    // Fetch all teams the user is part of
    const teams = await Promise.all(
      profile.teamIds.map(async (teamId: string) => await getTeam(teamId))
    );
    
    return teams.filter(team => team !== null) as Team[];
  };
  export const subscribeToUserTeams = (
    userId: string,
    onUpdate: (teams: Team[]) => void
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    // Subscribe to user's profile to get teamIds
    const profileRef = doc(db, 'profiles', userId);
    
    return onSnapshot(profileRef, async (profileSnap) => {
      const profile = profileSnap.exists() ? profileSnap.data() as UserProfile : null;
      if (!profile?.teamIds || profile.teamIds.length === 0) {
        onUpdate([]);
        return;
      }
      
      // Fetch all teams
      const teams = await Promise.all(
        profile.teamIds.map(async (teamId: string) => await getTeam(teamId))
      );
      
      onUpdate(teams.filter(team => team !== null) as Team[]);
    });
  };
  export const updateTeam = async (teamId: string, data: Partial<Team>): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    await updateDoc(doc(db, 'teams', teamId), data);
  };
  // ========================
  // TEAM MEMBER FUNCTIONS
  // ========================
  export const addTeamMember = async (teamId: string, userId: string, role: string): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    
    // Get current team
    const team = await getTeam(teamId);
    if (!team) throw new Error('Team not found');
    
    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      throw new Error('Team is full');
    }
    
    // Check if user is already in this team
    if (team.members.some(m => m.userId === userId)) {
      throw new Error('User is already in this team');
    }
    
    const profile = await getProfile(userId);
    const userName = profile?.fullName || 'User';
    
    // Add member to team's members array
    const updatedMembers = [...(team.members || []), { userId, role, userName }];
    await updateTeam(teamId, { members: updatedMembers });
    
    // Update user's teamIds array
    await updateDoc(doc(db, 'profiles', userId), {
      teamIds: arrayUnion(teamId)
    });
    
    // Create feed post
    await createFeedPost({
      authorId: userId,
      authorName: userName,
      authorAvatar: profile?.avatar,
      authorRole: profile?.primaryRole,
      type: 'member_joined',
      title: `🎉 Joined team: ${team.name}`,
      description: `${userName} joined as ${role}`,
      teamId,
      teamName: team.name
    });
    
    // Also add to teamMembers collection for backward compatibility
    await addDoc(collection(db, 'teamMembers'), {
      teamId,
      userId,
      role,
      joinedAt: serverTimestamp()
    });
  };
  export const getTeamMembers = async (teamId: string): Promise<(TeamMember & { profile: UserProfile | null })[]> => {
    if (!isFirebaseConfigured()) return [];
    
    // Get team and its members array
    const team = await getTeam(teamId);
    if (!team) return [];
    
    // Fetch profiles for each member
    const members = await Promise.all(
      (team.members || []).map(async (member) => {
        const profile = await getProfile(member.userId);
        return {
          id: `${teamId}-${member.userId}`,
          teamId,
          userId: member.userId,
          role: member.role,
          joinedAt: team.createdAt,
          profile
        } as TeamMember & { profile: UserProfile | null };
      })
    );
    
    return members;
  };
  export const subscribeToTeamMembers = (
    teamId: string,
    onUpdate: (members: (TeamMember & { profile: UserProfile | null })[]) => void
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    const teamRef = doc(db, 'teams', teamId);
    
    return onSnapshot(teamRef, async (teamSnap) => {
      if (!teamSnap.exists()) {
        onUpdate([]);
        return;
      }
      
      const team = { id: teamSnap.id, ...teamSnap.data() } as Team;
      
      const members = await Promise.all(
        (team.members || []).map(async (member) => {
          const profile = await getProfile(member.userId);
          return {
            id: `${teamId}-${member.userId}`,
            teamId,
            userId: member.userId,
            role: member.role,
            joinedAt: team.createdAt,
            profile
          } as TeamMember & { profile: UserProfile | null };
        })
      );
      
      onUpdate(members);
    });
  };
  export const removeTeamMember = async (
  teamId: string,
  userId: string,
  profile?: { fullName?: string; avatar?: string }
) => {
  const teamRef = doc(db, 'teams', teamId);
  const snap = await getDoc(teamRef);
  if (!snap.exists()) {
    throw new Error('Team not found');
  }
  const teamData = snap.data();
  
  // Get user profile if not provided
  let userProfile = profile;
  if (!userProfile) {
    const prof = await getProfile(userId);
    userProfile = {
      fullName: prof?.fullName,
      avatar: prof?.avatar
    };
  }
  
  // ✅ REMOVE MEMBER FROM TEAM
  const updatedMembers = teamData.members.filter(
    (m: any) => m.userId !== userId
  );
  
  // ✅ ADD TO recentlyLeft
  const recentlyLeft = teamData.recentlyLeft || [];
  const updatedRecentlyLeft = [
    ...recentlyLeft,
    {
      userId,
      name: userProfile?.fullName || 'Unknown',
      avatar: userProfile?.avatar || null,
      leftAt: Timestamp.now(),
    },
  ].slice(-5);
  
  // ✅ UPDATE TEAM DOCUMENT
  await updateDoc(teamRef, {
    members: updatedMembers,
    memberIds: updatedMembers.map((m: any) => m.userId),
    recentlyLeft: updatedRecentlyLeft,
  });
  
  // ✅ REMOVE TEAM FROM USER'S PROFILE (THIS WAS MISSING!)
  await updateDoc(doc(db, 'profiles', userId), {
    teamIds: arrayRemove(teamId),
    leaderOfTeamIds: arrayRemove(teamId)
  });
};

  // Terminate team (leader only)
  export const terminateTeam = async (
    teamId: string,
    leaderId: string
  ): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    const team = await getTeam(teamId);
    if (!team) return;
    if (team.leaderId !== leaderId) {
      throw new Error('Only team leader can terminate the team');
    }
    
    // 1️⃣ Remove team from all member profiles (using arrayRemove for instant UI update)
    await Promise.allSettled(
      team.members.map(async (member) => {
        const profileRef = doc(db, 'profiles', member.userId);
        await updateDoc(profileRef, {
          teamIds: arrayRemove(teamId),
          leaderOfTeamIds: arrayRemove(teamId)
        });
      })
    );
    
    // 2️⃣ Delete teamMembers (BEST EFFORT)
    try {
      const membersQuery = query(
        collection(db, 'teamMembers'),
        where('teamId', '==', teamId)
      );
      const snapshot = await getDocs(membersQuery);
      await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
    } catch (err) {
      console.warn('[terminateTeam] teamMembers cleanup skipped');
    }
    
    // 3️⃣ Delete invitations (BEST EFFORT)
    try {
      const invitationsQuery = query(
        collection(db, 'invitations'),
        where('teamId', '==', teamId)
      );
      const snapshot = await getDocs(invitationsQuery);
      await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
    } catch (err) {
      console.warn('[terminateTeam] invitations cleanup skipped');
    }
    
    // 4️⃣ Delete team tasks (BEST EFFORT)
    try {
      const tasksQuery = query(
        collection(db, 'teamTasks'),
        where('teamId', '==', teamId)
      );
      const snapshot = await getDocs(tasksQuery);
      await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
    } catch (err) {
      console.warn('[terminateTeam] tasks cleanup skipped');
    }
    
    // 5️⃣ Delete workspace logs (BEST EFFORT)
    try {
      const logsQuery = query(
        collection(db, 'workspaceLogs'),
        where('teamId', '==', teamId)
      );
      const snapshot = await getDocs(logsQuery);
      await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
    } catch (err) {
      console.warn('[terminateTeam] workspace logs cleanup skipped');
    }
    
    // 6️⃣ DELETE TEAM (SOURCE OF TRUTH)
    await deleteDoc(doc(db, 'teams', teamId));
  };
  export const subscribeToAvailableTeams = (
    onUpdate: (teams: Team[]) => void,
    currentUserId?: string
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    const q = query(
      collection(db, 'teams'),
      where('status', '==', 'forming'),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, async (snapshot) => {
      let teams = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Team))
        .filter(team => team.members.length < team.maxMembers);
      
      if (currentUserId) {
        const hiddenUsers = await getHiddenUsers(currentUserId);
        teams = teams.filter(team => !hiddenUsers.has(team.leaderId));
      }
      
      onUpdate(teams);
    }, (error) => {
      console.error('Available teams subscription error:', error);
      onUpdate([]);
    });
  };
  // ========================
  // INVITATION FUNCTIONS
  // ========================
  export const sendInvitation = async (data: Omit<Invitation, 'id' | 'status' | 'createdAt'>): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  
  const isJoinRequest = data.type === 'join_request';
  const targetUserId = isJoinRequest ? data.toUserId : data.toUserId;
  
  // ✅ CHECK IF BLOCKED
  const blocked = await isBlocked(data.fromUserId, targetUserId);
  if (blocked) {
    throw new Error('Cannot send invitation to blocked user');
  }
  
  // Check if team still has room
  const team = await getTeam(data.teamId);
  if (!team) {
    throw new Error('Team not found');
  }
  if (team.members.length >= team.maxMembers) {
    throw new Error('Team is full');
  }
  
  // Check if user is already in this team
  if (team.members.some(m => m.userId === (isJoinRequest ? data.fromUserId : data.toUserId))) {
    throw new Error('User is already in this team');
  }
  
  // Check for existing pending invitation/request
  const existingQuery = query(
    collection(db, 'invitations'),
    where('fromUserId', '==', data.fromUserId),
    where('teamId', '==', data.teamId),
    where('status', '==', 'pending')
  );
  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) {
    throw new Error(isJoinRequest ? 'Join request already sent' : 'Invitation already sent');
  }
  
  // Create invitation/join request
  await addDoc(collection(db, 'invitations'), {
    ...data,
    teamDescription: team.description,
    status: 'pending',
    createdAt: serverTimestamp()
  });
  
  // Create notification
  const notifyUserId = isJoinRequest ? data.toUserId : data.toUserId;
  await createNotification({
    toUserId: notifyUserId,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    type: isJoinRequest ? 'JOIN_REQUEST' : 'INVITE',
    teamId: data.teamId,
    teamName: data.teamName,
    message: data.message
  });
};
  export const getIncomingInvitations = async (userId: string): Promise<Invitation[]> => {
    if (!isFirebaseConfigured()) return [];
    const q = query(
      collection(db, 'invitations'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
  };
  export const getOutgoingInvitations = async (userId: string): Promise<Invitation[]> => {
    if (!isFirebaseConfigured()) return [];
    const q = query(
      collection(db, 'invitations'),
      where('fromUserId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
  };
  export const respondToInvitation = async (
    invitationId: string, 
    status: 'accepted' | 'rejected',
    teamId?: string,
    userId?: string,
    role?: string
  ): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    
    // Get invitation details
    const invRef = doc(db, 'invitations', invitationId);
    const invSnap = await getDoc(invRef);
    const invitation = invSnap.exists() ? { id: invSnap.id, ...invSnap.data() } as Invitation : null;
    
    if (!invitation) {
      throw new Error('Invitation not found');
    }
    
    const isJoinRequest = invitation.type === 'join_request';
    
    // Determine who is joining
    const joiningUserId = isJoinRequest ? invitation.fromUserId : invitation.toUserId;
    const joiningUserName = isJoinRequest ? invitation.fromUserName : invitation.toUserName;
    
    // If accepting, verify the team still has room
    if (status === 'accepted') {
      const team = await getTeam(invitation.teamId);
      if (!team) {
        throw new Error('Team no longer exists');
      }
      if (team.members.length >= team.maxMembers) {
        throw new Error('Team is full');
      }
      
      // Check if user is already in this team
      if (team.members.some(m => m.userId === joiningUserId)) {
        throw new Error('User is already in this team');
      }
    }
    
    await updateDoc(invRef, { status });
    
    if (status === 'accepted') {
      const joiningProfile = await getProfile(joiningUserId);
      const joiningRole = joiningProfile?.primaryRole || role || 'Member';
      
      await addTeamMember(invitation.teamId, joiningUserId, joiningRole);
      
      // Notify the appropriate party
      const notifyUserId = isJoinRequest ? invitation.fromUserId : invitation.fromUserId;
      const responderProfile = await getProfile(isJoinRequest ? invitation.toUserId : invitation.toUserId);
      
      await createNotification({
        toUserId: notifyUserId,
        fromUserId: isJoinRequest ? invitation.toUserId : invitation.toUserId,
        fromUserName: responderProfile?.fullName || 'User',
        type: 'ACCEPTED',
        teamId: invitation.teamId,
        teamName: invitation.teamName,
        message: isJoinRequest 
          ? `Your request to join ${invitation.teamName} was accepted!`
          : `${joiningUserName} accepted your invitation to join ${invitation.teamName}`
      });
    } else if (status === 'rejected') {
      const notifyUserId = isJoinRequest ? invitation.fromUserId : invitation.fromUserId;
      const responderProfile = await getProfile(isJoinRequest ? invitation.toUserId : invitation.toUserId);
      
      await createNotification({
        toUserId: notifyUserId,
        fromUserId: isJoinRequest ? invitation.toUserId : invitation.toUserId,
        fromUserName: responderProfile?.fullName || 'User',
        type: 'REJECTED',
        teamId: invitation.teamId,
        teamName: invitation.teamName,
        message: isJoinRequest 
          ? `Your request to join ${invitation.teamName} was declined`
          : `${invitation.toUserName} declined your invitation to join ${invitation.teamName}`
      });
    }
  };
  export const subscribeToJoinRequests = (
    teamId: string,
    onUpdate: (requests: Invitation[]) => void
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    const q = query(
      collection(db, 'invitations'),
      where('teamId', '==', teamId),
      where('type', '==', 'join_request'),
      where('status', '==', 'pending')
    );
    
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
      onUpdate(requests);
    }, (error) => {
      console.error('Join requests subscription error:', error);
      onUpdate([]);
    });
  };
  export const subscribeToInvitations = (
    userId: string,
    onUpdate: (incoming: Invitation[], outgoing: Invitation[]) => void
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    const incomingQuery = query(
      collection(db, 'invitations'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending')
    );
    
    const outgoingQuery = query(
      collection(db, 'invitations'),
      where('fromUserId', '==', userId)
    );
    
    let incoming: Invitation[] = [];
    let outgoing: Invitation[] = [];
    
    const unsubIncoming = onSnapshot(incomingQuery, (snapshot) => {
      incoming = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
      onUpdate(incoming, outgoing);
    });
    
    const unsubOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
      outgoing = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
      onUpdate(incoming, outgoing);
    });
    
    return () => {
      unsubIncoming();
      unsubOutgoing();
    };
  };
  // ========================
  // NOTIFICATION FUNCTIONS
  // ========================
  export const createNotification = async (data: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    await addDoc(collection(db, 'notifications'), {
      ...data,
      read: false,
      createdAt: serverTimestamp()
    });
  };
  export const getAvailableCities = async (): Promise<string[]> => {
    if (!isFirebaseConfigured()) return [];
    const snapshot = await getDocs(collection(db, 'profiles'));
    const cityMap = new Map<string, string>();
    snapshot.forEach(doc => {
      const city = doc.data().city;
      if (city && typeof city === 'string') {
        const normalized = city.trim().toLowerCase();
        // preserve first-seen casing
        if (!cityMap.has(normalized)) {
          cityMap.set(normalized, city.trim());
        }
      }
    });
    return Array.from(cityMap.values()).sort((a, b) =>
      a.localeCompare(b)
    );
  };

  export const getAvailableTeamCities = async (): Promise<string[]> => {
  if (!isFirebaseConfigured()) return [];
  const snapshot = await getDocs(collection(db, 'teams'));
  const cityMap = new Map<string, string>();
  snapshot.forEach(doc => {
    const city = doc.data().city;
    if (city && typeof city === 'string') {
      const normalized = city.trim().toLowerCase();
      // preserve first-seen casing
      if (!cityMap.has(normalized)) {
        cityMap.set(normalized, city.trim());
      }
    }
  });
  return Array.from(cityMap.values()).sort((a, b) =>
    a.localeCompare(b)
  );
};

  export const getNotifications = async (userId: string): Promise<Notification[]> => {
    if (!isFirebaseConfigured()) return [];
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
  };
  export const subscribeToNotifications = (
    userId: string,
    onUpdate: (notifications: Notification[]) => void
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      onUpdate(notifications);
    });
  };
  export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  };
  export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map(d => updateDoc(d.ref, { read: true })));
  };
  export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
    if (!isFirebaseConfigured()) return 0;
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  };
  // ========================
  // FEED POST FUNCTIONS
  // ========================
  export const createFeedPost = async (data: Omit<FeedPost, 'id' | 'createdAt'>): Promise<string> => {
    if (!isFirebaseConfigured()) return '';
    const docRef = await addDoc(collection(db, 'posts'), {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  };
  export const createUserPost = async (
    userId: string,
    data: {
      title: string;
      description: string;
      tags?: string[];
      image?: File | null;
    }
  ): Promise<string> => {
    if (!isFirebaseConfigured()) return "";

    const profile = await getProfile(userId);

    let imageUrl: string | null = null;

    // ✅ STEP 1: Upload image to Supabase (if exists)
    if (data.image) {
      try {
        const fileExt = data.image.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        // ✅ Optional: timeout protection (keeps your UI from hanging)
        const uploadWithTimeout = Promise.race([
          supabase.storage
            .from("post-images") // ✅ bucket id
            .upload(filePath, data.image, {
              contentType: data.image.type || "image/jpeg",
              upsert: false,
            }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Image upload timed out. Please try again.")), 20000)
          ),
        ]) as Promise<{ data: any; error: any }>;

        const { error: uploadError } = await uploadWithTimeout;

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicData } = supabase.storage
          .from("post-images") // ✅ bucket id
          .getPublicUrl(filePath);

        imageUrl = publicData.publicUrl;
      } catch (err: any) {
        console.error("Supabase image upload failed:", err);
        throw new Error(err?.message || "Image upload failed. Please try again.");
      }
    }

    // ✅ STEP 2: Save Firestore document
    const docRef = await addDoc(collection(db, "posts"), {
      authorId: userId,
      authorName: profile?.fullName || "User",
      authorAvatar: profile?.avatar,
      authorRole: profile?.primaryRole,
      type: "user_post",
      title: data.title,
      description: data.description,
      tags: data.tags || [],
      imageUrl, // ✅ Supabase public URL
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  };
  export const updatePost = async (
    postId: string,
    userId: string,
    data: {
      title: string;
      description: string;
      tags?: string[];
      image?: File | null;
      removeImage?: boolean;
    }
  ): Promise<void> => {
    if (!isFirebaseConfigured()) return;

    const updateData: any = {
      title: data.title,
      description: data.description,
      tags: data.tags || [],
      updatedAt: serverTimestamp(),
    };

    // ✅ Remove existing image
    if (data.removeImage) {
      updateData.imageUrl = null;
    }

    // ✅ Replace / add new image
    if (data.image) {
      const fileExt = data.image.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images") // 👈 bucket id (case-sensitive)
        .upload(filePath, data.image, {
          contentType: data.image.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicData } = supabase.storage
        .from("post-images")
        .getPublicUrl(filePath);

      updateData.imageUrl = publicData.publicUrl;
    }

    await updateDoc(doc(db, "posts", postId), updateData);
  };
  export const deletePost = async (postId: string): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    await deleteDoc(doc(db, 'posts', postId));
  };
  export const getUserPosts = async (userId: string): Promise<FeedPost[]> => {
    if (!isFirebaseConfigured()) return [];
    const q = query(
      collection(db, 'posts'),
      where('authorId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedPost));
  };
  export const subscribeToUserPosts = (
    userId: string,
    onUpdate: (posts: FeedPost[]) => void
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    const q = query(
      collection(db, 'posts'),
      where('authorId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedPost));
      onUpdate(posts);
    });
  };
  export const getFeedPosts = async (): Promise<FeedPost[]> => {
    if (!isFirebaseConfigured()) return [];
    const q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedPost));
  };
  export const subscribeToFeedPosts = (
    onUpdate: (posts: FeedPost[]) => void,
    currentUserId?: string
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    const q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    return onSnapshot(q, async (snapshot) => {
      let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedPost));
      
      if (currentUserId) {
        try {
          const hiddenUsers = await getHiddenUsers(currentUserId);
          posts = posts.filter(post => !hiddenUsers.has(post.authorId));
        } catch (error) {
          console.error('Error fetching hidden users:', error);
        }
      }
      
      onUpdate(posts);
    }, (error) => {
      console.error('Feed subscription error:', error);
      onUpdate([]);
    });
  };
  // ========================
  // WORKSPACE LOG FUNCTIONS
  // ========================
  export const addWorkspaceLog = async (teamId: string, userId: string, userName: string, message: string): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    await addDoc(collection(db, 'workspaceLogs'), {
      teamId,
      userId,
      userName,
      message,
      createdAt: serverTimestamp()
    });
  };
  export const getWorkspaceLogs = async (teamId: string): Promise<WorkspaceLog[]> => {
    if (!isFirebaseConfigured()) return [];
    const q = query(
      collection(db, 'workspaceLogs'),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkspaceLog));
  };
  export const subscribeToWorkspaceLogs = (
    teamId: string,
    onUpdate: (logs: WorkspaceLog[]) => void
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    const q = query(
      collection(db, 'workspaceLogs'),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkspaceLog));
      onUpdate(logs);
    });
  };
  // ========================
  // TEAM TASK FUNCTIONS
  // ========================
  export const createTeamTask = async (
    teamId: string, 
    data: { title: string; assignedTo: string[]; completed: boolean }
  ): Promise<string> => {
    if (!isFirebaseConfigured()) return '';
    const docRef = await addDoc(collection(db, 'teamTasks'), {
      teamId,
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  };
  export const getTeamTasks = async (teamId: string): Promise<TeamTask[]> => {
    if (!isFirebaseConfigured()) return [];
    const q = query(
      collection(db, 'teamTasks'),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamTask));
  };
  export const updateTeamTask = async (
    taskId: string,
    data: Partial<Pick<TeamTask, 'title' | 'assignedTo'>>
  ): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    await updateDoc(doc(db, 'teamTasks', taskId), data);
  };
  export const subscribeToTeamTasks = (
    teamId: string,
    onUpdate: (tasks: TeamTask[]) => void
  ) => {
    const q = query(
      collection(db, 'teamTasks'),
      where('teamId', '==', teamId)
    );
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as TeamTask),
      }));
      onUpdate(tasks);
    }, (error) => {
      console.error('Team tasks subscription error:', error);
      onUpdate([]);
    });
  };
  export const updateTaskCompletion = async (
    taskId: string, 
    completed: boolean, 
    completedBy: string
  ): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    await updateDoc(doc(db, 'teamTasks', taskId), { 
      completed, 
      completedBy: completed ? completedBy : null,
      completedAt: completed ? serverTimestamp() : null
    });
  };
  export const deleteTeamTask = async (taskId: string): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    await deleteDoc(doc(db, 'teamTasks', taskId));
  };
  // ========================
  // STATS FUNCTIONS
  // ========================
  export const getAvailableUsersCount = async (): Promise<number> => {
    if (!isFirebaseConfigured()) return 0;
    const snapshot = await getDocs(collection(db, 'profiles'));
    return snapshot.size;
  };
  export const getAvailableTeamsCount = async (): Promise<number> => {
    if (!isFirebaseConfigured()) return 0;
    const q = query(collection(db, 'teams'), where('status', '==', 'forming'));
    const snapshot = await getDocs(q);
    return snapshot.size;
  };
  // ========================
  // MESSAGING FUNCTIONS
  // ========================
  export const getOrCreateConversation = async (
  user1Id: string,
  user2Id: string
): Promise<string> => {
  if (!isFirebaseConfigured()) return '';
  
  // ✅ CHECK IF BLOCKED
  const blocked = await isBlocked(user1Id, user2Id);
  if (blocked) {
    throw new Error('Cannot message blocked user');
  }
  
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', user1Id)
  );
  
  const snapshot = await getDocs(q);
  const existing = snapshot.docs.find(doc => {
    const data = doc.data();
    return data.participants.includes(user2Id);
  });
  
  if (existing) {
    return existing.id;
  }
  
  const [profile1, profile2] = await Promise.all([
    getProfile(user1Id),
    getProfile(user2Id)
  ]);
  
  const docRef = await addDoc(collection(db, 'conversations'), {
    participants: [user1Id, user2Id],
    participantNames: {
      [user1Id]: profile1?.fullName || 'User',
      [user2Id]: profile2?.fullName || 'User'
    },
    participantAvatars: {
      [user1Id]: profile1?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${profile1?.fullName || 'User'}`,
      [user2Id]: profile2?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${profile2?.fullName || 'User'}`
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return docRef.id;
};
  export const sendMessage = async (
    conversationId: string,
    senderId: string,
    text: string
  ): Promise<string> => {
    if (!isFirebaseConfigured()) return '';
    const senderProfile = await getProfile(senderId);
    const convSnap = await getDoc(doc(db, 'conversations', conversationId));
    if (!convSnap.exists()) {
      throw new Error('Conversation not found');
    }
    const conversationData = convSnap.data();
    const { participants } = conversationData;
    
    const messageRef = await addDoc(collection(db, 'messages'), {
      conversationId,
      participants,
      senderId,
      senderName: senderProfile?.fullName || 'User',
      text,
      read: false,
      createdAt: serverTimestamp()
    });
    
    await updateDoc(doc(db, 'conversations', conversationId), {
      lastMessage: {
        text,
        senderId,
        sentAt: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    });
    
    const recipientId = participants.find((id: string) => id !== senderId);
    
    if (recipientId) {
      await createNotification({
        toUserId: recipientId,
        fromUserId: senderId,
        fromUserName: senderProfile?.fullName || 'User',
        type: 'MESSAGE',
        message: text.length > 50 ? text.substring(0, 50) + '...' : text,
        conversationId
      });
    }
    
    return messageRef.id;
  };

  export const subscribeToProfile = (
  userId: string,
  onUpdate: (profile: UserProfile | null) => void
) => {
  if (!isFirebaseConfigured()) return () => {};

  const ref = doc(db, 'profiles', userId);

  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      onUpdate(null);
      return;
    }
    onUpdate({ id: snap.id, ...snap.data() } as UserProfile);
  });
};

  export const uploadProfilePicture = async (
  userId: string,
  file: File
) => {
  // ✅ CORRECT PATH (NO DOUBLE avatars)
  const filePath = userId;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });

  if (error) {
    console.error('Supabase upload error:', error);
    throw error;
  }

  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // ✅ SAVE URL TO FIRESTORE (SOURCE OF TRUTH)
  await updateDoc(doc(db, 'profiles', userId), {
    avatar: data.publicUrl,
    updatedAt: serverTimestamp()
  });

  return data.publicUrl;
};

  export const deleteUserCompletely = async (userId: string) => {
    // 1. Get profile
    const profileRef = doc(db, 'profiles', userId);
    const profileSnap = await getDocs(query(collection(db, 'profiles'), where('__name__', '==', userId)));
    const profile = profileSnap.docs[0]?.data();
    if (!profile) return;
    // 2. Handle team
    if (profile.teamId) {
      const teamRef = doc(db, 'teams', profile.teamId);
      const teamSnap = await getDocs(query(collection(db, 'teams'), where('__name__', '==', profile.teamId)));
      const team = teamSnap.docs[0]?.data();
      if (team?.leaderId === userId) {
        // Delete team
        await deleteDoc(teamRef);
      } else {
        // Remove member
        const updatedMembers = team.members.filter((m: any) => m.userId !== userId);
        await updateDoc(teamRef, { members: updatedMembers });
      }
    }
    // 3. Delete user's posts
    const postsSnap = await getDocs(
      query(collection(db, 'posts'), where('authorId', '==', userId))
    );
    for (const docu of postsSnap.docs) {
      await deleteDoc(docu.ref);
    }
    // 4. Delete profile
    await deleteDoc(profileRef);
  };
  export const subscribeToConversations = (
    userId: string,
    onUpdate: (conversations: Conversation[]) => void
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const conversations = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Conversation));
      onUpdate(conversations);
    }, (error) => {
      console.error('Conversations subscription error:', error);
      onUpdate([]);
    });
  };
  export const subscribeToMessages = (
    conversationId: string,
    onUpdate: (messages: Message[]) => void
  ): Unsubscribe => {
    if (!isFirebaseConfigured()) return () => {};
    
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Message));
      onUpdate(messages);
    }, (error) => {
      console.error('Messages subscription error:', error);
      onUpdate([]);
    });
  };
  export const markMessagesAsRead = async (
    conversationId: string,
    userId: string
  ): Promise<void> => {
    if (!isFirebaseConfigured()) return;
    
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(q);
    const updates = snapshot.docs
      .filter(d => d.data().senderId !== userId)
      .map(d => updateDoc(d.ref, { read: true }));
    
    await Promise.all(updates);
  };
  export const getUnreadMessageCount = async (userId: string): Promise<number> => {
    if (!isFirebaseConfigured()) return 0;
    
    const convQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId)
    );
    const convSnapshot = await getDocs(convQuery);
    const conversationIds = convSnapshot.docs.map(d => d.id);
    
    if (conversationIds.length === 0) return 0;
    
    let totalUnread = 0;
    
    for (const convId of conversationIds) {
      const msgQuery = query(
        collection(db, 'messages'),
        where('conversationId', '==', convId),
        where('read', '==', false)
      );
      const msgSnapshot = await getDocs(msgQuery);
      totalUnread += msgSnapshot.docs.filter(d => d.data().senderId !== userId).length;
    }
    
    return totalUnread;
  };
  // ========================
  // GITHUB VERIFICATION FUNCTIONS
  // ========================
  // ========================
// GITHUB VERIFICATION FUNCTIONS
// ========================

/**
 * Fetch GitHub user statistics using the GitHub API
 * @param username - GitHub username to fetch stats for
 * @param accessToken - GitHub OAuth access token
 * @returns GitHub stats object with publicRepos, followers, following
 * @throws Error if the fetch fails
 */
export const fetchGitHubStats = async (
  username: string,
  accessToken: string
): Promise<{ publicRepos: number; followers: number; following: number }> => {
  const response = await fetch(`https://api.github.com/users/${username}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[fetchGitHubStats] Failed:', response.status, errorText);
    throw new Error(`Failed to fetch GitHub stats: ${response.status}`);
  }

  const data = await response.json();

  return {
    publicRepos: data.public_repos ?? 0,
    followers: data.followers ?? 0,
    following: data.following ?? 0,
  };
};
  // ========================
  // USERNAME FUNCTIONS
  // ========================
  export const isUsernameAvailable = async (username: string, excludeUserId?: string): Promise<boolean> => {
    if (!isFirebaseConfigured()) return true;
    if (!username) return false;
    
    const normalizedUsername = username.toLowerCase();
    
    const q = query(
      collection(db, 'profiles'),
      where('username', '==', normalizedUsername)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return true;
    
    if (excludeUserId) {
      return snapshot.docs.every(doc => doc.id === excludeUserId);
    }
    
    return false;
  };
  export const getUserEmailByUsername = async (username: string): Promise<string | null> => {
    if (!isFirebaseConfigured()) return null;
    
    const normalizedUsername = username.toLowerCase().replace('@', '');
    
    const q = query(
      collection(db, 'profiles'),
      where('username', '==', normalizedUsername),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const profile = snapshot.docs[0].data();
    return profile.email || null;
  };
  export const generateUniqueUsername = async (fullName: string): Promise<string> => {
    if (!isFirebaseConfigured()) return '';
    
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const username = generateUsernameFromName(fullName);
      const normalizedUsername = username.toLowerCase();
      
      const isAvailable = await isUsernameAvailable(normalizedUsername);
      
      if (isAvailable && isValidUsername(normalizedUsername)) {
        return normalizedUsername;
      }
      
      attempts++;
    }
    
    const fallback = `user${Date.now().toString(36)}`;
    return fallback;
  };
  export const updateUsername = async (userId: string, newUsername: string): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
    
    const normalizedUsername = newUsername.toLowerCase();
    
    if (!isValidUsername(normalizedUsername)) {
      return { success: false, error: 'Invalid username format' };
    }
    
    const isAvailable = await isUsernameAvailable(normalizedUsername, userId);
    if (!isAvailable) {
      return { success: false, error: 'Username is already taken' };
    }
    
    await updateDoc(doc(db, 'profiles', userId), {
      username: normalizedUsername,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  };
  export const ensureUserHasUsername = async (userId: string): Promise<string | null> => {
    if (!isFirebaseConfigured()) return null;
    
    const profile = await getProfile(userId);
    if (!profile) return null;
    
    if (profile.username) {
      return profile.username;
    }
    
    const username = await generateUniqueUsername(profile.fullName || 'User');
    
    await updateDoc(doc(db, 'profiles', userId), {
      username,
      updatedAt: serverTimestamp()
    });
    
    return username;
  };
  export const getProfileByUsername = async (username: string): Promise<UserProfile | null> => {
    if (!isFirebaseConfigured()) return null;
    
    const normalizedUsername = username.toLowerCase();
    
    const q = query(
      collection(db, 'profiles'),
      where('username', '==', normalizedUsername),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as UserProfile;
  };

  export const declareTeamComplete = async (
  teamId: string,
  userId: string
) => {
  const teamRef = doc(db, 'teams', teamId);

  await updateDoc(teamRef, {
    status: 'complete',
    completedAt: serverTimestamp(),
    completedBy: userId
  });
};

  export interface TeamWithMembers extends Team {
    loadedMembers: (TeamMember & {
      profile: UserProfile | null;
    })[];
  }

  export async function fetchLatestGitHubVerification(userId: string) {
  const q = query(
    collection(db, 'skillVerifications'),
    where('userId', '==', userId),
    where('sources.github.oauthVerified', '==', true),
    orderBy('verifiedAt', 'desc'),
    limit(1)
  );

  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].data();
}

