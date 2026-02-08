import { useState, useEffect } from "react";
import { Zap, Menu, X, Bell } from "lucide-react";
import LeftSidebar from "../components/LeftSidebar";
import RightSidebar from "../components/RightSidebar";
import HomeFeed from "../components/pages/HomeFeed";
import BuildTeam from "../components/pages/BuildTeam";
import DiscoverPeople from "../components/pages/DiscoverPeople";
import DiscoverTeams from "../components/pages/DiscoverTeams";
import { AnimatePresence, motion } from "framer-motion";
import EditTeam from "@/components/pages/EditTeam";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import MyTeams from "../components/pages/MyTeams";
import Profile from "../components/pages/Profile";
import Notifications from "../components/pages/Notifications";
import TeamWorkspace from "../components/pages/TeamWorkspace";
import Auth from "../components/pages/Auth";
import ProfileSetup from "../components/pages/ProfileSetup";
import SkillVerificationModal from "@/components/skill-verification/SkillVerificationModal";
import Messages from "@/components/pages/Messages";
import { useAuth } from "../contexts/AuthContext";
import {
  getProfile,
  subscribeToNotifications,
  getOrCreateConversation,
  UserProfile,
  Notification,
} from "../services/firestore";
import { isFirebaseConfigured } from "../lib/firebase";
import { useSidebarState } from "../hooks/useSidebarState";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import LogoBar from "@/components/landing/LogoBar";
import Features from "@/components/landing/Features";
import WhyChooseUs from "@/components/landing/WhyChooseUs";
import FAQ from "@/components/landing/FAQ";
import Newsletter from "@/components/landing/ContactUs";
import Footer from "@/components/landing/Footer";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();

  const [currentPage, setCurrentPage] = useState("feed");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  const [showEntry, setShowEntry] = useState(true);
  const [forceAuth, setForceAuth] = useState(false);

  const { leftCollapsed, rightCollapsed, toggleLeft, toggleRight } =
    useSidebarState();

  useEffect(() => {
    let hasInteracted = false;

    const markInteracted = () => {
      hasInteracted = true;
    };

    window.addEventListener("click", markInteracted);
    window.addEventListener("keydown", markInteracted);

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasInteracted) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("click", markInteracted);
      window.removeEventListener("keydown", markInteracted);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  useEffect(() => {
    if (user && isFirebaseConfigured()) {
      checkProfile();

      const unsubscribe = subscribeToNotifications(user.uid, (notifications) => {
        const unread = notifications.filter((n) => !n.read).length;
        setUnreadCount(unread);
      });

      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    const savedPage = localStorage.getItem("teamup:lastPage");

    const path = window.location.pathname.replace("/", "");
    const pageFromUrl = path || "feed";

    const pageToLoad = savedPage || pageFromUrl;

    setCurrentPage(pageToLoad);

    window.history.replaceState(
      { page: pageToLoad },
      "",
      pageToLoad === "feed" ? "/" : `/${pageToLoad}`
    );
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const page = event.state?.page || "feed";

      setCurrentPage(page);
      setSelectedUserId(null);
      setSelectedTeamId(null);
      setEditingProfile(false);
      setActiveConversationId(null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const checkProfile = async () => {
    if (!user) return;

    const { ensureUserHasUsername } = await import("@/services/firestore");
    await ensureUserHasUsername(user.uid);

    const userProfile = await getProfile(user.uid);

    if (!userProfile) {
      await logout();
      toast.error("Account not found or email not registered yet");
      return;
    }

    if (!userProfile.primaryRole) {
      setNeedsProfileSetup(true);
      return;
    }

    setProfile(userProfile);
    setNeedsProfileSetup(false);
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    setSelectedUserId(null);
    setSelectedTeamId(null);
    setMobileMenuOpen(false);
    setEditingProfile(false);
    setActiveConversationId(null);

    localStorage.setItem("teamup:lastPage", page);

    window.history.pushState(
      { page },
      "",
      page === "feed" ? "/" : `/${page}`
    );
  };

  const handleViewProfile = (userId: string) => {
    setSelectedUserId(userId);
    setCurrentPage("viewProfile");
  };

  const handleMessageUser = async (targetUserId: string) => {
    if (!user) return;

    try {
      const conversationId = await getOrCreateConversation(user.uid, targetUserId);
      setActiveConversationId(conversationId);
      setCurrentPage("messages");
    } catch (error) {
      console.error("Error starting conversation:", error);
      toast.error("Failed to start conversation");
    }
  };

  const handleNavigateToMessages = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setCurrentPage("messages");
  };

  const handleViewWorkspace = (teamId: string) => {
    setSelectedTeamId(teamId);
    setCurrentPage("workspace");
  };

  const handleEditProfile = () => {
    setEditingProfile(true);
  };

  const handleOpenVerification = () => {
    setShowVerificationModal(true);
  };

  const handleVerificationComplete = () => {
    setShowVerificationModal(false);
    checkProfile();
  };

  // 1️⃣ PUBLIC ENTRY
  if (showEntry && !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header
          onGetStarted={() => {
            setShowEntry(false);
            setForceAuth(true);
          }}
        />
        <Hero />
        <LogoBar />
        <Features />
        <WhyChooseUs />
        <FAQ />
        <Newsletter />
        <Footer />
      </div>
    );
  }

  // 2️⃣ AUTH SCREEN
  if ((forceAuth || !showEntry) && isFirebaseConfigured() && !authLoading && !user) {
    return <Auth onAuthSuccess={() => setForceAuth(false)} />;
  }

  // 3️⃣ LOADING
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary/80 w-fit mx-auto mb-4">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // 4️⃣ PROFILE SETUP
  if ((needsProfileSetup || editingProfile) && user) {
    return (
      <ProfileSetup
        existingProfile={editingProfile ? profile : null}
        onComplete={() => {
          setNeedsProfileSetup(false);
          setEditingProfile(false);
          checkProfile();
        }}
        onOpenVerification={handleOpenVerification}
      />
    );
  }

  if (isFirebaseConfigured() && !authLoading && !user) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary/80 w-fit mx-auto mb-4">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if ((needsProfileSetup || editingProfile) && user) {
    return (
      <ProfileSetup
        existingProfile={editingProfile ? profile : null}
        onComplete={() => {
          setNeedsProfileSetup(false);
          setEditingProfile(false);
          checkProfile();
        }}
        onOpenVerification={handleOpenVerification}
      />
    );
  }

  const renderContent = () => {
    switch (currentPage) {
      case "feed":
        return <HomeFeed onNavigate={handleNavigate} onViewProfile={handleViewProfile} />;

      case "build":
        return <BuildTeam onNavigate={handleNavigate} />;

      case "discover":
        return <DiscoverPeople onViewProfile={handleViewProfile} />;

      case "discover-teams":
        return <DiscoverTeams onNavigate={handleNavigate} />;

      case "teams":
        return (
          <MyTeams
            onNavigate={handleNavigate}
            onViewWorkspace={handleViewWorkspace}
            onViewProfile={handleViewProfile}
          />
        );

      case "notifications":
        return (
          <Notifications
            onNavigateToMessages={handleNavigateToMessages}
            onViewProfile={handleViewProfile}
          />
        );

      case "profile":
        return (
          <Profile
            isOwnProfile={true}
            userProfile={profile}
            onEditProfile={handleEditProfile}
            onOpenVerification={handleOpenVerification}
            onProfileUpdated={(updatedProfile) => {
              setProfile(updatedProfile);
            }}
          />
        );

      case "viewProfile":
        return (
          <Profile
            userId={selectedUserId || undefined}
            isOwnProfile={false}
            onMessage={handleMessageUser}
          />
        );

      case "messages":
        return (
          <Messages
            initialConversationId={activeConversationId}
            onBack={() => handleNavigate("feed")}
            onViewProfile={handleViewProfile}
          />
        );

      case "workspace":
        return (
          <TeamWorkspace
            teamId={selectedTeamId || ""}
            onBack={() => handleNavigate("teams")}
          />
        );

      default:
        return <HomeFeed onNavigate={handleNavigate} onViewProfile={handleViewProfile} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div
            onClick={() => handleNavigate("feed")}
            className="flex items-center gap-2 cursor-pointer select-none hover:opacity-80 transition"
          >
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/80">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">
              TeamUp
            </span>
          </div>

          <div className="hidden md:flex flex-1 max-w-md mx-8"></div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNavigate("notifications")}
              className="p-2 rounded-lg hover:bg-secondary transition-colors relative"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {user && (
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Logout
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-foreground" />
              ) : (
                <Menu className="w-5 h-5 text-foreground" />
              )}
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-background/95 backdrop-blur-sm md:hidden pt-16">
          <div className="p-4">
            <LeftSidebar
              currentPage={currentPage}
              onNavigate={handleNavigate}
              userProfile={profile}
            />
          </div>
        </div>
      )}

      <div className="max-w-8xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          <div className="hidden md:block">
            <div className="sticky top-24">
              <LeftSidebar
                currentPage={currentPage}
                onNavigate={handleNavigate}
                userProfile={profile}
                collapsed={leftCollapsed}
                onToggleCollapse={toggleLeft}
              />
            </div>
          </div>

          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="h-full"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </main>

          <div className="hidden lg:block">
            <div className="sticky top-24">
              <RightSidebar
                onViewProfile={handleViewProfile}
                onNavigate={handleNavigate}
                collapsed={rightCollapsed}
                onToggleCollapse={toggleRight}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Skill Verification Modal */}
      {showVerificationModal && user && profile && (
        <SkillVerificationModal
          open={showVerificationModal}
          onOpenChange={setShowVerificationModal}
          userSkills={profile.skills.map((skill) => skill.name)}
          onVerificationComplete={handleVerificationComplete}
        />
      )}

      {/* Logout Confirm Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="bg-card rounded-xl shadow-lg w-full max-w-sm p-6"
          >
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Confirm Logout
            </h2>

            <p className="text-sm text-muted-foreground mb-6">
              Do you really want to exit TeamUp?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm bg-secondary text-foreground hover:bg-secondary/80 transition"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  try {
                    setShowLogoutConfirm(false);
                    await logout();

                    setCurrentPage("feed");
                    localStorage.removeItem("teamup:lastPage");

                    window.location.href = "/";
                  } catch (err) {
                    console.error(err);
                    toast.error("Failed to logout");
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 transition"
              >
                Logout
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Index;
