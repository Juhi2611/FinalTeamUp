// pages/ProfilePage.tsx
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Profile from "@/components/pages/Profile";

const ProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();

  const isOwnProfile = userId === user?.uid;

  return (
    <div className="min-h-screen bg-background p-6">
      <Profile userId={userId} isOwnProfile={isOwnProfile} />
    </div>
  );
};

export default ProfilePage;
