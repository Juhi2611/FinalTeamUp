import { useState, useEffect } from "react";
import { Zap, Menu, X, Bell, Search, ChevronDown } from "lucide-react";
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
import SettingsPage from '../components/pages/SettingsPage';
import MyTeams from "../components/pages/MyTeams";
import Profile from "../components/pages/Profile";
import Notifications from "../components/pages/Notifications";
import TeamWorkspace from "../components/pages/TeamWorkspace";
import Auth from "../components/pages/Auth";
import ProfileSetup from "../components/pages/ProfileSetup";
import SkillVerificationModal from "@/components/skill-verification/SkillVerificationModal";
import Messages from "@/components/pages/Messages";
import { useAuth } from "../contexts/AuthContext";
import { ProductWalkthrough } from "@/components/walkthrough/ProductWalkthrough";
import { walkthroughPages } from "@/components/walkthrough/WalkthroughSteps";
import { HelpCircle } from "lucide-react";

import { PerksBadge } from '@/components/PerksBadge';
import PerksStatusCard from '@/components/PerksStatusCard';
import LeaderboardPage from '@/components/pages/LeaderboardPage';
import { Trophy } from "lucide-react";
import AdminPanel from "@/components/pages/AdminPanel";
import { useLocation, useParams } from "react-router-dom";
import TeamDashboard from "@/components/pages/TeamDashboard";
import {
  getProfile,
  subscribeToNotifications,
  getOrCreateConversation,
  UserProfile,
  Notification,
} from "../services/firestore";
import UploadPage from "@/components/pages/UploadPage";
import { isFirebaseConfigured } from "../lib/firebase";
// sidebar collapse removed — fixed-width layout
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import LogoBar from "@/components/landing/LogoBar";
import Features from "@/components/landing/Features";
import WhyChooseUs from "@/components/landing/WhyChooseUs";
import FAQ from "@/components/landing/FAQ";
import Newsletter from "@/components/landing/ContactUs";
import Footer from "@/components/landing/Footer";
import LegalModal from "@/components/LegalModal";
import FeedbackPopup from "@/components/FeedbackPopup";
import InterviewDashboard from "@/components/interviews/InterviewDashboard";
import InterviewRouter from "@/components/interviews/InterviewRouter";
import { InterviewRequest } from "@/services/firestore_interviews";
import { Settings } from "lucide-react";
const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout, isDemoUser } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [currentPage, setCurrentPage] = useState("feed");
  const [showLegal, setShowLegal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const location = useLocation();

  const isDashboard = location.pathname.includes("/dashboard");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  const [showEntry, setShowEntry] = useState(true);
  const [forceAuth, setForceAuth] = useState(false);
  const [signupData, setSignupData] = useState<{ name?: string; username?: string } | null>(null);
  const [activeInterview, setActiveInterview] = useState<InterviewRequest | null>(null);
  const [activeWalkthrough, setActiveWalkthrough] = useState<{ pageId: string, steps: any[] } | null>(null);

  const openAuth = (mode: "login" | "signup" = "login") => {
    setAuthMode(mode);
    setShowEntry(false);
    setForceAuth(true);
  };

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
    // Only scroll to top if we AREN'T going back to a discovery/feed state
    const maintainPositionPages = ["feed", "discover", "discover-teams"];
    
    if (!maintainPositionPages.includes(currentPage)) {
      window.scrollTo(0, 0);
    }
  }, [currentPage]);

  useEffect(() => {
    if (user && isFirebaseConfigured()) {
      checkProfile();

      // Subscribe to notifications for unread count
      const unsubscribe = subscribeToNotifications(user.uid, (notifications) => {
        const unread = notifications.filter((n) => !n.read).length;
        setUnreadCount(unread);
      });

      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (user && profile && !authLoading && currentPage && !isDemoUser) {
      // Check if this specific page walkthrough has been completed
      const pageId = currentPage === "feed" ? "feed" : currentPage;
      const steps = walkthroughPages[pageId];
      
      if (steps) {
        const key = `teamup:walkthrough_${pageId}_${user.uid}`;
        const hasCompleted = localStorage.getItem(key);
        
        if (!hasCompleted) {
          const timer = setTimeout(() => {
            setActiveWalkthrough({ pageId, steps });
          }, 1500);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [user, profile, authLoading, currentPage]);

  const handleReplayWalkthrough = () => {
    const pageId = currentPage === "feed" ? "feed" : currentPage;
    const steps = walkthroughPages[pageId];
    if (steps) {
      setActiveWalkthrough({ pageId, steps });
    } else {
      toast.info("No tour available for this page");
    }
  };

  useEffect(() => {
    window.addEventListener('teamup:replay_walkthrough', handleReplayWalkthrough);
    return () => window.removeEventListener('teamup:replay_walkthrough', handleReplayWalkthrough);
  }, [currentPage]);

  useEffect(() => {
    const savedPage = localStorage.getItem("teamup:lastPage");

    const path = window.location.pathname.replace("/", "");

    // 🔥 CLEAN BOTH VALUES
    const cleanSavedPage = savedPage?.replace("/", "");
    const cleanPath = path.replace("/", "");

    const pageToLoad = cleanSavedPage || cleanPath || "feed";

    setCurrentPage(pageToLoad);

    // keep browser history in sync on refresh / direct URL
    const safePage = pageToLoad.replace("/", "");

    window.history.replaceState(
      { page: safePage },
      "",
      safePage === "feed" ? "/" : `/${safePage}`
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

    // Profile missing entirely — could be a fresh OAuth user whose profile creation failed,
    // OR a deleted account. For OAuth users, send to profile setup; otherwise force logout.
    if (!userProfile) {
      // Check if user signed in via OAuth (has a provider beyond 'password')
      const isOAuthUser = user.providerData?.some(
        (p) => p.providerId === 'google.com' || p.providerId === 'github.com'
      );

      if (isOAuthUser) {
        // 🔥 Skeleton profile so sidebar looks good immediately
        setProfile({
          id: user.uid,
          fullName: user.displayName || 'User',
          email: user.email || '',
          avatar: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || 'User')}`,
          profileCompleted: false, // Useful flag if needed
        } as any);

        // OAuth user with no profile — let them set up their profile
        setNeedsProfileSetup(true);
        setSignupData({
          name: user.displayName || undefined,
          username: undefined,
        });
        return;
      }

      await logout();
      toast.error("Account not found or email not registered yet");
      return;
    }

    if (!userProfile.primaryRole) {
      // Still set the profile so sidebar shows info while finishing role selection
      setProfile(userProfile);
      setNeedsProfileSetup(true);
      return;
    }

    setProfile(userProfile);
    setNeedsProfileSetup(false);
  };

  const handleNavigate = (page: string) => {
    const cleanPage = page.replace("/", ""); // ✅ FIX

    setCurrentPage(cleanPage);
    setSelectedUserId(null);
    setSelectedTeamId(null);
    setMobileMenuOpen(false);
    setEditingProfile(false);
    setActiveConversationId(null);

    localStorage.setItem("teamup:lastPage", cleanPage);

    window.history.pushState(
      { page: cleanPage },
      "",
      cleanPage === "feed" ? "/" : `/${cleanPage}`
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
    checkProfile(); // Refresh profile to show verified status
    // Dispatch feedback trigger
    window.dispatchEvent(new CustomEvent('teamup:feedback_trigger', { detail: { type: 'skill_verified' } }));
  };

  // 1️⃣ PUBLIC ENTRY (landing page)
  if (showEntry && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header
          onGetStarted={() => {
            setAuthMode("login"); // 👈 IMPORTANT
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

  // 2️⃣ AUTH SCREEN (only after Get Started)
  if (forceAuth && isFirebaseConfigured() && !authLoading) {
    return (
      <Auth
        defaultMode={authMode}
        onAuthSuccess={(data) => {  // ✅ CAPTURE THE DATA
          setForceAuth(false);
          if (data) {
            setSignupData(data);  // ✅ STORE IT
          }
        }}
      />
    );
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
  if ((needsProfileSetup || editingProfile) && user && !isDemoUser) {
    return (
      <ProfileSetup
        existingProfile={editingProfile ? profile : null}
        initialName={signupData?.name}        // ✅ PASS NAME
        initialUsername={signupData?.username} // ✅ PASS USERNAME
        onComplete={() => {
          setNeedsProfileSetup(false);
          setEditingProfile(false);
          setSignupData(null);  // ✅ CLEAR AFTER USE
          checkProfile();
        }}
        onSkip={() => {
          setNeedsProfileSetup(false);
          handleNavigate('feed');
        }}
        onOpenVerification={handleOpenVerification}
      />
    );
  }

  // Show auth if not logged in (only when Firebase is configured)
  // if (isFirebaseConfigured() && !authLoading && !user) {
  //   return <Auth onAuthSuccess={() => {}} />;
  // }

  const renderContent = () => {
    switch (currentPage) {
      case "feed":
        return (
          <div className="space-y-4">
            {user && profile && (
              <PerksStatusCard
                profile={profile}
                onViewLeaderboard={() => handleNavigate("leaderboard")}
              />
            )}
            <HomeFeed
              onNavigate={handleNavigate}
              onViewProfile={handleViewProfile}
              openAuth={openAuth}
              profile={profile}
            />
          </div>
        );

      case "leaderboard":
        return (
          <LeaderboardPage
            currentUserId={user?.uid}
            userProfile={profile}
            onProfileRefresh={() => checkProfile()}
          />
        );
      case "upload":
        return <UploadPage onBack={() => handleNavigate("feed")} />;
      case "build":
        return (
          <BuildTeam
            onNavigate={handleNavigate}
            openAuth={() => {
              setShowEntry(false);
              setForceAuth(true);
            }}
          />
        );

      case "discover":
        return (
          <DiscoverPeople
            onViewProfile={handleViewProfile}
            openAuth={openAuth}
          />
        );
      //     case "admin":
      // return <AdminPanel />;
      case "discover-teams":
        return <DiscoverTeams onNavigate={handleNavigate} openAuth={openAuth} onViewProfile={handleViewProfile} />;

      case "teams":
        return (
          <MyTeams
            onNavigate={handleNavigate}
            onViewWorkspace={handleViewWorkspace}
            onViewProfile={handleViewProfile}
            openAuth={openAuth}
          />
        );

      case "notifications":
        return (
          <Notifications
            onNavigateToMessages={handleNavigateToMessages}
            onViewProfile={handleViewProfile}
            openAuth={openAuth}
          />
        );

      case "interviews":
        return (
          <InterviewDashboard
            onStartInterview={(req) => setActiveInterview(req)}
          />
        );

      case "profile":
        return (
          <Profile
            isOwnProfile={true}
            userProfile={profile}
            onEditProfile={handleEditProfile}
            onOpenVerification={handleOpenVerification}
            openAuth={openAuth}
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
            openAuth={openAuth}
          />
        );

      case "messages":
        return (
          <Messages
            initialConversationId={activeConversationId}
            onBack={() => handleNavigate("feed")}
            onViewProfile={handleViewProfile}
            openAuth={openAuth}
          />
        );

      case "workspace":
        return (
          <TeamWorkspace
            teamId={selectedTeamId || ""}
            onBack={() => handleNavigate("teams")}
            openAuth={openAuth}
          />
        );

      case "settings":
        return (
          <SettingsPage
            userProfile={profile}
            onNavigate={handleNavigate}
            onEditProfile={handleEditProfile}
            onDeleteProfile={() => {
              // Trigger the same delete logic from Profile
              const profileRef = document.querySelector('[data-delete-profile]') as HTMLElement;
              if (profileRef) profileRef.click();
            }}
          />
        );

      default:
        return (
          <HomeFeed
            onNavigate={handleNavigate}
            onViewProfile={handleViewProfile}
            openAuth={openAuth}
            profile={profile}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ═══════════════════════════════════════════
          HEADER — Redesigned with centered search
         ═══════════════════════════════════════════ */}
      <header className="app-header">
        <div className="max-w-[1400px] mx-auto px-5 h-[64px] flex items-center gap-4">
          {/* Logo */}
          <div
            onClick={() => handleNavigate("feed")}
            className="flex items-center gap-2 cursor-pointer select-none hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <img
              src="/logo.png"
              alt="TeamUp"
              className="h-10 w-auto object-contain"
            />
            <span className="font-display font-extrabold text-xl text-foreground hidden sm:inline">
              TeamUp
            </span>
          </div>

          {/* Centered Search Bar */}
          <div className="hidden md:flex flex-1 max-w-lg mx-auto">
            <div className="relative w-full">
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Perks Badge */}
            {user && profile && (
              <PerksBadge
                perks={profile.perks ?? 0}
                totalPerksEarned={profile.totalPerksEarned ?? 0}
                onClick={() => handleNavigate("leaderboard")}
              />
            )}

            {/* Replay Tour */}
            {walkthroughPages[currentPage === "feed" ? "feed" : currentPage] && (
              <button
                id="tour-header-tour"
                onClick={handleReplayWalkthrough}
                className="p-2 rounded-xl hover:bg-secondary transition-colors group relative"
                title="Replay Page Tour"
              >
                <HelpCircle className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                  Replay Tour
                </span>
              </button>
            )}

            {/* Notifications */}
            <button
              onClick={() => handleNavigate("notifications")}
              className="p-2 rounded-xl hover:bg-secondary transition-colors relative"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[11px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Settings */}
            <button
              onClick={() => handleNavigate("settings")}
              className="p-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* Profile + Name */}
            <button
              id="tour-header-profile"
              onClick={() => handleNavigate("profile")}
              className="hidden sm:flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-secondary transition-colors"
            >
              <img
                src={
                  profile?.avatar
                    ? `${profile.avatar}?t=${Date.now()}`
                    : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                      profile?.fullName || "User"
                    )}`
                }
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/10"
              />
              <span className="text-sm font-medium text-foreground max-w-[100px] truncate">
                {profile?.fullName || 'Profile'}
              </span>
            </button>

            {/* Mobile-only profile (no name) */}
            <button
              onClick={() => handleNavigate("profile")}
              className="sm:hidden p-1 rounded-full hover:bg-secondary transition-colors"
            >
              <img
                src={
                  profile?.avatar
                    ? `${profile.avatar}?t=${Date.now()}`
                    : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                      profile?.fullName || "User"
                    )}`
                }
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover"
              />
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl hover:bg-secondary transition-colors"
              aria-label="Toggle Menu"
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

      {/* ═══════════════════════════════════════════
          MOBILE SIDEBAR DRAWER
         ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div key="mobile-sidebar-container">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border/60 md:hidden"
              style={{ boxShadow: 'var(--shadow-modal)' }}
            >
              <div className="flex flex-col h-full p-5">
                <div className="flex items-center justify-between mb-6 px-1">
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="TeamUp" className="h-8 w-auto" />
                    <span className="font-display font-bold text-lg">TeamUp</span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <LeftSidebar
                  currentPage={currentPage}
                  onNavigate={(page) => {
                    handleNavigate(page);
                    setMobileMenuOpen(false);
                  }}
                  userProfile={profile}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════
          MAIN CONTENT AREA — 3 column layout
         ═══════════════════════════════════════════ */}
      <div className="flex-1 max-w-[1400px] mx-auto px-5 w-full">
        <div className="flex gap-6 h-full">
          {/* Left Sidebar — fixed width, sticky */}
          <div className="hidden md:block">
            <div className="sticky top-[88px]">
              <LeftSidebar
                currentPage={currentPage}
                onNavigate={handleNavigate}
                userProfile={profile}
              />
            </div>
          </div>

          {/* Main Feed */}
          <main className="flex-1 min-w-0 py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {isDashboard ? (
                  <TeamDashboard />
                ) : (
                  renderContent()
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Right Sidebar — fixed width, sticky */}
          <div className="hidden lg:block">
            <div className="sticky top-[88px]">
              <RightSidebar
                onViewProfile={handleViewProfile}
                onNavigate={handleNavigate}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MODALS + OVERLAYS (all preserved)
         ═══════════════════════════════════════════ */}

      {/* Skill Verification Modal */}
      {showVerificationModal && user && profile && (
        <SkillVerificationModal
          open={showVerificationModal}
          onOpenChange={setShowVerificationModal}
          userSkills={profile.skills.map((skill) => skill.name)}
          onVerificationComplete={handleVerificationComplete}
        />
      )}

      {/* Active Interview Overlay */}
      {activeInterview && (
        <InterviewRouter
          request={activeInterview}
          onEnd={() => {
            setActiveInterview(null);
            window.dispatchEvent(new CustomEvent('teamup:feedback_trigger', { detail: { type: 'interview_completed' } }));
          }}
        />
      )}

      {/* Logout Confirmation */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="bg-card rounded-2xl w-full max-w-sm p-6 border border-border/60"
            style={{ boxShadow: 'var(--shadow-modal)' }}
          >
            <h2 className="text-lg font-semibold text-foreground mb-2 font-display">
              Confirm Logout
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Do you really want to exit TeamUp?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm bg-secondary text-foreground hover:bg-secondary/80 transition font-medium"
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
                className="px-4 py-2 rounded-xl text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 transition font-medium"
              >
                Logout
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full h-[30px] border-t border-border/60 bg-card/50 backdrop-blur-sm text-center py-4 text-sm text-muted-foreground mt-auto">
        <button
          onClick={() => setShowLegal(true)}
          className="text-xs hover:text-foreground transition underline-offset-4 hover:underline relative -top-3"
        >
          TeamUp © 2026 · All rights reserved
        </button>
      </footer>

      {showLegal && (
        <LegalModal onClose={() => setShowLegal(false)} />
      )}

      {/* Feedback Popup */}
      <FeedbackPopup />

      {activeWalkthrough && user && (
        <ProductWalkthrough
          pageId={activeWalkthrough.pageId}
          steps={activeWalkthrough.steps}
          onComplete={(pageId) => {
            setActiveWalkthrough(null);
            localStorage.setItem(`teamup:walkthrough_${pageId}_${user.uid}`, 'true');
          }}
        />
      )}
    </div>
  );
};

export default Index;