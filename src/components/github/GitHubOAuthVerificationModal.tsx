import { useState } from 'react';
import { Github, Loader2, AlertCircle, CheckCircle, Link as LinkIcon, ShieldAlert } from 'lucide-react';
import { GithubAuthProvider, linkWithPopup, reauthenticateWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile, fetchGitHubStats } from '@/services/firestore';
import { serverTimestamp } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface GitHubVerificationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const GITHUB_URL_REGEX = /^https:\/\/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\?tab=repositories$/;

const GitHubVerificationModal = ({ open, onClose, onSuccess }: GitHubVerificationModalProps) => {
  const { user } = useAuth();
  const [githubUrl, setGithubUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'authenticating' | 'fetching' | 'success'>('input');

  const validateUrl = (url: string): string | null => {
    if (!url.trim()) {
      return 'Please enter your GitHub profile URL';
    }
    
    if (!GITHUB_URL_REGEX.test(url)) {
      return 'URL must be in format: https://github.com/username?tab=repositories';
    }
    
    return null;
  };

  const extractUsername = (url: string): string | null => {
    const match = url.match(GITHUB_URL_REGEX);
    return match ? match[1] : null;
  };

  const handleConnect = async () => {
    setError('');

    // ---------- VALIDATION ----------
    const validationError = validateUrl(githubUrl);
    if (validationError) {
      setError(validationError);
      return;
    }

    const urlUsername = extractUsername(githubUrl);
    if (!urlUsername) {
      setError('Could not extract username from URL');
      return;
    }

    if (!user || !auth.currentUser) {
      setError('You must be logged in to verify your GitHub');
      return;
    }

    // ---------- SECURITY: LOCK SESSION ----------
    // Capture UID BEFORE any OAuth operation
    const originalUid = user.uid;
    const currentUser = auth.currentUser;

    // Double-check session integrity
    if (currentUser.uid !== originalUid) {
      setError('Session mismatch detected. Please refresh and try again.');
      return;
    }

    setLoading(true);
    setStep('authenticating');

    try {
      // ---------- CONFIGURE GITHUB PROVIDER ----------
      const provider = new GithubAuthProvider();
      provider.addScope('read:user');
      provider.addScope('repo');

      // 🔐 CRITICAL: Force GitHub to always show account picker
      // This prevents automatic reuse of previously authenticated accounts
      provider.setCustomParameters({
        prompt: 'select_account',
      });

      // ---------- CHECK IF GITHUB IS ALREADY LINKED ----------
      const hasGithubLinked = currentUser.providerData.some(
        p => p.providerId === 'github.com'
      );

      let result;

      if (hasGithubLinked) {
        // ✅ SAFE: Re-authenticate the SAME user with GitHub
        // This does NOT sign in a new user or change the session
        console.log('[GitHub Verification] Re-authenticating existing GitHub link');
        result = await reauthenticateWithPopup(currentUser, provider);
      } else {
        // ✅ SAFE: Link GitHub to the CURRENT Firebase user
        // This adds GitHub as an auth provider to the existing account
        // It does NOT create a new account or sign in a different user
        console.log('[GitHub Verification] Linking GitHub to current user');
        result = await linkWithPopup(currentUser, provider);
      }

      // ---------- SECURITY: VERIFY SESSION DID NOT CHANGE ----------
      // This is a critical security check - if UID changed, abort immediately
      if (auth.currentUser?.uid !== originalUid) {
        console.error('[SECURITY VIOLATION] User session changed during OAuth');
        await auth.signOut();
        throw new Error('SECURITY_VIOLATION: User session changed unexpectedly');
      }

      // ---------- EXTRACT ACCESS TOKEN ----------
      const credential = GithubAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to get GitHub access token');
      }

      const accessToken = credential.accessToken;

      // ---------- FETCH AUTHENTICATED GITHUB USER ----------
      const githubUserResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!githubUserResponse.ok) {
        throw new Error('Failed to fetch GitHub user info');
      }

      const githubUserData = await githubUserResponse.json();
      const authenticatedUsername = githubUserData.login;

      // ---------- VERIFY USERNAME MATCH ----------
      if (authenticatedUsername.toLowerCase() !== urlUsername.toLowerCase()) {
        setError(
          `GitHub account mismatch. You authenticated as "${authenticatedUsername}" but provided URL for "${urlUsername}". Please ensure you're authenticating with the correct GitHub account.`
        );
        setStep('input');
        setLoading(false);
        return;
      }

      setStep('fetching');

      // ---------- FETCH GITHUB STATS ----------
      const stats = await fetchGitHubStats(authenticatedUsername, accessToken);

      // ---------- FINAL SECURITY CHECK BEFORE WRITE ----------
      if (auth.currentUser?.uid !== originalUid) {
        console.error('[SECURITY VIOLATION] UID changed before profile update');
        await auth.signOut();
        throw new Error('SECURITY_VIOLATION: Session integrity compromised');
      }

      // ---------- WRITE USING LOCKED UID ----------
      // Always use originalUid, never auth.currentUser.uid
      await updateProfile(originalUid, {
        githubVerified: true,
        githubUsername: authenticatedUsername,
        githubProfileUrl: `https://github.com/${authenticatedUsername}`,
        githubVerifiedAt: serverTimestamp() as any,
        githubStats: stats,
      });

      setStep('success');
      setTimeout(onSuccess, 1500);

    } catch (err: any) {
      console.error('[GitHub Verification] Error:', err);

      // Handle security violations - force sign out
      if (err.message?.includes('SECURITY_VIOLATION')) {
        await auth.signOut();
        setError('Security issue detected. You have been signed out for safety. Please sign in again.');
        setStep('input');
        setLoading(false);
        return;
      }

      // Handle user cancelled popup
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Authentication cancelled. Please try again.');
        setStep('input');
        setLoading(false);
        return;
      }

      // 🔐 CRITICAL: Handle credential already in use
      // This means the GitHub account is linked to ANOTHER Firebase user
      // We must NOT attempt to unlink or switch users
      if (err.code === 'auth/credential-already-in-use') {
        setError(
          'This GitHub account is already linked to another TeamUp user. Each GitHub account can only be verified by one TeamUp account. If you believe this is an error, please contact support.'
        );
        setStep('input');
        setLoading(false);
        return;
      }

      // 🔐 CRITICAL: Handle email already in use
      // Firebase's "One account per email" setting blocks linking when:
      // - The GitHub account's email matches ANY existing Firebase user's email
      // - This happens even if GitHub was never used before
      // - This is a Firebase security feature, not a bug
      //
      // IMPORTANT: This can occur in two scenarios:
      // 1. GitHub email matches ANOTHER user's email → Cannot link (security)
      // 2. GitHub email matches the CURRENT user's email but registered via email/password
      //    → This should theoretically be allowed but Firebase blocks it by default
      //
      // To fix scenario 2, the Firebase project owner must:
      // Go to Firebase Console → Authentication → Settings → User account linking
      // And set "Link accounts that use the same email"
      if (err.code === 'auth/email-already-in-use') {
        const currentUserEmail = auth.currentUser?.email?.toLowerCase();
        setError(
          `This GitHub account's email is already registered in TeamUp. ` +
          `If this is your email (${currentUserEmail || 'unknown'}), ask your admin to enable "Link accounts that use the same email" in Firebase Console. ` +
          `Otherwise, use a different GitHub account.`
        );
        setStep('input');
        setLoading(false);
        return;
      }

      // Handle provider already linked (shouldn't happen with our logic, but safety first)
      if (err.code === 'auth/provider-already-linked') {
        // This is actually okay - just proceed with reauthentication
        setError('GitHub is already linked. Please try again.');
        setStep('input');
        setLoading(false);
        return;
      }

      // Handle account exists with different credential
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError(
          'An account already exists with the same email address but different sign-in credentials. Please use your original sign-in method.'
        );
        setStep('input');
        setLoading(false);
        return;
      }

      // Generic error
      setError(err.message || 'GitHub verification failed. Please try again.');
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      setStep('input');
      setGithubUrl('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            Verify Skills using GitHub
          </DialogTitle>
          <DialogDescription>
            Connect your GitHub account to verify your programming skills and enhance your profile credibility.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 'success' ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Verification Successful!</h3>
              <p className="text-sm text-muted-foreground">Your GitHub profile has been verified.</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  GitHub Profile Repository URL
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username?tab=repositories"
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  URL must be exactly: https://github.com/username?tab=repositories
                </p>
              </div>

              {step === 'authenticating' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating with GitHub...</span>
                </div>
              )}

              {step === 'fetching' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Fetching your GitHub statistics...</span>
                </div>
              )}

              {/* Security notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-muted-foreground text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Each GitHub account can only be linked to one TeamUp user. Make sure to select the correct GitHub account when prompted.
                </span>
              </div>

              <button
                onClick={handleConnect}
                disabled={loading || !githubUrl.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Github className="w-4 h-4" />
                    Connect to GitHub
                  </>
                )}
              </button>

              <p className="text-xs text-center text-muted-foreground">
                You'll be asked to select and authenticate with your GitHub account.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GitHubVerificationModal;
