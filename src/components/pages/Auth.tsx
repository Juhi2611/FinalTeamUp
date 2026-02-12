import { useState } from 'react';
import {
  Zap,
  Mail,
  Lock,
  User,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AtSign } from 'lucide-react';
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface AuthProps {
  onAuthSuccess: (data?: AuthSuccessData) => void;
  defaultMode?: "login" | "signup";
}

export interface AuthSuccessData {
  name?: string;
  username?: string;
}

const Auth = ({ onAuthSuccess, defaultMode = "login" }: AuthProps) => {
  const [isLogin, setIsLogin] = useState(defaultMode === "login");
  const [showTerms, setShowTerms] = useState(false);
const [showPrivacy, setShowPrivacy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { login, register, resetPassword, isConfigured } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 🔐 SIGN UP VALIDATION ONLY
    if (!isLogin) {
      if (!acceptedTerms) {
      setError('Please accept the Terms & Conditions and Privacy Policy');
      return;
      }
      if (!name.trim()) {
        setError('Name is required');
        return;
      }

      // ✅ STEP 3 — USERNAME REQUIRED + FORMAT
      if (!username.trim()) {
        setError('Username is required');
        return;
      }

      if (!/^[a-z0-9_]{3,15}$/.test(username)) {
        setError(
          'Username must be 3–15 characters (a–z, 0–9, _)'
        );
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setError('Enter a valid email address');
        return;
      }
      if (!acceptedTerms) {
        setError('You must agree to the Terms & Conditions to continue');
        return;
      }
    }

    setLoading(true);

    const result = isLogin
  ? await login(email, password)
  : await register(email, password, name, username);

if (result?.error) {
  setError(result.error);
} else {
  onAuthSuccess(isLogin ? undefined : { name, username });
}

    setLoading(false);
  };

const handleForgotPassword = async () => {
  if (!email) {
    toast.error("Please enter your email first");
    return;
  }

  const result = await resetPassword(email);

  // ✅ Always show same message (secure + works always)
  toast.success(
    "If an account with this email exists, a password reset link has been sent."
  );

  // Optional: log error only for debugging
  if (result?.error) {
    console.log("Reset password error:", result.error);
  }
};

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card-base p-8 max-w-md w-full text-center">
          <div className="p-3 rounded-xl bg-accent/10 w-fit mx-auto mb-4">
            <Zap className="w-8 h-8 text-accent" />
          </div>
          <h2 className="font-display font-bold text-xl text-foreground mb-2">
            Firebase Not Configured
          </h2>
          <p className="text-muted-foreground mb-4">
            To enable authentication, add Firebase config to:
          </p>
          <code className="block bg-secondary/50 p-3 rounded-lg text-sm mb-4">
            src/lib/firebase.ts
          </code>
          <p className="text-sm text-muted-foreground">
            Firebase Console → Project Settings → Your Apps
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card-base p-8 max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary/80">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-2xl">
            TeamUp
          </span>
        </div>

        <h1 className="font-display font-bold text-2xl text-center mb-2">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-muted-foreground text-center mb-6">
          {isLogin
            ? 'Sign in to find your dream team'
            : 'Join the community of hackathon builders'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="input-field pl-11"
                  required
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div> 
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {isLogin ? 'Email or Username' : 'Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    isLogin
                      ? 'email or username'
                      : 'you@example.com'
                  }
                  className="input-field pl-11"
                  required
                />
              </div>
            </div>
          </div>

          {/* Username */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Username
              </label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. username123"
                  className="input-field pl-11"
                  required
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field pl-11 pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Forgot Password */}
          {isLogin && (
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Confirm Password */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-11 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Terms & Conditions */}
{!isLogin && (
  <div className="flex items-start gap-2 text-sm">
    <input
      type="checkbox"
      id="terms"
      checked={acceptedTerms}
      onChange={(e) => setAcceptedTerms(e.target.checked)}
      className="mt-1"
      required
    />
    <label htmlFor="terms" className="text-muted-foreground">
      I agree to the{' '}
      <button
  type="button"
  onClick={() => setShowTerms(true)}
  className="text-primary hover:underline"
>
  Terms & Conditions
</button>

      and{' '}
      <button
  type="button"
  onClick={() => setShowPrivacy(true)}
  className="text-primary hover:underline"
>
  Privacy Policy
</button>
    </label>
  </div>
)}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isLogin ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              <>
                <User className="w-4 h-4" />
                {isLogin ? 'Sign In' : 'Create Account'}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-sm text-muted-foreground hover:text-primary"
          >
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <span className="font-medium text-primary">
              {isLogin ? 'Sign up' : 'Sign in'}
            </span>
          </button>
        </div>
      {/* ===== TERMS & CONDITIONS MODAL ===== */}
        {showTerms && (
          <div
            className="modal-overlay"
            onClick={() => setShowTerms(false)}
          >
            <div
              className="modal-content max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold mb-3">
                Terms & Conditions
              </h2>
              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-5 text-sm text-muted-foreground">
  
  <section>
    <h3 className="font-semibold text-foreground mb-1">
      1. Introduction
    </h3>
    <p>
      Welcome to <strong>TeamUp</strong>. By creating an account or using our
      platform, you agree to these Terms & Conditions.
    </p>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      2. Eligibility
    </h3>
    <p>
      You must be at least <strong>13 years old</strong> to use TeamUp.
      Information provided must be accurate and up to date.
    </p>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      3. Account Responsibility
    </h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>You are responsible for maintaining account security</li>
      <li>All actions under your account are your responsibility</li>
      <li>Do not share login credentials</li>
    </ul>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      4. Team Rules
    </h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>Only team leaders can invite or remove members</li>
      <li>Team decisions are managed by the leader</li>
      <li>TeamUp is not responsible for internal disputes</li>
    </ul>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      5. Prohibited Activities
    </h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>Impersonation or false information</li>
      <li>Harassment, abuse, or exploitation</li>
      <li>Attempting to bypass platform security</li>
    </ul>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      6. Termination
    </h3>
    <p>
      TeamUp reserves the right to suspend or terminate accounts that
      violate these terms, with or without notice.
    </p>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      7. Changes to Terms
    </h3>
    <p>
      These terms may be updated. Continued use of TeamUp means
      acceptance of updated terms.
    </p>
  </section>

</div>
              <div className="flex justify-end mt-4">
                <button
                  className="btn-secondary"
                  onClick={() => setShowTerms(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
{/* ===== PRIVACY MODAL ===== */}
        {showPrivacy && (
          <div
            className="modal-overlay"
            onClick={() => setShowPrivacy(false)}
          >
            <div
              className="modal-content max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold mb-3">
                Privacy Policy
              </h2>
              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-5 text-sm text-muted-foreground">

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      Privacy Policy – TeamUp
    </h3>
    <p>
      Your privacy is important to us. This Privacy Policy explains how
      TeamUp collects, uses, and protects your information.
    </p>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      1. Information We Collect
    </h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>Full name</li>
      <li>Email address</li>
      <li>Username</li>
      <li>Profile details such as skills, roles, and team activity</li>
    </ul>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      2. How We Use Your Information
    </h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>Create and manage your account</li>
      <li>Enable team collaboration and invitations</li>
      <li>Improve platform functionality and user experience</li>
    </ul>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      3. Data Visibility
    </h3>
    <p>
      Some profile information is visible to other users to support
      collaboration. Sensitive information such as email and authentication
      data is never shared publicly.
    </p>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      4. Data Sharing
    </h3>
    <p>
      TeamUp does <strong>not sell or rent</strong> your personal data to
      third parties.
    </p>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      5. Data Security
    </h3>
    <p>
      We take reasonable technical and organizational measures to protect
      your data. However, no digital system can guarantee absolute security.
    </p>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      6. User Control
    </h3>
    <p>
      You may update or delete your account information at any time through
      your profile settings.
    </p>
  </section>

  <section>
    <h3 className="font-semibold text-foreground mb-1">
      7. Policy Updates
    </h3>
    <p>
      This Privacy Policy may be updated periodically. Continued use of
      TeamUp constitutes acceptance of the updated policy.
    </p>
  </section>
</div>
              <div className="flex justify-end mt-4">
                <button
                  className="btn-secondary"
                  onClick={() => setShowPrivacy(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Auth;
