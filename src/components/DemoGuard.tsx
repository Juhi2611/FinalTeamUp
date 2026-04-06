import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const DemoGuard = ({ children }: { children: React.ReactNode }) => {
  const { isDemoUser } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  if (!isDemoUser) return <>{children}</>;

  return (
    <>
      <div
        onClick={() => setShow(true)}
        className="pointer-events-auto opacity-70 cursor-not-allowed"
      >
        {children}
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-xl max-w-sm text-center space-y-4">
            <h2 className="text-lg font-bold">Sign up to continue</h2>
            <p className="text-muted-foreground text-sm">
              Create an account to interact on TeamUp
            </p>
            <button
              onClick={() => navigate("/")}
              className="btn-primary w-full"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default DemoGuard;
