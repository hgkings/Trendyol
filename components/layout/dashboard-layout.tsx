'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from './navbar';
import { Sidebar } from './sidebar';
import { CriticalBanner } from './critical-banner';
import { useAuth } from '@/contexts/auth-context';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sticky Top Header */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navbar />
        <CriticalBanner />
      </div>

      {/* Main Content Wrapper */}
      <div className="flex w-full pt-16">
        {/* Fixed Left Sidebar (Desktop) */}
        <div className="hidden md:fixed md:left-0 md:top-16 md:bottom-0 md:flex md:w-64 md:flex-col md:border-r md:bg-card">
          <Sidebar />
        </div>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto md:pl-64 h-[calc(100vh-64px)]">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
