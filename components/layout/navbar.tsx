'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { NotificationDrawer } from '@/components/dashboard/notification-drawer';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NAV_ITEMS, BOTTOM_NAV_ITEMS } from '@/config/navigation';
import { KarnetLogo } from '@/components/shared/KarnetLogo';

export function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(12,10,9,0.85)] backdrop-blur-xl sticky top-0 z-50">
      <div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center">
          <KarnetLogo size={36} />
        </Link>
        <div className="flex flex-1" />

        <div className="hidden items-center gap-2 md:flex">
          {!user ? (
            <>
              <Link href="/pricing">
                <Button variant="ghost" size="sm" className="rounded-xl font-medium text-[rgba(255,255,255,0.5)] hover:text-white">Fiyatlandırma</Button>
              </Link>
              <Link href="/auth">
                <Button variant="outline" size="sm" className="rounded-xl font-medium border-[rgba(255,255,255,0.06)]">Giriş Yap</Button>
              </Link>
              <Link href="/auth">
                <Button size="sm" className="rounded-xl font-medium text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}>
                  Ücretsiz Başla
                </Button>
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[rgba(255,255,255,0.5)] mr-2 hidden lg:inline-block">
                {user.email}
              </span>
              <NotificationDrawer />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {user && <NotificationDrawer />}
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[rgba(255,255,255,0.06)] bg-[#0C0A09] px-4 py-4 md:hidden overflow-y-auto max-h-[calc(100vh-64px)]">
          <div className="flex flex-col gap-1.5">
            {user ? (
              <>
                {NAV_ITEMS.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start rounded-xl gap-2 text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-white/5">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                ))}

                <div className="my-2 border-t border-[rgba(255,255,255,0.06)]" />

                {BOTTOM_NAV_ITEMS.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start rounded-xl gap-2 text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-white/5">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                ))}

                <Button variant="outline" className="w-full rounded-xl mt-2 border-[rgba(255,255,255,0.06)]" onClick={() => { logout(); setMobileOpen(false); }}>
                  Çıkış
                </Button>
              </>
            ) : (
              <>
                <Link href="/pricing" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start rounded-xl text-[rgba(255,255,255,0.5)] hover:text-white">Fiyatlandırma</Button>
                </Link>
                <Link href="/auth" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}>Giriş Yap</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
