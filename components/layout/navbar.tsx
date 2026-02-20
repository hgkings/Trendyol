'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { ThemeToggle } from './theme-toggle';
import { NotificationDrawer } from '@/components/dashboard/notification-drawer';
import { Button } from '@/components/ui/button';
import { TrendingUp, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NAV_ITEMS, BOTTOM_NAV_ITEMS } from '@/config/navigation';

export function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="border-b bg-card/80 backdrop-blur-xl shadow-premium-sm">
      <div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2.5">
          <div className="relative h-9 w-auto">
            <img src="/brand/logo.svg" alt="Kârnet" className="h-9 w-auto dark:hidden" />
            <img src="/brand/logo-dark.svg" alt="Kârnet" className="h-9 w-auto hidden dark:block" />
          </div>
        </Link>
        <div className="flex flex-1" />

        <div className="hidden items-center gap-2 md:flex">
          {!user ? (
            <>
              <Link href="/pricing">
                <Button variant="ghost" size="sm" className="rounded-[10px] font-medium">Fiyatlandırma</Button>
              </Link>
              <ThemeToggle />
              <Link href="/auth">
                <Button size="sm" className="rounded-[10px] font-medium shadow-premium-sm">Giriş Yap</Button>
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2 hidden lg:inline-block">
                {user.email}
              </span>
              <NotificationDrawer />
              <ThemeToggle />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {user && <NotificationDrawer />}
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t bg-card px-4 py-4 md:hidden overflow-y-auto max-h-[calc(100vh-64px)]">
          <div className="flex flex-col gap-1.5">
            {user ? (
              <>
                {NAV_ITEMS.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start rounded-lg gap-2">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                ))}

                <div className="my-2 border-t border-dashed" />

                {BOTTOM_NAV_ITEMS.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start rounded-lg gap-2">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                ))}

                <Button variant="outline" className="w-full rounded-[10px] mt-2" onClick={() => { logout(); setMobileOpen(false); }}>
                  Çıkış
                </Button>
              </>
            ) : (
              <>
                <Link href="/pricing" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start rounded-lg">Fiyatlandırma</Button>
                </Link>
                <Link href="/auth" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full rounded-[10px]">Giriş Yap</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
