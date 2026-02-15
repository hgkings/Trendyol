'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { ThemeToggle } from './theme-toggle';
import { NotificationDrawer } from '@/components/dashboard/notification-drawer';
import { Button } from '@/components/ui/button';
import { TrendingUp, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="border-b bg-card/80 backdrop-blur-xl shadow-premium-sm">
      <div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Kar Koçu
          </span>
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
        <div className="border-t bg-card px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1.5">
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start rounded-lg">Panel</Button>
                </Link>
                <Link href="/analysis/new" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start rounded-lg">Yeni Analiz</Button>
                </Link>
                <Link href="/products" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start rounded-lg">Ürünler</Button>
                </Link>
                <Link href="/pricing" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start rounded-lg">Premium</Button>
                </Link>
                <Link href="/account" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start rounded-lg">Profil</Button>
                </Link>
                <Link href="/settings" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start rounded-lg">Ayarlar</Button>
                </Link>
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
