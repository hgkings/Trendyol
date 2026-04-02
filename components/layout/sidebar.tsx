'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import {
  Crown, FileText, Upload, ArrowRight, Shield, Store,
} from 'lucide-react';
import { NAV_ITEMS, BOTTOM_NAV_ITEMS } from '@/config/navigation';
import { isProUser, hasFeature } from '@/utils/access';



export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isPro = isProUser(user);

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar border-r border-sidebar-border overflow-y-auto scrollbar-thin">
      <div className="flex h-full flex-col px-3 py-5 gap-6">



        {/* Main Nav */}
        <div>
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Menü
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const isLocked = !!item.requiredFeature && !hasFeature(user, item.requiredFeature);

              if (isLocked) {
                return (
                  <div key={item.href} className="group relative">
                    <div className="absolute right-2.5 top-2.5 z-10 pointer-events-none">
                      <div className="bg-amber-900/40 text-amber-700 dark:text-amber-400 p-0.5 rounded-full">
                        <Crown className="h-2.5 w-2.5" />
                      </div>
                    </div>
                    <Link
                      href="/pricing"
                      className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground/60 hover:bg-white/5 transition-all duration-150"
                    >
                      <item.icon className="h-4 w-4 shrink-0 opacity-50" />
                      <span className="opacity-60">{item.label}</span>
                    </Link>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-amber-500/10 border border-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'
                  )}
                >
                  <item.icon className={cn(
                    'h-4 w-4 shrink-0 transition-colors duration-150',
                    isActive ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground group-hover:text-foreground'
                  )} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Hızlı İşlemler
          </p>
          <div className="flex flex-col gap-0.5">
            {[
              { href: '/dashboard', icon: FileText, label: 'PDF Rapor' },
              { href: '/products', icon: Upload, label: 'CSV İçe Aktar' },
              { href: '/settings/commission-rates', icon: Store, label: 'Komisyon Oranları' },
            ].map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                className="group flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-150"
              >
                <div className="p-1 rounded-lg bg-muted/30 group-hover:bg-muted/50 border border-border/40 transition-all">
                  <action.icon className="h-3 w-3" />
                </div>
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-2" />

        {/* Bottom: Hesap + Admin + Version */}
        <div className="space-y-0.5">
          <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Hesap
          </p>
          <div className="flex flex-col gap-0.5">
            {BOTTOM_NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const isPremium = item.label === 'Premium';

              if (isPremium) {
                if (isPro) return null;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group relative block overflow-hidden rounded-2xl p-3.5 text-sm font-semibold transition-all duration-200 mb-1"
                    style={{
                      background: 'rgba(217,119,6,0.05)',
                      border: '1px solid rgba(217,119,6,0.12)',
                    }}
                  >
                    <p className="text-amber-700 dark:text-amber-400 font-semibold text-sm mb-1">Pro&apos;ya Yükselt</p>
                    <p className="text-muted-foreground/60 text-xs mb-3">Tüm özelliklere eriş</p>
                    <div
                      className="w-full text-center py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}
                    >
                      Planları Gör
                    </div>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-amber-500/10 border border-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'
                  )}
                >
                  <item.icon className={cn(
                    'h-4 w-4 shrink-0 transition-colors duration-150',
                    isActive ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground group-hover:text-foreground'
                  )} />
                  {item.label}
                </Link>
              );
            })}

            {/* Admin */}
            {user?.plan === 'admin' && (
              <Link
                href="/admin"
                className={cn(
                  'group flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  pathname === '/admin'
                    ? 'bg-amber-500/10 border border-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'
                )}
              >
                <Shield className={cn(
                  'h-4 w-4 shrink-0',
                  pathname === '/admin' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground group-hover:text-foreground'
                )} />
                Admin Panel
              </Link>
            )}
          </div>

          {/* Version */}
          <div className="text-[9px] text-muted-foreground/40 font-mono text-center pt-1 pb-1">
            v{process.env.NEXT_PUBLIC_BUILD_ID || '2.0.0'}
          </div>
        </div>

      </div>
    </aside>
  );
}
