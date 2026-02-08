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
} from 'firebase/auth';

import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { createProfile, getProfile } from '@/services/firestore';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";

import { db } from "@/lib/firebase";

/* =======================
   Types
======================= */

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (
    email: string,
    password: string,
    name: string,
    username: string
  ) => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
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

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, [isConfigured]);

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

      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
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
     Provider Value
  ======================= */

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured,
        login,
        register,
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
