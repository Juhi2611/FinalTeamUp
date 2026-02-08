import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { subscribeToProfile, UserProfile } from "@/services/firestore";
import { isFirebaseConfigured } from "@/lib/firebase";

interface UserProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
}

const UserProfileContext = createContext<UserProfileContextType>({
  profile: null,
  loading: true,
});

export const UserProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToProfile(user.uid, (updatedProfile) => {
      setProfile(updatedProfile);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <UserProfileContext.Provider value={{ profile, loading }}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => useContext(UserProfileContext);
