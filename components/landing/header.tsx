'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import { KarnetLogo } from '@/components/shared/KarnetLogo';

export function Header() {
  const { user } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '#features', label: 'Özellikler' },
    { href: '#how-it-works', label: 'Nasıl Çalışır?' },
    { href: '/pricing', label: 'Fiyatlandırma' },
    { href: '/demo', label: 'Demo' },
    { href: '/blog', label: 'Blog' },
  ];

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-[rgba(12,10,9,0.85)] backdrop-blur-xl border-b border-[rgba(255,255,255,0.06)] shadow-sm'
          : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <KarnetLogo size={36} />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="px-3.5 py-2 text-sm font-medium text-[rgba(255,255,255,0.5)] hover:text-white rounded-xl hover:bg-white/5 transition-all duration-150 animated-underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <Link href="/dashboard">
              <Button
                size="sm"
                className="h-9 px-4 rounded-xl font-medium btn-shine shadow-sm text-white"
                style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}
              >
                Panele Git
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/auth">
                <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl font-medium text-[rgba(255,255,255,0.5)] hover:text-white">
                  Giriş Yap
                </Button>
              </Link>
              <Link href="/auth">
                <Button
                  size="sm"
                  className="h-9 px-4 rounded-xl font-medium btn-shine shadow-sm text-white hover:shadow-lg hover:shadow-amber-500/30 hover:-translate-y-[1px] transition-all"
                  style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}
                >
                  Ücretsiz Başla
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] bg-[#0C0A09] border-[rgba(255,255,255,0.06)]">
              <SheetHeader className="text-left pb-2">
                <KarnetLogo size={36} />
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="my-3 border-t border-[rgba(255,255,255,0.06)]" />
                {user ? (
                  <Link href="/dashboard" onClick={() => setOpen(false)}>
                    <Button className="w-full rounded-xl btn-shine text-white" style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}>
                      Panele Git
                    </Button>
                  </Link>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link href="/auth" onClick={() => setOpen(false)}>
                      <Button variant="outline" className="w-full rounded-xl border-[rgba(255,255,255,0.06)]">Giriş Yap</Button>
                    </Link>
                    <Link href="/auth" onClick={() => setOpen(false)}>
                      <Button className="w-full rounded-xl btn-shine text-white" style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}>
                        Ücretsiz Başla
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
