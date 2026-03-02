'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import {
  Crown,
  FileText,
  Upload,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { NAV_ITEMS, BOTTOM_NAV_ITEMS } from '@/config/navigation';
import { isProUser } from '@/utils/access';
import { ProStatusCard } from '@/components/ProStatusCard';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isPro = isProUser(user);

  return (
    <aside className="flex h-full w-full flex-col bg-card border-r overflow-y-auto scrollbar-thin scrollbar-thumb-muted/50">
      <div className="flex h-full flex-col px-3 py-4 space-y-6">

        {/* --- 1. PRO Status Card --- */}
        <div className="mb-2 w-full mt-2">
          <ProStatusCard />
        </div>

        {/* --- Main Navigation --- */}
        <div>
          <div className="mb-2 px-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Menü
            </p>
          </div>
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const isProducts = item.href === '/products';
              const isLocked = (item as any).restricted && !isPro;

              if (isLocked) {
                return (
                  <div key={item.href} className="group relative">
                    <div className="absolute right-2 top-2.5 z-10 pointer-events-none">
                      <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 p-0.5 rounded-full">
                        <Crown className="h-3 w-3" />
                      </div>
                    </div>
                    <Link
                      href="/pricing"
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 text-muted-foreground/60 hover:bg-muted/50 cursor-pointer',
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0 opacity-70" />
                      <div className="flex-1 opacity-70">
                        {item.label}
                      </div>
                    </Link>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105",
                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />

                  <div className="flex flex-1 items-center justify-between min-w-0">
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* --- 2. Quick Actions --- */}
        <div>
          <div className="mb-2 px-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Hızlı İşlemler
            </p>
          </div>
          <div className="grid gap-1">
            {/* PDF Report: Smart redirect to dashboard if not on analysis page */}
            <Link href={pathname.includes('/analysis/') ? '#' : '/dashboard'}
              onClick={(e) => {
                // If on analysis page, let the user click the actual button on page (passive link)
                // If not, redirect to dashboard.
                if (pathname.includes('/analysis/') && pathname !== '/analysis/new') {
                  e.preventDefault();
                  // Just a visual cue or toast could happen here, but we keep it simple.
                  // The user is already on the page where the big "PDF Indir" button exists.
                }
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all group"
            >
              <div className="p-1.5 rounded-md bg-muted group-hover:bg-background border border-transparent group-hover:border-border transition-colors">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <span>PDF Rapor</span>
              {/* Visual hint if on analysis page */}
              {pathname.includes('/analysis/') && pathname !== '/analysis/new' && (
                <ArrowRight className="h-3 w-3 ml-auto opacity-50" />
              )}
            </Link>

            <Link href="/products" className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all group">
              <div className="p-1.5 rounded-md bg-muted group-hover:bg-background border border-transparent group-hover:border-border transition-colors">
                <Upload className="h-3.5 w-3.5" />
              </div>
              <span>CSV İçe Aktar</span>
            </Link>

            <Link href="/pricing" className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all group">
              <div className="p-1.5 rounded-md bg-muted group-hover:bg-background border border-transparent group-hover:border-border transition-colors">
                <CreditCard className="h-3.5 w-3.5" />
              </div>
              <span>Fiyatlandırma</span>
            </Link>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Navigation */}
        <div className="space-y-1">
          <div className="mb-2 px-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Hesap
            </p>
          </div>

          {BOTTOM_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const isPremium = item.label === 'Premium';

            if (isPremium) {
              if (isPro) {
                // Already showing a big ProStatusCard at the top, no need to show it again here
                return null;
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group relative block overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-3 py-2.5 text-sm font-medium transition-all duration-300 hover:shadow-premium-sm border border-primary/20 mb-1"
                >
                  <div className="flex items-center gap-3 text-primary">
                    <Crown className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                    <span className="font-semibold">Pro&apos;ya Katıl</span>
                  </div>
                  <div className="absolute inset-0 -translate-x-full group-hover:animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className={cn(
                  "h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-105",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Version */}
        <div className="text-[9px] text-muted-foreground/30 font-mono text-center">
          v{process.env.NEXT_PUBLIC_BUILD_ID || '1.0.0'}
        </div>

      </div>
    </aside>
  );
}
