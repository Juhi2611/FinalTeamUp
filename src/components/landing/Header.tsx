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
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2EC4B6]">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold">TeamUp</span>
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="nav-link">Features</a>
          <a href="#about" className="nav-link">About</a>
          <a href="#contact" className="nav-link">Contact</a>
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
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
            className="bg-[#1E3A8A] text-white px-5 py-2.5 rounded-lg hover:bg-[#1E40AF]"
          >
            Explore Demo
          </button>

          <Button onClick={onGetStarted}>
            Get Started
          </Button>
        </div>

      </div>
    </header>
  );
};

export default Header;
