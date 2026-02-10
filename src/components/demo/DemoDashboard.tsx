const DemoDashboard = () => {
  return (
    <div className="min-h-screen bg-background p-6 space-y-4">

      <h1 className="text-2xl font-bold">TeamUp Demo Mode</h1>

      <div className="card-base p-4">
        👥 Team: Space Coders  
        <p className="text-muted-foreground text-sm">
          Building an AI productivity app
        </p>
      </div>

      <div className="card-base p-4">
        📢 Post: Looking for Backend Developer!
      </div>

      <div className="card-base p-4">
        🔔 Notification: You were invited to join Space Coders
      </div>

      <div className="opacity-60 text-sm mt-6">
        Demo mode — actions are disabled. Sign up to participate.
      </div>

    </div>
  );
};

export default DemoDashboard;
