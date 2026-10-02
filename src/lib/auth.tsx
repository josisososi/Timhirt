import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from './supabase';

type AuthState = {
  /** False when no Supabase keys are set: the app then runs offline-only. */
  configured: boolean;
  /** True until the stored session (if any) has been read. */
  loading: boolean;
  session: Session | null;
};

const AuthContext = createContext<AuthState>({ configured: false, loading: false, session: null });

export const useAuth = () => useContext(AuthContext);

/** Native: the magic link opens the app with ?code=...; exchange it for a session. */
async function handleLink(url: string | null) {
  if (!supabase || !url || Platform.OS === 'web') return;
  const code = Linking.parse(url).queryParams?.code;
  if (typeof code === 'string') {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.warn('Magic link failed:', error.message);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });

    const linkSub = Linking.addEventListener('url', ({ url }) => handleLink(url));
    Linking.getInitialURL().then(handleLink);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  const value = useMemo(
    () => ({ configured: isSupabaseConfigured, loading, session }),
    [loading, session],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Email a one-time sign-in link. Creates the account on first use. */
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'not-configured' };
  const redirectTo = Platform.OS === 'web' ? window.location.origin : Linking.createURL('/');
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
  return { error: error ? error.message : null };
}

export async function signOut() {
  await supabase?.auth.signOut();
}
