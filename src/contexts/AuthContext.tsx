import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, UserProfile, fetchUserProfile, upsertUserProfile } from '../services/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<{ error?: string }>;
  signUp: (email: string, pass: string, name?: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const isConfigured = isSupabaseConfigured();

  const loadProfileForUser = async (u: User) => {
    const p = await fetchUserProfile(u.id);
    if (p) {
      setProfile(p);
    } else {
      // Create initial profile if missing
      const newP: UserProfile = {
        id: u.id,
        email: u.email || '',
        displayName: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Athlète QMT',
        isPublic: false
      };
      await upsertUserProfile(newP);
      setProfile(newP);
    }
  };

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfileForUser(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Auth state subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfileForUser(session.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signIn = async (email: string, pass: string) => {
    if (!isConfigured) return { error: "Supabase n'est pas encore configuré." };
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return { error: error.message };
    return {};
  };

  const signUp = async (email: string, pass: string, name?: string) => {
    if (!isConfigured) return { error: "Supabase n'est pas encore configuré." };
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          full_name: name || email.split('@')[0]
        }
      }
    });
    if (error) return { error: error.message };
    if (data.user) {
      await loadProfileForUser(data.user);
    }
    return {};
  };

  const signInWithGoogle = async () => {
    if (!isConfigured) return { error: "Supabase n'est pas encore configuré." };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) return { error: error.message };
    return {};
  };

  const signOut = async () => {
    if (isConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateProfile = async (data: Partial<UserProfile>): Promise<boolean> => {
    if (!user) return false;
    const ok = await upsertUserProfile({ id: user.id, ...data });
    if (ok) {
      setProfile(prev => prev ? { ...prev, ...data } : null);
    }
    return ok;
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfileForUser(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isConfigured,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        updateProfile,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
