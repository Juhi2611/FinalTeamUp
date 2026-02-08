import { useEffect, useState } from 'react';
import { TeamWithMembers } from '@/services/firestore';
import { subscribeToTeamTasks, removeTeamMember, TeamTask } from '@/services/firestore';

interface Props {
  team: TeamWithMembers;
  currentUserId: string;
  isLeader: boolean;
  onClose: () => void;
}

export default function TeamManagementPanel({
  team,
  currentUserId,
  isLeader,
  onClose,
}: Props) {
  // All team tasks (for activity %)
  const [tasks, setTasks] = useState<TeamTask[]>([]);

  // Member selected for removal (confirmation modal)
  const [memberToRemove, setMemberToRemove] = useState<
    (typeof team.loadedMembers)[0] | null
  >(null);

  // Subscribe to team tasks
  useEffect(() => {
    const unsubscribe = subscribeToTeamTasks(team.id, setTasks);
    return () => unsubscribe();
  }, [team.id]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <h2 className="text-xl font-bold">Team Management</h2>

      {/* TEAM MEMBERS */}
      <div>
        <h3 className="font-medium mb-3">Team Members</h3>

        {team.loadedMembers.map(member => {
          // Calculate activity %
          const memberTasks = tasks.filter(task =>
            task.assignedTo.includes(member.userId)
          );
          const completedTasks = memberTasks.filter(t => t.completed).length;

          const activity =
            memberTasks.length > 0
              ? Math.round((completedTasks / memberTasks.length) * 100)
              : 0;

          const isTeamLeader = member.userId === team.leaderId;

          return (
            <div
              key={member.userId}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-3">
                <img
                  src={member.profile?.avatar}
                  alt={member.profile?.fullName}
                  className="w-9 h-9 rounded-full"
                />

                <div>
                  <p className="font-medium">
                    {member.profile?.fullName}
                    {isTeamLeader && ' (Leader)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Activity: {activity}%
                  </p>
                </div>
              </div>

              {/* LEADER-ONLY REMOVE BUTTON */}
              {isLeader && member.userId !== team.leaderId && (
                <button
                    onClick={() => setMemberToRemove(member)}
                    className="btn-secondary text-destructive text-sm"
                >
                    Remove
                </button>
                )}
            </div>
          );
        })}
      </div>

      {/* RECENTLY LEFT MEMBERS */}
      {team.recentlyLeft && team.recentlyLeft.length > 0 && (
        <div>
          <h3 className="font-medium mb-3">Recently Left Members</h3>

          {team.recentlyLeft
            .slice(-5)
            .reverse()
            .map((user, index) => (
              <div
                key={index}
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <img
                  src={user.avatar}
                  className="w-8 h-8 rounded-full"
                />
                <span>{user.name}</span>
              </div>
            ))}
        </div>
      )}

      {/* CLOSE BUTTON */}
      <div className="flex justify-end">
        <button onClick={onClose} className="btn-secondary">
          Close
        </button>
      </div>

      {/* CONFIRM REMOVE MODAL (ONE ONLY) */}
      {memberToRemove && (
        <div
          className="modal-overlay"
          onClick={() => setMemberToRemove(null)}
        >
          <div
            className="modal-content max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-2">
              Remove {memberToRemove.profile?.fullName}?
            </h3>

            <p className="text-muted-foreground mb-4">
              This member will be removed from the team immediately.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMemberToRemove(null)}
                className="btn-secondary"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  await removeTeamMember(
                    team.id,
                    memberToRemove.userId,
                    memberToRemove.profile || undefined
                  );
                  setMemberToRemove(null);
                }}
                className="btn-primary bg-destructive hover:bg-destructive/90"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
