'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User } from '@/types';
import { fetchProfile, login as authLogin, register as authRegister, logout as authLogout, updateUserPlan, updateProfile as authUpdateProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface AuthContextType {
  user: User | null;
  loading: boolean;
  mfaRequired: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; mfaRequired?: boolean }>;
  register: (email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  upgradePlan: () => Promise<void>;
  refreshUser: () => Promise<void>;
  completeMFA: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        return;
      }
      const profile = await fetchProfile(session.user.id, session.user.email!);
      setUser(profile);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await refreshUser();
      if (mounted) setLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: { user: { id: string; email?: string } } | null) => {
      if (!session?.user) {
        setUser(null);
        return;
      }
      (async () => {
        const profile = await fetchProfile(session.user.id, session.user.email!);
        if (mounted) setUser(profile);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authLogin(email, password);
    if (result.success && result.mfaRequired) {
      setMfaRequired(true);
      return { success: true, mfaRequired: true };
    }
    if (result.success && result.user) {
      setUser(result.user);
      setMfaRequired(false);
    }
    return { success: result.success, error: result.error };
  }, []);

  const completeMFA = useCallback(async () => {
    setMfaRequired(false);
    await refreshUser();
  }, [refreshUser]);

  const register = useCallback(async (email: string, password: string, fullName?: string) => {
    const result = await authRegister(email, password, fullName);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return { success: result.success, error: result.error };
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
    window.location.href = '/';
  }, []);

  const upgradePlan = useCallback(async () => {
    if (user) {
      await updateUserPlan(user.id, 'pro');
      setUser({ ...user, plan: 'pro' });
    }
  }, [user]);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!user) return { success: false, error: 'Kullanici bulunamadi.' };
    const result = await authUpdateProfile(user.id, updates);
    if (result.success) {
      setUser({ ...user, ...updates });
    }
    return result;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, mfaRequired, login, register, logout, upgradePlan, refreshUser, completeMFA, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
