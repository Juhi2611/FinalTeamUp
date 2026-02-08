import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserProfileProvider } from "./contexts/UserProfileContext";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import { BlockProvider } from "./contexts/BlockContext";
import NotFound from "./pages/NotFound";
import ProfilePage from "./pages/ProfilePage";
import TeamDetails from "./pages/TeamDetails";
import TeamFiles from "./components/pages/TeamFiles";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BlockProvider>
        <TooltipProvider>
          <UserProfileProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
  <Route path="/" element={<Index />} />
  <Route path="/profile" element={<Index />} />
  <Route path="/profile/:userId" element={<ProfilePage />} />
  <Route path="/teams/:teamId/files" element={<TeamFiles />} />
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
