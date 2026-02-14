'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import {
  LayoutDashboard,
  PlusCircle,
  Package,
  CreditCard,
  User,
  Crown,
  Settings,
} from 'lucide-react';

const mainNavItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/analysis/new', label: 'Yeni Analiz', icon: PlusCircle },
  { href: '/products', label: 'Urunler', icon: Package },
];

const bottomNavItems = [
  { href: '/pricing', label: 'Premium', icon: Crown, highlight: true },
  { href: '/account', label: 'Profil', icon: User },
  { href: '/settings', label: 'Ayarlar', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="flex h-full w-full flex-col bg-card">
      <div className="flex h-full flex-col p-4">
        {/* Main Navigation */}
        <div className="mb-4 px-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Menu
          </p>
        </div>

        <div className="flex flex-col gap-1">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Navigation */}
        <div className="mt-4 flex flex-col gap-1 border-t pt-4">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : item.highlight
                      ? 'text-primary font-semibold hover:bg-primary/5'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className={cn("h-4 w-4", item.highlight && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
