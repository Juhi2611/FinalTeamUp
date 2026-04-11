import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  User,
  AuthError,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  GithubAuthProvider,
} from 'firebase/auth';

import { auth, isFirebaseConfigured, googleProvider, githubProvider } from '@/lib/firebase';
import { createProfile, getProfile } from '@/services/firestore';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export interface AuthResponse {
  error?: string;
  linkRequired?: {
    email: string;
    pendingCredential: any;
    existingProvider: 'google.com' | 'github.com' | 'password';
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;

  isDemoUser: boolean;
  enterDemo: () => void;
  exitDemo: () => void;

  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (
    email: string,
    password: string,
    name: string,
    username: string
  ) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<AuthResponse>;
  signInWithGithub: () => Promise<AuthResponse>;
  resetPassword: (email: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
}


/* =======================
   Context
======================= */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/* =======================
   Provider
======================= */

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isFirebaseConfigured();
  const [isDemoUser, setIsDemoUser] = useState(false);
  const isDemoUserComputed = isDemoUser || user?.email === "demo@teamup.app";

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (isDemoUser) return;
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, [isConfigured, isDemoUser]);

  /* =======================
     Auth Functions
  ======================= */

  const login = async (identifier: string, password: string) => {
    try {
      let emailToUse = identifier.trim().toLowerCase();

      // If username (not email)
      if (!emailToUse.includes('@')) {
        const username = emailToUse.replace(/^@/, '');

        const q = query(
          collection(db, 'profiles'), // ✅ FIX HERE
          where('username', '==', username)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          return { error: 'Account not found' };
        }

        emailToUse = snapshot.docs[0].data().email;
      }

      await signInWithEmailAndPassword(auth, emailToUse, password);
      return {};

    } catch (error: any) {
      return { error: error.message || 'Login failed' };
    }
  };

  const register = async (
    email: string,
    password: string,
    fullName: string,
    username: string
  ) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      const uid = cred.user.uid;

      // Save profile
      await setDoc(doc(db, "profiles", uid), {
        fullName,
        email,
        username: username.toLowerCase(),
        createdAt: serverTimestamp(),
      });

      // Reserve username
      await setDoc(doc(db, "usernames", username.toLowerCase()), {
        uid,
        email,
        createdAt: serverTimestamp(),
      });

      // Send email verification link
      try {
        await sendEmailVerification(cred.user);
      } catch (verifyErr) {
        console.warn('Email verification send failed:', verifyErr);
      }

      // Grant 50 initial perks for new users
      try {
        const { grantInitialPerks } = await import('@/services/perksService');
        await grantInitialPerks(uid);
      } catch (perksErr) {
        console.warn('Initial perks grant failed:', perksErr);
      }

      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const enterDemo = () => {
    setIsDemoUser(true);
    setUser({
      uid: "demo-user",
      email: "demo@teamup.app",
    } as any);
    setLoading(false);
  };

  const exitDemo = async () => {
    setIsDemoUser(false);
    if (isConfigured) await signOut(auth);
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    if (!isConfigured) return { error: 'Firebase not configured' };

    try {
      await sendPasswordResetEmail(auth, email);
      return {};
    } catch (err) {
      const error = err as AuthError;
      return { error: getAuthErrorMessage(error.code) };
    }
  };

  const logout = async () => {
    if (isConfigured) {
      await signOut(auth);
    }
  };

  /* =======================
     OAuth Popup Functions
  ======================= */

  const handleOAuthPopup = async (
    provider: typeof googleProvider | typeof githubProvider,
    providerName: string
  ): Promise<AuthResponse> => {
    if (!isConfigured) return { error: 'Firebase not configured' };

    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // Check if Firestore profile exists
      const existingProfile = await getProfile(firebaseUser.uid);

      if (!existingProfile) {
        // Auto-create a minimal profile for new OAuth users
        const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
        await setDoc(doc(db, 'profiles', firebaseUser.uid), {
          fullName: displayName,
          email: firebaseUser.email || '',
          username: null,
          avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
          authProvider: providerName,
          createdAt: serverTimestamp(),
        });
        // Grant 50 initial perks for new OAuth users
        try {
          const { grantInitialPerks } = await import('@/services/perksService');
          await grantInitialPerks(firebaseUser.uid);
        } catch (perksErr) {
          console.warn('Initial perks grant failed (OAuth):', perksErr);
        }
      }

      return {};
    } catch (err: any) {
      if (err.code === 'auth/account-exists-with-different-credential') {
        const pendingCredential = providerName === 'google'
          ? GoogleAuthProvider.credentialFromError(err)
          : GithubAuthProvider.credentialFromError(err);
        const email = err.customData?.email;
        if (!email) return { error: "This email is already linked to another account." };

        try {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          let existingProvider: 'google.com' | 'github.com' | 'password' = 'google.com';
          if (methods.includes('github.com')) existingProvider = 'github.com';
          if (methods.includes('password')) existingProvider = 'password';

          return {
            error: `ACCOUNT_EXISTS_LINK_REQUIRED`,
            linkRequired: {
              email,
              pendingCredential,
              existingProvider
            }
          };
        } catch (fetchErr) {
          // If fetch fails, we still have the pending credential
          return {
            error: `ACCOUNT_EXISTS_LINK_REQUIRED`,
            linkRequired: {
              email,
              pendingCredential,
              existingProvider: 'google.com' // Fallback
            }
          };
        }
      }

      if (err.code === 'auth/popup-closed-by-user') return {};
      if (err.code === 'auth/popup-blocked') return { error: 'Popup blocked by browser.' };

      return { error: err.message || `${providerName} sign-in failed` };
    }
  };

  const signInWithGoogle = () => handleOAuthPopup(googleProvider, 'google');
  const signInWithGithub = () => handleOAuthPopup(githubProvider, 'github');

  /* =======================
     Provider Value
  ======================= */

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured,
        isDemoUser: isDemoUserComputed,
        enterDemo,
        exitDemo,
        login,
        register,
        signInWithGoogle,
        signInWithGithub,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* =======================
   Error Messages
======================= */

function getAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered';
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters';
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/wrong-password':
      return 'Incorrect password';
    case 'auth/invalid-credential':
      return 'Invalid email or password';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later';
    default:
      return 'An error occurred. Please try again';
  }
}
