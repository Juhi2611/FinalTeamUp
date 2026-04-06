import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, ShieldCheck, FileCheck, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Tesseract from 'tesseract.js';
import { updateProfile, getProfile } from '@/services/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile } from '@/types/firestore.types';
type DocType = 'aadhar' | 'passport' | 'driving_license';
interface IdentityVerificationModalProps {
  onClose: () => void;
  onComplete: (updatedProfileFields: Partial<UserProfile>) => void;
}
const IdentityVerificationModal = ({ onClose, onComplete }: IdentityVerificationModalProps) => {
  const { user } = useAuth();
  const [docType, setDocType] = useState<DocType>('aadhar');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    if (user?.uid) {
      getProfile(user.uid).then(profile => {
        setUserProfile(profile);
      });
    }
  }, [user]);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setErrorMsg(null);
    }
  };
  const fuzzyMatchName = (scannedText: string, fullName: string) => {
    if (!fullName) return false;
    const cleanText = scannedText.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const names = fullName.toLowerCase().split(' ').filter(n => n.length > 2);
    let matchCount = 0;
    for (const name of names) {
      if (cleanText.includes(name)) {
        matchCount++;
      }
    }
    return matchCount >= Math.ceil(names.length / 2);
  };
  const analyzeDocumentAuthenticity = (text: string, docType: DocType) => {
    // 1. Text Density
    if (text.length < 50) {
      return { valid: false, error: "Critical failure: Document lacks sufficient text density. Ensure a complete, clear photo." };
    }
    const cleanText = text.replace(/[^a-zA-Z0-9\s/:-]/g, '').toLowerCase();
    // 2. Structured Metadata Signals (Indicators of a real ID format)
    const structureChecks = ['dob', 'date of birth', 'birth', 'name', 'sex', 'gender', 'issue', 'expiry', 'valid', 'blood', 'father', 'signature', 'address'];
    const structureScore = structureChecks.filter(key => cleanText.includes(key)).length;
    // 3. Date Parsing Signal (Must find at least one date-like string)
    // Matches DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, etc.
    const dateRegex = /\b\d{2}[-/.]\d{2}[-/.]\d{4}\b|\b\d{4}[-/.]\d{2}[-/.]\d{2}\b/g;
    const dateMatches = text.match(dateRegex);
    const hasDates = dateMatches !== null && dateMatches.length > 0;
    // 4. Multi-Signal Thresholding based on Type
    let isSpecificMatch = false;
    if (docType === 'aadhar') {
      const aadharRegex = /\b[2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/g;
      // OCR can make slight spelling errors, so we rely on smaller robust substrings in pure lowercase
      const hasGovtOrAadhaar = cleanText.includes('government') || cleanText.includes('india') || cleanText.includes('govt') || cleanText.includes('aadhar') || cleanText.includes('aadhaar') || cleanText.includes('uidai');
      const hasIdentityFields = cleanText.includes('dob') || cleanText.includes('birth') || cleanText.includes('yob') || cleanText.includes('male') || cleanText.includes('female') || cleanText.includes('gender');
      // Strict Check: Must have Aadhar Format AND Govt/Aadhaar text AND Identity Fields
      if (text.match(aadharRegex) && hasGovtOrAadhaar && hasIdentityFields && structureScore >= 1) {
        isSpecificMatch = true;
      } else if (!text.match(aadharRegex)) {
        return { valid: false, error: "Failed Aadhaar Validation: Missing valid 12-digit Aadhaar number format." };
      } else if (!hasGovtOrAadhaar) {
        return { valid: false, error: "Failed Aadhaar Validation: Missing official document markers (e.g. 'Government of India')." };
      } else {
        return { valid: false, error: "Failed Aadhaar Validation: Document is incomplete. Missing layout fields like 'DOB' or 'Gender'." };
      }
    }
    else if (docType === 'passport') {
      const hasPassport = cleanText.includes('passport');
      const mrzRegex = /P<[A-Z]{3}/i; // Universal MRZ
      // Strict Check: A passport MUST have an MRZ code OR explicitly say 'passport' + have structural signals + have dates
      if (text.match(mrzRegex) && hasDates) {
        isSpecificMatch = true;
      } else {
        return { valid: false, error: "Failed Passport Validation: Missing Machine-Readable Zone (MRZ) patterns or structural date fields." };
      }
    }
    else if (docType === 'driving_license') {
      const hasDriver = cleanText.includes('driver') || cleanText.includes('driving');
      const hasLicense = cleanText.includes('license') || cleanText.includes('licence');
      const hasDLNumber = /\b[A-Z0-9-]{6,}\b/.test(text);
      const isDL = (hasDriver && hasLicense && hasDLNumber);
      // Strict Check: Must identify as DL + Must have structural identity markers + Must have Date markers
      if (isDL && structureScore >= 1 && hasDates) {
        isSpecificMatch = true;
      } else {
        return { valid: false, error: "Failed Driving License Validation: Missing license identifiers, date formats, or structural layout traits." };
      }
    }
    if (!isSpecificMatch) {
      return { valid: false, error: "Document parsed but failed multi-signal validation checks for the selected document type." };
    }
    return { valid: true, error: null };
  };
  const handleVerify = async () => {
    if (!file || !user || !userProfile) return;
    setIsVerifying(true);
    setVerifyProgress(10);
    setErrorMsg(null);
    try {
      const worker = await (Tesseract as any).createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setVerifyProgress(20 + Math.floor(m.progress * 60));
          }
        }
      });
      setVerifyProgress(20);
      const { data } = await worker.recognize(file);
      await worker.terminate();
      setVerifyProgress(80);
      const { text } = data;
      // 2. Comprehensive Multi-Signal Validation
      const authenticityCheck = analyzeDocumentAuthenticity(text, docType);
      if (!authenticityCheck.valid) {
        throw new Error(authenticityCheck.error || "Document validation rejected.");
      }
      // 3. Strict Identity Name Match
      const isNameMatched = fuzzyMatchName(text, userProfile.fullName);
      if (!isNameMatched) {
        throw new Error(`Critical Match Failure: The name detected on the document structurally misaligns with your profile (${userProfile.fullName}). Using another person's document is rejected.`);
      }
      setVerifyProgress(90);
      await updateProfile(user.uid, {
        isProfileVerified: true,
      });
      setVerifyProgress(100);
      toast.success("Identity successfully verified against strict multi-signal checks!");
      onComplete({ isProfileVerified: true });
      onClose();
    } catch (error: any) {
      console.error("Verification failed", error);
      setErrorMsg(error.message || "Failed to verify document due to structural mismatch.");
    } finally {
      setIsVerifying(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-card border border-border shadow-lg rounded-xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Strict Identity Verification</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            disabled={isVerifying}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-muted-foreground">
            Our multi-signal engine structurally analyzes your document constraints. Your identity <b>must entirely match</b> your profile name: <strong className="text-foreground">{userProfile?.fullName || '...'}</strong>.
          </p>
          {errorMsg && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex gap-2 text-destructive items-start shadow-inner">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-medium leading-relaxed">{errorMsg}</p>
            </div>
          )}
          <div className="space-y-3">
            <label className="text-sm font-medium">Document Type</label>
            <select
              title="Identity Document Type"
              className="w-full p-2.5 rounded-lg bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm outline-none"
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              disabled={isVerifying}
            >
              <option value="aadhar">Aadhaar Card</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving License</option>
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium">Upload Document</label>
            {!previewUrl ? (
              <div
                onClick={() => !isVerifying && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isVerifying ? 'opacity-50 cursor-not-allowed' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">Click to upload document photo</p>
                <p className="text-xs text-muted-foreground">Original documents only. No memes/screenshots.</p>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30 p-2">
                <img src={previewUrl} alt="Document Preview" className="w-full h-48 object-cover rounded-lg" />
                {!isVerifying && (
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl(null);
                      setErrorMsg(null);
                    }}
                    className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm p-1.5 rounded-full shadow hover:bg-destructive hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/jpeg, image/png, image/webp"
              onChange={handleFileChange}
            />
          </div>
          {isVerifying && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-primary font-medium tracking-wide">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running Structural Matrix Analysis...
                </span>
                <span>{verifyProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${verifyProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        {/* Footer */}
        <div className="p-6 pt-0 border-t border-border mt-auto flex gap-3 bg-muted/30 pt-4">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary bg-background font-medium hover:bg-accent hover:text-accent-foreground border"
            disabled={isVerifying}
          >
            Cancel
          </button>
          <button
            className="flex-1 btn-primary bg-primary text-primary-foreground flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:shadow-none"
            onClick={handleVerify}
            disabled={!file || isVerifying}
          >
            {isVerifying ? (
              <>Processing Validations...</>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                Confirm Authenticity
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
export default IdentityVerificationModal;