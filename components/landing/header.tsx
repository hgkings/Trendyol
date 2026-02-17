import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { TrendingUp, Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function Header() {
    const { user } = useAuth();
    const [isScrolled, setIsScrolled] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { href: '#features', label: 'Özellikler' },
        { href: '#how-it-works', label: 'Nasıl Çalışır?' },
        { href: '/pricing', label: 'Fiyatlandırma' },
    ];

    return (
        <header
            className={cn(
                'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
                isScrolled
                    ? 'bg-background/80 backdrop-blur-xl border-b shadow-premium-sm'
                    : 'bg-transparent'
            )}
        >
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5 group">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary transition-transform group-hover:scale-105">
                        <TrendingUp className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight">Kârnet</span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.label}
                            href={link.href}
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/* Right Actions */}
                <div className="hidden md:flex items-center gap-3">
                    <ThemeToggle />
                    {user ? (
                        <Link href="/dashboard">
                            <Button size="sm" className="rounded-[10px] h-9 px-4 font-medium shadow-premium-sm">
                                Panel&apos;e Git
                            </Button>
                        </Link>
                    ) : (
                        <>
                            <Link href="/auth">
                                <Button variant="ghost" size="sm" className="rounded-[10px] h-9 px-4 font-medium">
                                    Giriş Yap
                                </Button>
                            </Link>
                            <Link href="/auth">
                                <Button size="sm" className="rounded-[10px] h-9 px-4 font-medium shadow-premium-sm">
                                    Ücretsiz Başla
                                </Button>
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile Menu */}
                <div className="flex items-center gap-2 md:hidden">
                    <ThemeToggle />
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[300px] sm:w-[380px]">
                            <SheetHeader>
                                <SheetTitle className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                                        <TrendingUp className="h-4 w-4 text-primary-foreground" />
                                    </div>
                                    Kârnet
                                </SheetTitle>
                            </SheetHeader>
                            <div className="mt-8 flex flex-col gap-1">
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.label}
                                        href={link.href}
                                        onClick={() => setOpen(false)}
                                        className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                                <div className="my-3 border-t" />
                                {user ? (
                                    <Link href="/dashboard" onClick={() => setOpen(false)}>
                                        <Button className="w-full rounded-[10px]">Panel&apos;e Git</Button>
                                    </Link>
                                ) : (
                                    <>
                                        <Link href="/auth" onClick={() => setOpen(false)}>
                                            <Button variant="outline" className="w-full rounded-[10px]">
                                                Giriş Yap
                                            </Button>
                                        </Link>
                                        <Link href="/auth" onClick={() => setOpen(false)} className="mt-2">
                                            <Button className="w-full rounded-[10px]">Ücretsiz Başla</Button>
                                        </Link>
                                    </>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}
