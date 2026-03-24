'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import {
  Crown, FileText, Upload, CreditCard, ArrowRight, Shield, Store,
} from 'lucide-react';
import { NAV_ITEMS, BOTTOM_NAV_ITEMS } from '@/config/navigation';
import { isProUser } from '@/utils/access';
import { ProStatusCard } from '@/components/shared/ProStatusCard';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isPro = isProUser(user);

  return (
    <aside className="flex h-full w-full flex-col bg-[rgba(255,255,255,0.01)] border-r border-[rgba(255,255,255,0.06)] overflow-y-auto scrollbar-thin">
      <div className="flex h-full flex-col px-3 py-5 gap-6">

        {/* Pro Status */}
        <div className="w-full">
          <ProStatusCard />
        </div>

        {/* Main Nav */}
        <div>
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.3)]">
            Menü
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const isLocked = (item as any).restricted && !isPro;

              if (isLocked) {
                return (
                  <div key={item.href} className="group relative">
                    <div className="absolute right-2.5 top-2.5 z-10 pointer-events-none">
                      <div className="bg-amber-900/40 text-amber-400 p-0.5 rounded-full">
                        <Crown className="h-2.5 w-2.5" />
                      </div>
                    </div>
                    <Link
                      href="/pricing"
                      className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-[rgba(255,255,255,0.3)] hover:bg-white/5 transition-all duration-150"
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
                      ? 'bg-amber-500/10 border border-amber-500/15 text-amber-400 font-semibold'
                      : 'text-[rgba(255,255,255,0.5)] hover:bg-white/5 hover:text-white border border-transparent'
                  )}
                >
                  <item.icon className={cn(
                    'h-4 w-4 shrink-0 transition-colors duration-150',
                    isActive ? 'text-amber-400' : 'text-[rgba(255,255,255,0.5)] group-hover:text-white'
                  )} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.3)]">
            Hızlı İşlemler
          </p>
          <div className="flex flex-col gap-0.5">
            {[
              { href: '/dashboard', icon: FileText, label: 'PDF Rapor' },
              { href: '/products', icon: Upload, label: 'CSV İçe Aktar' },
              { href: '/settings/commission-rates', icon: Store, label: 'Komisyon Oranları' },
              { href: '/pricing', icon: CreditCard, label: 'Fiyatlandırma' },
            ].map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                className="group flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-xs font-medium text-[rgba(255,255,255,0.5)] hover:bg-white/5 hover:text-white transition-all duration-150"
              >
                <div className="p-1 rounded-lg bg-white/[0.03] group-hover:bg-white/[0.06] border border-[rgba(255,255,255,0.06)] transition-all">
                  <action.icon className="h-3 w-3" />
                </div>
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Nav */}
        <div>
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.3)]">
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
                    <p className="text-amber-400 font-semibold text-sm mb-1">Pro&apos;ya Yükselt</p>
                    <p className="text-[rgba(255,255,255,0.3)] text-xs mb-3">Tüm özelliklere eriş</p>
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
                      ? 'bg-amber-500/10 border border-amber-500/15 text-amber-400 font-semibold'
                      : 'text-[rgba(255,255,255,0.5)] hover:bg-white/5 hover:text-white border border-transparent'
                  )}
                >
                  <item.icon className={cn(
                    'h-4 w-4 shrink-0 transition-colors duration-150',
                    isActive ? 'text-amber-400' : 'text-[rgba(255,255,255,0.5)] group-hover:text-white'
                  )} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Admin */}
        {user?.plan === 'admin' && (
          <Link
            href="/admin"
            className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-[rgba(255,255,255,0.5)] hover:bg-white/5 hover:text-white transition-all border border-transparent"
          >
            <Shield className="h-4 w-4" />
            Admin Panel
          </Link>
        )}

        {/* Version */}
        <div className="text-[9px] text-[rgba(255,255,255,0.15)] font-mono text-center pb-1">
          v{process.env.NEXT_PUBLIC_BUILD_ID || '1.0.0'}
        </div>

      </div>
    </aside>
  );
}
