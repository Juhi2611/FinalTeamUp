import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  AuthError
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { createProfile, getProfile } from '@/services/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isFirebaseConfigured();

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, [isConfigured]);

  const login = async (emailOrUsername: string, password: string) => {
  if (!isConfigured) return { error: 'Firebase not configured' };
  try {
    let email = emailOrUsername;
    
    // Check if input is username (not an email format)
    if (!emailOrUsername.includes('@') || emailOrUsername.startsWith('@')) {
      // It's a username - look up the email
      const { getUserEmailByUsername } = await import('@/services/firestore');
      const foundEmail = await getUserEmailByUsername(emailOrUsername);
      
      if (!foundEmail) {
        return { error: 'No account found with this username' };
      }
      email = foundEmail;
    }
    
    await signInWithEmailAndPassword(auth, email, password);
    return {};
  } catch (err) {
    const error = err as AuthError;
    return { error: getAuthErrorMessage(error.code) };
  }
};


  const register = async (email: string, password: string, name: string) => {
  if (!isConfigured) return { error: 'Firebase not configured' };
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Check if profile already exists (edge case)
    const existingProfile = await getProfile(credential.user.uid);
    if (!existingProfile) {
      // Generate unique username
      const { generateUniqueUsername } = await import('@/services/firestore');
      const username = await generateUniqueUsername(name);
      
      // Create initial profile document in Firestore with username
      await createProfile(credential.user.uid, {
        email: email,
        fullName: name,
        username, // ADD THIS
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
      });
    }
    
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

  return (
    <AuthContext.Provider value={{ user, loading, isConfigured, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

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
