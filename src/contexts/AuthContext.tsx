import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, UserProfile, fetchUserProfile, upsertUserProfile, clearPermanentAuthBackup } from '../services/supabaseClient';
import { App as CapacitorApp } from '@capacitor/app';
import { getProductionOrigin } from '../services/runtimeUrls';

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
  saveCloudGarminCredentials: (email: string) => Promise<boolean>;
  clearCloudGarminCredentials: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const authGenerationRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  const loadProfileForUser = async (u: User, generation = authGenerationRef.current) => {
    if (u.user_metadata?.garmin_password && activeUserIdRef.current === u.id) {
      // Migration from older releases that persisted the Garmin password in user metadata.
      void supabase.auth.updateUser({ data: { garmin_password: null } });
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
      if (authGenerationRef.current === generation && activeUserIdRef.current === u.id) setProfile(p);
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
      if (authGenerationRef.current === generation && activeUserIdRef.current === u.id) setProfile(newP);
    }
  };

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let authEventSeen = false;
    const applySession = (nextSession: Session | null) => {
      if (cancelled) return;
      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      setSession(nextSession);
      setUser(nextUser);
      if (activeUserIdRef.current === nextUserId) {
        if (!nextUser) setLoading(false);
        return;
      }

      activeUserIdRef.current = nextUserId;
      const generation = ++authGenerationRef.current;
      setProfile(null);
      if (!nextUser) {
        setLoading(false);
        return;
      }
      setLoading(true);
      // Supabase calls inside onAuthStateChange can deadlock its auth client.
      // Schedule profile I/O after the callback returns.
      setTimeout(() => {
        if (cancelled || authGenerationRef.current !== generation) return;
        void loadProfileForUser(nextUser, generation)
          .catch(error => console.warn('Could not load account profile:', error))
          .finally(() => {
            if (!cancelled && authGenerationRef.current === generation) setLoading(false);
          });
      }, 0);
    };

    // Initial session check can race with INITIAL_SESSION from the subscription.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!authEventSeen) applySession(session);
    }).catch(error => {
      if (!cancelled && !authEventSeen) {
        console.warn('Could not restore auth session:', error);
        setLoading(false);
      }
    });

    // Keep the callback synchronous; profile fetching happens in applySession's timer.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventSeen = true;
      applySession(nextSession);
    });

    // 3. Capacitor Native Deep Link Handler for OAuth return
    let urlListener: any = null;
    try {
      CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url) return;
        if (url.includes('code=')) {
          try {
            const urlObj = new URL(url.replace('com.cyrilhup.sportcalendar://', `${getProductionOrigin()}/`));
            const code = urlObj.searchParams.get('code');
            if (code) {
              await supabase.auth.exchangeCodeForSession(code);
            }
          } catch (e) {
            console.warn('Error handling deep link code:', e);
          }
        }
      }).then(l => { urlListener = l; }).catch(() => {});
    } catch {}

    return () => {
      cancelled = true;
      authGenerationRef.current += 1;
      activeUserIdRef.current = null;
      subscription.unsubscribe();
      if (urlListener && typeof urlListener.remove === 'function') {
        urlListener.remove();
      }
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
    const targetRedirectUrl = isLocalViteDev ? origin : getProductionOrigin();

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
      await clearPermanentAuthBackup();
    }
    authGenerationRef.current += 1;
    activeUserIdRef.current = null;
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateProfile = async (data: Partial<UserProfile>): Promise<boolean> => {
    if (!user) return false;
    const userId = user.id;
    const ok = await upsertUserProfile({ id: user.id, ...data });
    if (ok && activeUserIdRef.current === userId) {
      setProfile(prev => prev ? { ...prev, ...data } : null);
      if (data.icalUrl) {
        supabase.auth.updateUser({ data: { ical_url: data.icalUrl } }).catch(() => {});
      }
    }
    return ok;
  };

  const saveCloudGarminCredentials = async (email: string): Promise<boolean> => {
    if (!isConfigured || !user) return false;
    try {
      const updateData: Record<string, any> = {
        garmin_email: email,
        // Explicitly purge passwords written by older application versions.
        garmin_password: null
      };
      const { data, error } = await supabase.auth.updateUser({
        data: updateData
      });
      if (!error && data.user) {
        if (activeUserIdRef.current === data.user.id) setUser(data.user);
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
        if (activeUserIdRef.current === data.user.id) setUser(data.user);
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
