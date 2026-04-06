// GitHub OAuth Verification Modal
// Implements secure skill verification with mandatory GitHub OAuth
import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Github, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { 
  GithubAuthProvider, 
  linkWithPopup,
  reauthenticateWithPopup,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  UserCredential,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  extractGitHubUsername, 
  validateGitHubUrl, 
  fetchAdvancedGitHubStats,
  matchVerifiedSkills,
} from '@/services/githubService';
import { createSkillVerification } from '@/services/firestoreSkillVerification';
import { SkillScoreCard } from '../../components/skill-verification/SkillScoreCard';
import { VerifiedSkillsList, VerificationSummaryBadge } from '../../components/skill-verification/VerifiedSkillBadge';
import { 
  GitHubOAuthVerificationModalProps, 
  VerificationStep, 
  AdvancedGitHubStats,
  SkillVerification,
} from '@/types/skillVerification.types';
import { cn } from '@/lib/utils';


// Progress messages for each step
const STEP_MESSAGES: Record<VerificationStep, string> = {
  input: 'Enter your GitHub profile URL',
  authenticating: 'Authenticating with GitHub...',
  fetching: 'Fetching your GitHub profile...',
  analyzing: 'Analyzing your repositories...',
  success: 'Verification complete!',
  error: 'Verification failed',
};
export function GitHubOAuthVerificationModal({
  isOpen,
  onClose,
  userSkills,
  userId,
  onVerificationComplete,
}: GitHubOAuthVerificationModalProps) {
  // State
  const [step, setStep] = useState<VerificationStep>('input');
  const [githubUrl, setGithubUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [githubStats, setGithubStats] = useState<AdvancedGitHubStats | null>(null);
  const [verifiedSkills, setVerifiedSkills] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Auth context
  const { user } = useAuth();
  
  // Security: Lock the UID at the start of verification
  const lockedUidRef = useRef<string | null>(null);
  
  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setStep('input');
    setGithubUrl('');
    setError(null);
    setGithubStats(null);
    setVerifiedSkills([]);
    setIsSaving(false);
    lockedUidRef.current = null;
    onClose();
  }, [onClose]);
  
  // Handle GitHub OAuth and verification
  const handleVerify = useCallback(async () => {
    const validation = validateGitHubUrl(githubUrl);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid URL');
      return;
    }

    const urlUsername = extractGitHubUsername(githubUrl);
    if (!urlUsername) {
      setError('Could not extract username');
      return;
    }

    if (!auth.currentUser) {
      setError('You must be logged in');
      return;
    }

    lockedUidRef.current = auth.currentUser.uid;
    setStep('authenticating');
    setError(null);

    const provider = new GithubAuthProvider();
    provider.addScope('read:user');
    provider.addScope('repo');

    let credential: UserCredential;

    try {
      // NORMAL LINK FLOW
      credential = await linkWithPopup(auth.currentUser, provider);

    } catch (err: any) {

      if (err.code !== 'auth/account-exists-with-different-credential') {
        throw err;
      }

      const pendingCred = GithubAuthProvider.credentialFromError(err);
      const email = err.customData.email;

      const password = prompt(
        `This GitHub email already exists.\nEnter your TeamUp password to link GitHub:`
      );

      if (!password) throw new Error("Password required");

      const userCred = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      await linkWithCredential(userCred.user, pendingCred!);

      // ✅ SUCCESS — stop error forever
      return handleVerify(); 
    }

    // SECURITY CHECK
    if (auth.currentUser?.uid !== lockedUidRef.current) {
      await signOut(auth);
      throw new Error('Session changed. Login again.');
    }

    const oauthCred = GithubAuthProvider.credentialFromResult(credential);
    const accessToken = oauthCred?.accessToken;

    const profile = (credential as any).additionalUserInfo?.profile;
    const oauthUsername = profile?.login;

    if (!oauthUsername) throw new Error('GitHub username missing');

    if (oauthUsername.toLowerCase() !== urlUsername.toLowerCase()) {
      throw new Error('GitHub account does not match profile URL');
    }

    setStep('fetching');

    const stats = await fetchAdvancedGitHubStats(
      oauthUsername,
      accessToken || undefined
    );

    setStep('analyzing');

    await new Promise(r => setTimeout(r, 400));

    const matched = matchVerifiedSkills(userSkills, stats.inferredSkills);

    setGithubStats(stats);
    setVerifiedSkills(matched);
    setStep('success');

  }, [githubUrl, userSkills]);
  
  // Save verification to Firestore
  const handleSaveVerification = useCallback(async () => {
    if (!githubStats || !lockedUidRef.current) return;
    
    // SECURITY: Use the locked UID, not current user
    const targetUserId = lockedUidRef.current;
    
    // Verify current user still matches
    if (auth.currentUser?.uid !== targetUserId) {
      setError('Security error: User session changed. Please try again.');
      return;
    }
    
    setIsSaving(true);
    
    try {
      const verification = await createSkillVerification(
        targetUserId,
        githubStats,
        verifiedSkills,
        userSkills
      );
      
      onVerificationComplete?.(verification);
      handleClose();
    } catch (err: any) {
      console.error('Failed to save verification:', err);
      setError('Failed to save verification. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [githubStats, verifiedSkills, userSkills, onVerificationComplete, handleClose]);
  
  // Render based on current step
  const renderContent = () => {
    switch (step) {
      case 'input':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="github-url">GitHub Profile URL</Label>
              <div className="relative">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="github-url"
                  type="url"
                  placeholder="https://github.com/yourusername"
                  value={githubUrl}
                  onChange={(e) => {
                    setGithubUrl(e.target.value);
                    setError(null);
                  }}
                  className="pl-10"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {error}
                </p>
              )}
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <p>
                  You'll be asked to authenticate with GitHub to verify ownership. 
                  We only verify that you own the profile - your code stays private.
                </p>
              </div>
            </div>
            
            <Button 
              onClick={handleVerify} 
              className="w-full"
              disabled={!githubUrl.trim()}
            >
              <Github className="mr-2 h-4 w-4" />
              Verify with GitHub
            </Button>
          </div>
        );
        
      case 'authenticating':
      case 'fetching':
      case 'analyzing':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">{STEP_MESSAGES[step]}</p>
          </div>
        );
        
      case 'error':
        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-6 space-y-3">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-center text-destructive">{error}</p>
            </div>
            
            <Button 
              onClick={() => {
                setStep('input');
                setError(null);
              }} 
              variant="outline"
              className="w-full"
            >
              Try Again
            </Button>
          </div>
        );
        
      case 'success':
        return (
          <div className="space-y-6">
            {/* Success header */}
            <div className="flex items-center justify-center gap-2 text-primary">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Verification Complete</span>
            </div>
            
            {/* Score card */}
            {githubStats && (
              <SkillScoreCard 
                overallScore={githubStats.overallScore}
                metrics={githubStats.metrics}
              />
            )}
            
            {/* Verified skills */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Your Skills</h4>
                <VerificationSummaryBadge 
                  verifiedCount={verifiedSkills.length}
                  totalCount={userSkills.length}
                />
              </div>
              <VerifiedSkillsList 
                skills={userSkills}
                verifiedSkills={verifiedSkills}
              />
            </div>
            
            {/* GitHub profile link */}
            {githubStats && (
              <a 
                href={githubStats.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-3.5 w-3.5" />
                {githubStats.username}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            
            {/* Save button */}
            <Button 
              onClick={handleSaveVerification} 
              className="w-full"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Save Verification
                </>
              )}
            </Button>
          </div>
        );
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verify Your Skills
          </DialogTitle>
          <DialogDescription>
            {STEP_MESSAGES[step]}
          </DialogDescription>
        </DialogHeader>
        
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
export default GitHubOAuthVerificationModal;
