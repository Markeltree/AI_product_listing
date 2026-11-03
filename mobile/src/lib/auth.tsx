import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from './api';
import { clearToken, loadToken, saveToken } from './session';
import type { User } from './types';

type Status = 'loading' | 'signedIn' | 'signedOut';

interface AuthValue {
  status: Status;
  user: User | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const finishSignIn = useCallback(async (res: { user: User; token: string }) => {
    await saveToken(res.token);
    setToken(res.token);
    setUser(res.user);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
    (async () => {
      const saved = await loadToken();
      if (!saved) return setStatus('signedOut');
      setToken(saved);
      try {
        const { user: me } = await api<{ user: User }>('/api/auth/me');
        setUser(me);
        setStatus('signedIn');
      } catch {
        await clearToken();
        setToken(null);
        setStatus('signedOut');
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo<AuthValue>(() => ({
    status,
    user,
    token,
    signIn: async (email, password) => {
      const res = await api<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      await finishSignIn(res);
    },
    signUp: async (name, email, password) => {
      const res = await api<{ user: User; token: string }>('/api/auth/signup', {
        method: 'POST',
        body: { name, email, password },
      });
      await finishSignIn(res);
    },
    signOut,
    updateUser: (patch) => setUser((u) => (u ? { ...u, ...patch } : u)),
  }), [status, user, token, finishSignIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
