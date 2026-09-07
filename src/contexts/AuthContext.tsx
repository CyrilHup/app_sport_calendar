import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, UserProfile, fetchUserProfile, upsertUserProfile } from '../services/supabaseClient';
import { saveGarminCredentials } from '../services/garminService';

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
  saveCloudGarminCredentials: (email: string, pass: string) => Promise<boolean>;
  clearCloudGarminCredentials: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const isConfigured = isSupabaseConfigured();

  const loadProfileForUser = async (u: User) => {
    // 1. Auto-link Garmin credentials if stored in cloud Google account
    if (u.user_metadata?.garmin_email && u.user_metadata?.garmin_password) {
      saveGarminCredentials({
        email: u.user_metadata.garmin_email,
        password: u.user_metadata.garmin_password
      });
    }

    const p = await fetchUserProfile(u.id);
    const googleAvatar = u.user_metadata?.avatar_url || u.user_metadata?.picture;
    if (p) {
      if (!p.avatarUrl && googleAvatar) {
        p.avatarUrl = googleAvatar;
      }
      if (!p.icalUrl && u.user_metadata?.ical_url) {
        p.icalUrl = u.user_metadata.ical_url;
      }
      setProfile(p);
    } else {
      // Create initial profile if missing
      const newP: UserProfile = {
        id: u.id,
        email: u.email || '',
        displayName: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Athlète QMT',
        avatarUrl: googleAvatar,
        icalUrl: u.user_metadata?.ical_url,
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfileForUser(session.user);
      } else if (event === 'SIGNED_OUT') {
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

    // On mobile or production, redirect to the live Vercel domain to prevent localhost fallback
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const isLocalViteDev = origin.includes('localhost:5173') || origin.includes('127.0.0.1:5173');
    const targetRedirectUrl = isLocalViteDev ? origin : 'https://appsportcalendar.vercel.app';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: targetRedirectUrl
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
      if (data.icalUrl) {
        supabase.auth.updateUser({ data: { ical_url: data.icalUrl } }).catch(() => {});
      }
    }
    return ok;
  };

  const saveCloudGarminCredentials = async (email: string, pass: string): Promise<boolean> => {
    if (!isConfigured || !user) return false;
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          garmin_email: email,
          garmin_password: pass
        }
      });
      if (!error && data.user) {
        setUser(data.user);
        return true;
      }
    } catch (e) {
      console.warn('Failed to save Garmin credentials to cloud:', e);
    }
    return false;
  };

  const clearCloudGarminCredentials = async (): Promise<boolean> => {
    if (!isConfigured || !user) return false;
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          garmin_email: null,
          garmin_password: null
        }
      });
      if (!error && data.user) {
        setUser(data.user);
        return true;
      }
    } catch (e) {
      console.warn('Failed to clear Garmin credentials from cloud:', e);
    }
    return false;
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
        refreshProfile,
        saveCloudGarminCredentials,
        clearCloudGarminCredentials
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
