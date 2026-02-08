import { useState, useRef } from 'react';
import { X, Github, Award, Upload, Loader2, CheckCircle, AlertTriangle, Trash2, ShieldCheck, AlertCircle, ArrowLeft, Link as LinkIcon, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { createSkillVerification, fetchGitHubStats } from '@/services/firestore';
import {
  extractGitHubUsername,
  fetchAdvancedGitHubStats,
  matchVerifiedSkills
} from '@/services/githubService';
import { analyzeCertificate } from '@/services/certificateService';
import { Timestamp, serverTimestamp } from 'firebase/firestore';
import { GithubAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { AdvancedGitHubStats } from '@/types/skillVerification.types';
import {
  fetchRepoLanguages,
  calculateLanguageUsage
} from '@/services/githubLanguageService';

interface SkillVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userSkills: string[];
  onVerificationComplete: (
    verifiedSkills: string[]
  ) => void;
}

interface CertificateFile {
  file: File;
  preview: string;
  status: 'pending' | 'verifying' | 'verified' | 'failed';
  result?: {
    extractedName: string;
    courseTopics: string[];
    inferredSkills: string[];
    nameMatch: boolean;
    reason: string;
  };
}

type VerificationStep = 'choice' | 'github' | 'certificates';
type GitHubStep = 'input' | 'authenticating' | 'fetching' | 'success';

const GITHUB_URL_REGEX = /^https:\/\/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\?tab=repositories$/;

export function SkillVerificationModal({
  open,
  onOpenChange,
  userSkills,
  onVerificationComplete,
}: SkillVerificationModalProps) {

  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step navigation
  const [currentStep, setCurrentStep] = useState<VerificationStep>('choice');

  // GitHub OAuth state
  const [githubUrl, setGithubUrl] = useState('');
  const [githubStep, setGithubStep] = useState<GitHubStep>('input');
  const [githubError, setGithubError] = useState('');
  const [githubLoading, setGithubLoading] = useState(false);

  // Certificate state
  const [certificates, setCertificates] = useState<CertificateFile[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [githubStats, setGithubStats] = useState<AdvancedGitHubStats | null>(null);
  const [verifiedGithubUsername, setVerifiedGithubUsername] = useState<string | null>(null);


  // GitHub URL validation
  const validateGitHubUrl = (url: string): string | null => {
    if (!url.trim()) return 'Please enter your GitHub profile URL';
    if (!GITHUB_URL_REGEX.test(url)) return 'URL must be in format: https://github.com/username?tab=repositories';
    return null;
  };

  const extractGitHubUsernameFromUrl = (url: string): string | null => {
    const match = url.match(GITHUB_URL_REGEX);
    return match ? match[1] : null;
  };

  // GitHub OAuth verification handler
  const handleGitHubConnect = async () => {
    if (!user) return;

    setGithubLoading(true);
    setGithubError('');
    setGithubStep('authenticating');

    try {
      const username = extractGitHubUsernameFromUrl(githubUrl);
      if (!username) throw new Error('Invalid GitHub profile URL');

      const provider = new GithubAuthProvider();
      provider.addScope('read:user');
      provider.addScope('repo');

      const result = await signInWithPopup(auth, provider);
      const credential = GithubAuthProvider.credentialFromResult(result);

      if (!credential?.accessToken) {
        throw new Error('GitHub access token not found');
      }

      const githubAccessToken = credential.accessToken;
      setGithubStep('fetching');

      const reposRes = await fetch(
        'https://api.github.com/user/repos?per_page=100',
        {
          headers: {
            Authorization: `Bearer ${githubAccessToken}`,
          },
        }
      );
      const repos = await reposRes.json();

      const languageBytes = await fetchRepoLanguages(repos, githubAccessToken);
      const languageUsage = await calculateLanguageUsage(languageBytes);

      const repoLanguages = languageUsage.map(l =>
        l.language.toLowerCase()
      );

      const verifiedSkills = userSkills
        .map(skill =>
          skill.toLowerCase().replace(/\(.*?\)/g, '').trim()
        )
        .filter(skill => repoLanguages.includes(skill));

      // 🔥 SAVE HERE
      await createSkillVerification(user.uid, {
        status: 'verified',
        verifiedSkills,
        sources: {
          github: {
            username,
            profileUrl: `https://github.com/${username}`,
            oauthVerified: true,
            inferredSkills: verifiedSkills,
            analyzedAt: Timestamp.now(),
          },
        },
        stats: {
          languageUsage, // REQUIRED
        },
        profileSkillsAtVerification: userSkills,
      });

      setGithubStep('success');
      toast.success('GitHub verification successful');
      onVerificationComplete(verifiedSkills);
      onOpenChange(false);

    } catch (err: any) {
      console.error(err);
      setGithubError(err.message || 'GitHub verification failed');
    } finally {
      setGithubLoading(false);
    }
  };

  // Certificate handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newCerts: CertificateFile[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending'
    }));
    setCertificates(prev => [...prev, ...newCerts]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeCertificate = (index: number) => {
    setCertificates(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const verifyCertificate = async (index: number) => {
    const cert = certificates[index];
    setCertificates(prev => prev.map((c, i) => i === index ? { ...c, status: 'verifying' } : c));

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(cert.file);
      });

      if (!user?.displayName) {
        throw new Error('User name not available');
      }

      const result = await analyzeCertificate(
        base64,
        user.displayName,
        userSkills
      );

      setCertificates(prev => prev.map((c, i) => i === index ? {
        ...c,
        status: result.nameMatch ? 'verified' : 'failed',
        result
      } : c));

      if (result.nameMatch) {
        if (result.inferredSkills.length > 0) {
          toast.success(`Certificate verified! Found ${result.inferredSkills.length} skill(s).`);
        } else {
          toast.warning('Certificate verified, but no matching skills found.');
        }
      } else {
        toast.error(`Name verification failed: ${result.reason}`);
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setCertificates(prev => prev.map((c, i) => i === index ? {
        ...c,
        status: 'failed',
        result: {
          extractedName: '',
          courseTopics: [],
          inferredSkills: [],
          nameMatch: false,
          reason: error.message || 'Verification failed'
        }
      } : c));
      toast.error(error.message || 'Certificate verification failed');
    }
  };

  const verifyAllCertificates = async () => {
    for (let i = 0; i < certificates.length; i++) {
      if (certificates[i].status === 'pending') {
        await verifyCertificate(i);
      }
    }
  };

  const handleCertificateSubmit = async () => {
    if (!termsAccepted || !user) return;

    setSubmitting(true);

    try {
      await verifyAllCertificates();
      await new Promise(resolve => setTimeout(resolve, 500));

      const verifiedCerts = certificates.filter(c => c.status === 'verified');

      if (verifiedCerts.length === 0) {
        toast.error('Please verify at least one valid certificate');
        setSubmitting(false);
        return;
      }

      const allInferredSkills = new Set<string>();
      verifiedCerts.forEach(cert => {
        cert.result?.inferredSkills.forEach(skill => allInferredSkills.add(skill.toLowerCase()));
      });

      const verifiedSkills = userSkills.filter(skill =>
        allInferredSkills.has(skill.toLowerCase())
      );

      if (verifiedSkills.length === 0) {
        toast.error(
          'None of your profile skills could be verified from the certificates. ' +
          'Please ensure your certificates contain keywords matching your listed skills.'
        );
        setSubmitting(false);
        return;
      }

      if (!user?.uid) throw new Error('User not authenticated');

      onVerificationComplete(verifiedSkills);
      onOpenChange(false);

      toast.success(
        `Successfully verified ${verifiedSkills.length} skill(s): ${verifiedSkills.slice(0, 3).join(', ')}${verifiedSkills.length > 3 ? '...' : ''}`
      );

      if (githubStats) {
        onVerificationComplete(verifiedSkills);
      }
      onOpenChange(false);
      onOpenChange(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Verification submission error:', error);
      toast.error(error.message || 'Verification failed');
    }

    setSubmitting(false);
  };

  const hasCertificates = certificates.some(c => c.status === 'verified');
  const canSubmitCertificates = hasCertificates && termsAccepted;

  const handleBack = () => {
    setCurrentStep('choice');
    setGithubStep('input');
    setGithubError('');
    setGithubUrl('');
  };

  return (
    <div className="modal-overlay" onClick={() => onOpenChange(false)}>
      <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {currentStep !== 'choice' && (
              <button onClick={handleBack} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            <div className="p-2 rounded-xl bg-primary/10">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-foreground">
                {currentStep === 'choice' && 'Skill Verification'}
                {currentStep === 'github' && 'Verify with GitHub'}
                {currentStep === 'certificates' && 'Verify with Certificates'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {currentStep === 'choice' && 'Choose a verification method'}
                {currentStep === 'github' && 'Connect your GitHub account'}
                {currentStep === 'certificates' && 'Upload your certificates'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* STEP 1: CHOICE SCREEN */}
        {currentStep === 'choice' && (
          <div className="space-y-4">
            {/* GitHub Option */}
            <button
              onClick={() => setCurrentStep('github')}
              className="w-full p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-foreground/10 group-hover:bg-primary/20 transition-colors">
                  <Github className="w-6 h-6 text-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Verify with GitHub</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your GitHub account to automatically verify your programming skills from your repositories.
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-primary">
                    <CheckCircle className="w-3 h-3" />
                    <span>OAuth verified • Most trusted</span>
                  </div>
                </div>
              </div>
            </button>

            {/* Certificates Option */}
            <button
              onClick={() => setCurrentStep('certificates')}
              className="w-full p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-accent/10 group-hover:bg-primary/20 transition-colors">
                  <Award className="w-6 h-6 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Verify with Certificates</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload course certificates to verify your skills. We'll extract and match course topics to your profile.
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Award className="w-3 h-3" />
                    <span>Name & topic verification</span>
                  </div>
                </div>
              </div>
            </button>

            {/* Your Skills */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border">
              <h3 className="text-sm font-medium text-foreground mb-2">Your Profile Skills:</h3>
              <div className="flex flex-wrap gap-2">
                {userSkills.map((skill, idx) => (
                  <span key={idx} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-sm">
                    {skill}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                We'll verify which of these skills are supported by your sources.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2A: GITHUB VERIFICATION */}
        {currentStep === 'github' && (
          <div className="space-y-4">
            {githubStep === 'success' ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Verification Successful!</h3>
                <p className="text-sm text-muted-foreground">Your GitHub profile has been verified.</p>
              </div>
            ) : (
              <>
                {githubError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{githubError}</span>
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
                      disabled={githubLoading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    URL must be exactly: https://github.com/username?tab=repositories
                  </p>
                </div>

                {githubStep === 'authenticating' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating with GitHub...</span>
                  </div>
                )}

                {githubStep === 'fetching' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Fetching your GitHub statistics and analyzing skills...</span>
                  </div>
                )}

                {/* Security notice */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-muted-foreground text-xs">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Each GitHub account can only be linked to one user. Make sure to select the correct GitHub account when prompted.
                  </span>
                </div>

                <button
                  onClick={handleGitHubConnect}
                  disabled={githubLoading || !githubUrl.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {githubLoading ? (
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
        )}

        {/* STEP 2B: CERTIFICATES VERIFICATION */}
        {currentStep === 'certificates' && (
          <div className="space-y-6">
            {/* Warning */}
            <div className="p-4 rounded-lg bg-destructive/10 border-2 border-destructive/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">⚠️ Ownership Verification Required</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Certificates must be yours. Fraudulent verification attempts will result in account suspension.
                  </p>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
              <p className="text-sm text-foreground font-medium mb-2">How Certificate Verification Works:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>We extract your name and course topics from the certificate</li>
                <li>The Certificate identity/proof must be in ".jpg" or ".png" format</li>
                <li>Your name must match your profile name</li>
                <li>Only skills matching your profile will be verified</li>
              </ul>
            </div>

            {/* File upload */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Award className="w-4 h-4" />
                Course Certificates (Name & Topics Verified)
              </label>

              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Upload certificate images (we'll verify your name and extract course skills)
                </p>
                <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-sm">
                  Select Files
                </button>
              </div>

              {certificates.length > 0 && (
                <div className="space-y-3">
                  {certificates.map((cert, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                      <img src={cert.preview} alt="Certificate" className="w-16 h-16 object-cover rounded flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{cert.file.name}</p>

                        {cert.status === 'pending' && (
                          <button
                            onClick={() => verifyCertificate(index)}
                            className="text-xs text-primary hover:underline mt-1"
                          >
                            Click to verify
                          </button>
                        )}

                        {cert.status === 'verifying' && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Analyzing certificate...
                          </p>
                        )}

                        {cert.status === 'verified' && cert.result && (
                          <div className="mt-1 space-y-1">
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Verified - Name: {cert.result.extractedName}
                            </p>
                            {cert.result.inferredSkills.length > 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Skills: {cert.result.inferredSkills.slice(0, 5).join(', ')}
                              </p>
                            ) : (
                              <p className="text-xs text-destructive">
                                No matching skills found in certificate
                              </p>
                            )}
                          </div>
                        )}

                        {cert.status === 'failed' && (
                          <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            {cert.result?.reason || 'Verification failed'}
                          </p>
                        )}
                      </div>
                      <button onClick={() => removeCertificate(index)} className="p-1.5 rounded hover:bg-secondary flex-shrink-0">
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Terms */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 rounded border-input"
                />
                <span className="text-sm text-muted-foreground">
                  I confirm that all certificate submissions are mine and that I have not
                  misrepresented my skills. I understand fraudulent verification may result in account suspension.
                </span>
              </label>
            </div>

            {!hasCertificates && certificates.length > 0 && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Please verify at least one valid certificate
              </p>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button onClick={handleBack} className="btn-secondary">
                Back
              </button>
              <button
                onClick={handleCertificateSubmit}
                disabled={!canSubmitCertificates || submitting}
                className="btn-primary flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Submit Verification
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillVerificationModal;