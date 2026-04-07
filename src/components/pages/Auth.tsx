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
import { db, auth, googleProvider, githubProvider } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { signInWithPopup, linkWithCredential } from 'firebase/auth';

export interface AuthSuccessData {
  name?: string;
  username?: string;
}

interface AuthProps {
  onAuthSuccess: (data?: AuthSuccessData) => void;
  defaultMode?: "login" | "signup";
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
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [linkingData, setLinkingData] = useState<{
    email: string;
    pendingCredential: any;
    existingProvider: 'google.com' | 'github.com' | 'password';
  } | null>(null);

  const { login, register, resetPassword, signInWithGoogle, signInWithGithub, isConfigured } = useAuth();

  const handleOAuth = async (provider: 'google' | 'github') => {
    if (!acceptedTerms) {
      setError('Please accept the Terms & Conditions and Privacy Policy to continue');
      return;
    }
    setError('');
    setOauthLoading(provider);
    try {
      const result = await (provider === 'google' ? signInWithGoogle() : signInWithGithub());

      if (result?.linkRequired) {
        setLinkingData(result.linkRequired);
      } else if (result?.error) {
        setError(result.error);
      } else {
        onAuthSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'OAuth sign-in failed');
    } finally {
      setOauthLoading(null);
    }
  };

  const handleVerifyAndLink = async () => {
    if (!linkingData) return;
    setLoading(true);
    setError('');
    try {
      if (linkingData.existingProvider === 'password') {
        setError('This account exists with a password. Please sign in with email/password first.');
        setLinkingData(null);
        return;
      }

      const provider = linkingData.existingProvider === 'github.com' ? githubProvider : googleProvider;
      const result = await signInWithPopup(auth, provider);
      await linkWithCredential(result.user, linkingData.pendingCredential);
      
      setLinkingData(null);
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

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
  // ✅ PASS name and username ONLY for signup
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

  if (linkingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card-base p-8 max-w-md w-full text-center">
          <div className="p-3 rounded-xl bg-accent/10 w-fit mx-auto mb-4">
            <Lock className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-display font-bold text-2xl mb-2">Verification Required</h1>
          <p className="text-muted-foreground mb-6">
            This email is already connected to <span className="text-foreground font-semibold">{linkingData.existingProvider === 'google.com' ? 'Google' : linkingData.existingProvider === 'github.com' ? 'GitHub' : 'Email/Password'}</span>. 
            Please verify your identity to link your accounts.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleVerifyAndLink}
            disabled={loading}
            className="w-full btn-primary py-3 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <User className="w-5 h-5" />}
            Verify with {linkingData.existingProvider === 'google.com' ? 'Google' : 'GitHub'}
          </button>

          <button
            onClick={() => setLinkingData(null)}
            className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card-base p-8 max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <img
            src="/logo.png"
            alt="TeamUp Logo"
            className="w-10 h-10 object-contain"
          />
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

          <div className="flex items-start gap-2 text-sm mt-4">
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
              {' '}and{' '}
              <button
                type="button"
                onClick={() => setShowPrivacy(true)}
                className="text-primary hover:underline"
              >
                Privacy Policy
              </button>
            </label>
          </div>

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

          {/* ===== OR DIVIDER ===== */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">or continue with social</span>
            </div>
          </div>

          {/* ===== OAUTH BUTTONS ===== */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={oauthLoading !== null || loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-secondary/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              id="oauth-google-btn"
            >
              {oauthLoading === 'google' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => handleOAuth('github')}
              disabled={oauthLoading !== null || loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-secondary/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              id="oauth-github-btn"
            >
              {oauthLoading === 'github' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              )}
              Continue with GitHub
            </button>
          </div>
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
