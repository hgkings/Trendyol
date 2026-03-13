'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Users,
    CreditCard,
    MessageSquare,
    ArrowLeft,
    Shield,
} from 'lucide-react';
import { ThemeToggle } from './theme-toggle';

const ADMIN_NAV = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Kullanıcılar', href: '/admin/users', icon: Users },
    { label: 'Ödemeler', href: '/admin/payments', icon: CreditCard },
    { label: 'Destek', href: '/admin/support', icon: MessageSquare },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (!loading && (!user || user.plan !== 'admin')) {
            router.replace('/dashboard');
        }
    }, [user, loading, router]);

    if (loading || !user || user.plan !== 'admin') {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-56 shrink-0 flex flex-col bg-card border-r">
                <div className="flex items-center gap-2 px-4 py-5 border-b">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="font-bold text-sm">Admin Panel</span>
                </div>

                <nav className="flex-1 px-2 py-4 space-y-1">
                    {ADMIN_NAV.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                            >
                                <item.icon className="h-4 w-4 shrink-0" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="px-2 py-4 border-t space-y-1">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 shrink-0" />
                        Uygulamaya Dön
                    </Link>
                    <div className="px-3 py-1">
                        <ThemeToggle />
                    </div>
                </div>
            </aside>

            {/* Content */}
            <main className="flex-1 overflow-y-auto p-6">
                {children}
            </main>
        </div>
    );
}
