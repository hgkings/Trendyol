'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User } from '@/types';
import { fetchProfile, login as authLogin, register as authRegister, logout as authLogout, updateUserPlan, updateProfile as authUpdateProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  upgradePlan: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
    if (result.success && result.user) {
      setUser(result.user);
    }
    return { success: result.success, error: result.error };
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const result = await authRegister(email, password);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return { success: result.success, error: result.error };
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
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
    <AuthContext.Provider value={{ user, loading, login, register, logout, upgradePlan, refreshUser, updateProfile }}>
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
