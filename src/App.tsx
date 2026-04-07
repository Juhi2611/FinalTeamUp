import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BlockProvider } from "./contexts/BlockContext";
import { UserProfileProvider } from "./contexts/UserProfileContext";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ProfilePage from "./pages/ProfilePage";
import TeamDetails from "./pages/TeamDetails";
import TeamFiles from "./components/pages/TeamFiles";
import UploadPage from "./components/pages/UploadPage";
import AdminLogin from "@/components/pages/AdminLogin";
import AdminPanel from "./components/pages/AdminPanel";
import ProtectedAdmin from "./components/ProtectedAdmin";
import SitemapVisualizer from "./pages/SitemapVisualizer";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BlockProvider>
        <TooltipProvider>
          <UserProfileProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
<Routes>
  <Route path="/" element={<Index />} />
  <Route path="/build" element={<Index />} />
  <Route path="/discover" element={<Index />} />
  <Route path="/teams" element={<Index />} />
  <Route path="/notifications" element={<Index />} />
  <Route path="/interviews" element={<Index />} />
  <Route path="/profile" element={<Index />} />
  <Route path="/messages" element={<Index />} />
  <Route path="/admin-login" element={<AdminLogin />} />
  <Route path="/sitemap" element={<SitemapVisualizer />} />

<Route
  path="/admin"
  element={
    <ProtectedAdmin>
      <AdminPanel />
    </ProtectedAdmin>
  }
/>
<Route path="/upload" element={<UploadPage />} />

  <Route path="/profile/:userId" element={<ProfilePage />} />
  <Route path="/teams/:teamId/files" element={<TeamFiles openAuth={function (): void {
                  throw new Error("Function not implemented.");
                } } />} />
  <Route path="/team/:teamId" element={<TeamDetails />} />

  <Route path="*" element={<NotFound />} />
</Routes>
          </BrowserRouter>
          </UserProfileProvider>
        </TooltipProvider>
      </BlockProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;