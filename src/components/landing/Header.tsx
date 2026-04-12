import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

const Header = ({ onGetStarted }: { onGetStarted: () => void }) => {
  const navigate = useNavigate();
  const authContext = useAuth();

  return (
    <header className="sticky top-0 z-[100] border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 md:px-6 py-4">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="TeamUp"
            className="h-12 w-12 object-contain"
          />
          <span className="text-lg md:text-xl font-semibold">TeamUp</span>
        </div>

        {/* Desktop Nav (unchanged) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">
            About
          </a>
          <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">
            Contact
          </a>
        </nav>

        {/* CTA Section */}
        <div className="flex items-center gap-2 md:gap-3">

          {/* Explore */}
          <button
            onClick={async () => {
              const toastId = toast.loading("Logging into Demo Account...");
              try {
                const res = await authContext.login("demo@teamup.app", "TeamUpDemo123");
                if (res.error) {
                  // Fallback: If demo account was deleted or password changed, try to recreate
                  const regRes = await authContext.register("demo@teamup.app", "TeamUpDemo123", "Demo User", "demouser");
                  if (regRes.error) {
                    toast.error("Failed to login to demo account: " + res.error, { id: toastId });
                  } else {
                    toast.success("Created and logged into Demo Account!", { id: toastId });
                    navigate("/");
                  }
                } else {
                  toast.success("Welcome to TeamUp Demo!", { id: toastId });
                  navigate("/");
                }
              } catch (e: any) {
                console.error(e);
                toast.error("An unexpected error occurred", { id: toastId });
              }
            }}
            className="h-9 md:h-10 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium text-white bg-blue-600 shadow-md hover:shadow-lg transition"
          >
            Explore TeamUp
          </button>

          {/* Get Started */}
          <Button
            onClick={onGetStarted}
            className="h-9 md:h-10 px-3 md:px-4 text-xs md:text-sm"
          >
            Get Started
          </Button>
        </div>

      </div>
    </header>
  );
};

export default Header;
