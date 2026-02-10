import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { User as AppUser } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AppUser | null>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  refreshProfile: () => Promise<AppUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PROFILE_FETCH_TIMEOUT_MS = 8_000;
const SESSION_RETRY_DELAY_MS = 250;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mapAuthToUser = async (authUser: { id: string; email?: string | null; email_confirmed_at?: string | null; }) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, username, allowedUnitIds:allowed_unit_ids, isActive:is_active')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const user: AppUser = {
    id: authUser.id,
    email: authUser.email || data?.email || '',
    role: (data?.role as AppUser['role']) || 'user',
    verified: Boolean(authUser.email_confirmed_at),
    isActive: data?.isActive ?? true,
    createdAt: undefined,
    username: data?.username || undefined,
    allowedUnitIds: data?.allowedUnitIds || [],
  };

  return user;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshRequestIdRef = useRef(0);

  const refreshProfile = async () => {
    const requestId = ++refreshRequestIdRef.current;
    let { data: sessionData, error: sessionError } = await withTimeout(
      supabase.auth.getSession(),
      PROFILE_FETCH_TIMEOUT_MS,
      'Session fetch timed out'
    );

    // signIn直後などで session が一瞬空になるケースを吸収する
    if (!sessionError && !sessionData.session?.user) {
      await wait(SESSION_RETRY_DELAY_MS);
      ({ data: sessionData, error: sessionError } = await withTimeout(
        supabase.auth.getSession(),
        PROFILE_FETCH_TIMEOUT_MS,
        'Session fetch timed out (retry)'
      ));
    }

    if (sessionError || !sessionData.session?.user) {
      if (requestId === refreshRequestIdRef.current && !user) {
        setUser(null);
      }
      return null;
    }

    const appUser = await withTimeout(
      mapAuthToUser({
        id: sessionData.session.user.id,
        email: sessionData.session.user.email,
        email_confirmed_at: sessionData.session.user.email_confirmed_at,
      }),
      PROFILE_FETCH_TIMEOUT_MS,
      'Profile fetch timed out'
    );

    if (appUser.isActive === false) {
      await supabase.auth.signOut();
      if (requestId === refreshRequestIdRef.current) {
        setUser(null);
      }
      return null;
    }

    if (requestId === refreshRequestIdRef.current) {
      setUser(appUser);
    }
    return appUser;
  };

  useEffect(() => {
    const init = async () => {
      try {
        await refreshProfile();
      } catch (_error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }
      try {
        await refreshProfile();
      } catch (_error) {
        // 一時的な取得失敗で即ログアウトさせない
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    const appUser = await refreshProfile();
    return appUser;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const register = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/verify`,
      },
    });

    if (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
