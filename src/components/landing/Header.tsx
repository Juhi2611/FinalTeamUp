import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

const Header = ({ onGetStarted }: { onGetStarted: () => void }) => {
  const navigate = useNavigate();
  const { enterDemo } = useAuth();

  return (
    <header className="sticky top-0 z-[100] border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 md:px-6 py-4">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2EC4B6]">
            <Zap className="h-5 w-5 text-white" />
          </div>
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
              try {
                await signInWithEmailAndPassword(
                  auth,
                  "demo@teamup.app",
                  "TeamUpDemo123"
                );
                navigate("/");
              } catch (e) {
                console.error(e);
              }
            }}
            className="h-9 md:h-10 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium text-white bg-blue-600 shadow-md hover:shadow-lg transition"
          >
            Explore Demo
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
