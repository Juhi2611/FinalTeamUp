import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Header = ({ onGetStarted }: { onGetStarted: () => void }) => {
  const navigate = useNavigate();
  const { enterDemo } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2EC4B6]">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-foreground">
            TeamUp
          </span>
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">Features</a>
          <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground">About</a>
          <a href="#contact" className="text-sm font-medium text-muted-foreground hover:text-foreground">Contact</a>
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
        {/* Explore Demo */}
        <button
          onClick={enterDemo}
          className="
            inline-flex items-center justify-center
            rounded-lg px-5 py-2.5 text-sm font-medium
            bg-[#1E3A8A] text-white
            hover:bg-[#1E40AF]
            transition-colors
          "
        >
          Explore Demo
        </button>
      
        {/* Get Started */}
        <Button onClick={onGetStarted}>
          Get Started
        </Button>
      </div>
      </div>
    </header>
  );
};

export default Header;
