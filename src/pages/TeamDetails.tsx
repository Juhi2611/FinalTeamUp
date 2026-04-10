import { useParams } from "react-router-dom";

const TeamDetails = () => {
  const { teamId } = useParams<{ teamId: string }>();

  if (!teamId) {
    return <p className="text-center mt-10">Team not found</p>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Team Workspace</h1>
      <p className="text-muted-foreground mt-2">
        Team ID: <span className="font-mono">{teamId}</span>
      </p>

      {/* Later: fetch team, show chat, tasks, progress, AI tools */}
    </div>
  );
};

export default TeamDetails;
