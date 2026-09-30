import type { Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';

export type Role = 'admin' | 'staff';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  role: Role | null;
  loading: boolean;
  /** True once `loading` has taken longer than AUTH_TIMEOUT_MS (slow/paused Supabase, bad network). */
  stuck: boolean;
  /** Re-runs session + role resolution (e.g. from a "Retry" button when `stuck` is true). */
  retry: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

// Supabase auth/PostgREST calls have no built-in timeout, so a paused free-tier project or a
// flaky connection can otherwise leave the app on an unrecoverable spinner forever. After this
// long we stop blocking the UI and offer a Retry instead (the original request keeps running in
// the background and still completes normally if it was just slow).
const AUTH_TIMEOUT_MS = 10000;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchRole(userId: string): Promise<Role> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return 'staff';
    return data.role === 'admin' ? 'admin' : 'staff';
  } catch {
    return 'staff';
  }
}

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (m.includes('email not confirmed')) return 'This email has not been confirmed yet.';
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  return 'Could not sign in. Please try again.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [stuck, setStuck] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const retry = useCallback(() => {
    // Reset here (an event handler), not inside the effect body, so the effect never calls
    // setState synchronously on every run.
    setLoading(true);
    setStuck(false);
    setRetryNonce((n) => n + 1);
  }, []);

  // Supabase RN guidance: only auto-refresh tokens while the app is in the foreground.
  useEffect(() => {
    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => {
      sub.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    let active = true;
    // loading/stuck are already correct for this run: the initial values on first mount, or
    // whatever retry() just set before bumping retryNonce.
    const stuckTimer = setTimeout(() => {
      if (active) setStuck(true);
    }, AUTH_TIMEOUT_MS);

    // Resolve session + role, then mark loading done.
    const apply = async (next: Session | null) => {
      const nextRole = next?.user ? await fetchRole(next.user.id) : null;
      if (!active) return;
      clearTimeout(stuckTimer);
      setSession(next);
      setRole(nextRole);
      setLoading(false);
      setStuck(false);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => apply(null));

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION') return; // handled by getSession above
      // Defer: awaiting supabase calls inside this callback can deadlock.
      setTimeout(() => {
        void apply(next);
      }, 0);
    });

    return () => {
      active = false;
      clearTimeout(stuckTimer);
      data.subscription.unsubscribe();
    };
  }, [retryNonce]);

  const signIn = useCallback(async (email: string, password: string) => {
    let errorMessage: string | null = null;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) errorMessage = error.message;
    } catch (e: any) {
      errorMessage = e?.message ?? 'network';
    }
    if (errorMessage) throw new Error(friendlyError(errorMessage));
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, role, loading, stuck, retry, signIn, signOut }),
    [session, role, loading, stuck, retry, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
