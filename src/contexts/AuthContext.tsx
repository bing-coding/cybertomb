import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Sign In ────────────────────────────────────────────────────────────────
  // Priority 1: look up internal email via profiles RPC (migration applied).
  // Fallback:   use legacy  username@cybertomb.app  format so existing
  //             accounts keep working before / without the migration.
  const signIn = async (username: string, password: string) => {
    const normalized = username.toLowerCase().trim();

    let loginEmail: string;

    const { data: internalEmail, error: rpcError } = await supabase
      .rpc('get_internal_email', { p_username: normalized });

    if (!rpcError && internalEmail) {
      // New profiles-based system
      loginEmail = internalEmail as string;
    } else {
      // Fallback: legacy  username@cybertomb.app  (covers "migration not run"
      // AND "old account predates the profiles table")
      loginEmail = `${normalized}@cybertomb.app`;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('INVALID_CREDENTIALS');
      }
      throw error;
    }
  };

  // ── Sign Up ────────────────────────────────────────────────────────────────
  // If the migration RPCs are available → use the new profiles-based flow
  // (supports any username including ones that look like emails).
  // If not yet migrated → fall back to legacy  username@cybertomb.app  flow.
  //
  // PREREQUISITE for the new flow: run supabase/migrations/001_schema_updates.sql
  // in the Supabase SQL editor, and disable "Enable email confirmations".
  const signUp = async (username: string, password: string) => {
    const normalized = username.toLowerCase().trim();

    const { data: available, error: checkError } = await supabase
      .rpc('check_username_available', { p_username: normalized });

    if (checkError) {
      // ── Legacy fallback (migration not yet applied) ──────────────────────
      const legacyEmail = `${normalized}@cybertomb.app`;
      const { error: legacyErr } = await supabase.auth.signUp({
        email: legacyEmail,
        password,
      });
      if (legacyErr) {
        if (legacyErr.message.includes('User already registered')) throw new Error('USERNAME_TAKEN');
        // Username looks like an email → invalid legacy address
        if (legacyErr.message.includes('invalid format') || legacyErr.message.includes('validate email')) {
          throw new Error('USERNAME_EMAIL_LEGACY');
        }
        throw legacyErr;
      }
      return;
    }

    // ── New profiles-based flow ──────────────────────────────────────────────
    if (!available) throw new Error('USERNAME_TAKEN');

    const internalEmail = `u-${crypto.randomUUID()}@cybertomb.app`;

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: internalEmail,
      password,
      options: { data: { username: username.trim() } },
    });

    if (signUpError) throw signUpError;
    if (!authData.user) throw new Error('SYSTEM_ERROR');

    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      username: username.trim(),
      username_normalized: normalized,
      internal_email: internalEmail,
    });

    if (profileError) throw new Error('USERNAME_TAKEN');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
