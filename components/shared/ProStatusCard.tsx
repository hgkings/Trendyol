'use client';

import { useEffect, useState } from 'react';
import { Crown, Info, Calendar, Clock, CreditCard, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { isProUser, isStarterUser, hasPaidPlan } from '@/utils/access';
import Link from 'next/link';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export function ProStatusCard() {
    const { user, refreshUser } = useAuth();
    const [backfillLoading, setBackfillLoading] = useState(false);

    useEffect(() => {
        if (user && hasPaidPlan(user) && !user.pro_expires_at && !backfillLoading) {
            const attemptBackfill = async () => {
                setBackfillLoading(true);
                try {
                    const res = await fetch('/api/billing/backfill-pro-dates', { method: 'POST' });
                    const data = await res.json();
                    if (data.ok) {
                        await refreshUser();
                    }
                } catch (e) {
                    console.error('Failed to backfill pro dates:', e);
                } finally {
                    setBackfillLoading(false);
                }
            };
            attemptBackfill();
        }
    }, [user, backfillLoading, refreshUser]);

    if (!user) return null;

    const isPro = isProUser(user);
    const isStarter = isStarterUser(user);

    // ─── FREE PLAN ───
    if (!isPro && !isStarter) {
        return (
            <div className="w-full rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold">Ücretsiz Plan</span>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-muted text-muted-foreground">
                        Sınırlı
                    </span>
                </div>

                <p className="text-xs text-muted-foreground mb-4">
                    Daha fazla analiz ve gelişmiş özellikler için planınızı yükseltin.
                </p>

                <Button asChild size="sm" className="w-full bg-gradient-to-r from-primary/80 to-primary hover:from-primary hover:to-primary/90 text-primary-foreground shadow-sm">
                    <Link href="/pricing">
                        Planı Yükselt
                    </Link>
                </Button>
            </div>
        );
    }

    // ─── Bitis tarihi ve kalan gun hesapla ───
    let expireLabel = 'Ayarlanmadı';
    let daysRemaining: number | null = null;
    const renewalLabel = user.pro_renewal === true ? 'Otomatik' : 'Manuel';

    const targetDateStr = user.pro_expires_at || user.pro_until;
    if (targetDateStr) {
        try {
            const d = new Date(targetDateStr);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                expireLabel = `${day}.${month}.${year}`;
                const diff = d.getTime() - new Date().getTime();
                daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
            }
        } catch { /* null-safe */ }
    }

    // ─── STARTER PLAN ───
    if (isStarter) {
        return (
            <div className="relative w-full rounded-2xl border border-blue-600/30 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 p-4 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-500/20 ring-2 ring-blue-200 dark:ring-blue-500/20 shadow-inner">
                            <Zap className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300 leading-none">
                                Kârnet Başlangıç
                            </span>
                            <div className="flex items-center gap-1 mt-1.5">
                                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border border-blue-300 dark:border-blue-700 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400">
                                    Aktif
                                </span>
                            </div>
                        </div>
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="text-blue-500/60 dark:text-blue-400/50 hover:text-blue-600 dark:hover:text-blue-300 transition-colors focus:outline-none">
                                <Info className="w-4 h-4" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3 text-xs" align="end" side="right" sideOffset={8}>
                            <p className="font-semibold mb-1">Başlangıç Plan Özellikleri</p>
                            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                                <li>25 ürün analizi</li>
                                <li>CSV içe/dışa aktarma</li>
                                <li>Başabaş hesaplama</li>
                                <li>Duyarlılık analizi</li>
                            </ul>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-2.5 mb-4 bg-white/60 dark:bg-background/50 rounded-xl p-3 border border-blue-200/60 dark:border-blue-800/30">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-blue-600/70 dark:text-blue-300/70">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Bitiş:</span>
                        </div>
                        <span className="font-medium text-blue-800 dark:text-blue-100">{expireLabel}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-blue-600/70 dark:text-blue-300/70">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Kalan:</span>
                        </div>
                        <span className="font-medium text-blue-800 dark:text-blue-100">
                            {daysRemaining !== null ? `${daysRemaining} gün` : '—'}
                        </span>
                    </div>
                    <div className="flex flex-col text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-1.5 text-blue-600/70 dark:text-blue-300/70">
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Yenileme:</span>
                            </div>
                            <span className="font-medium text-blue-800 dark:text-blue-100">{renewalLabel}</span>
                        </div>
                        {renewalLabel === 'Manuel' && (
                            <p className="text-[9px] text-blue-500/60 dark:text-blue-400/50 italic text-right">
                                Süre bitince tekrar satın almanız gerekir.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline" className="flex-1 bg-white/60 dark:bg-background/50 border-blue-300 dark:border-blue-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-200 shadow-sm transition-all h-8 text-xs">
                        <Link href="/pricing">
                            Planı Yönet
                        </Link>
                    </Button>
                </div>
            </div>
        );
    }

    // ─── PRO PLAN ───
    return (
        <div className="relative w-full rounded-2xl border border-emerald-600/30 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-500/20 ring-2 ring-emerald-200 dark:ring-emerald-500/20 shadow-inner">
                        <Crown className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 fill-emerald-600 dark:fill-emerald-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 leading-none">
                            Kârnet Pro
                        </span>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400">
                                Aktif
                            </span>
                        </div>
                    </div>
                </div>

                <Popover>
                    <PopoverTrigger asChild>
                        <button className="text-emerald-500/60 dark:text-emerald-400/50 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors focus:outline-none">
                            <Info className="w-4 h-4" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3 text-xs" align="end" side="right" sideOffset={8}>
                        <p className="font-semibold mb-1">Pro Plan Özellikleri</p>
                        <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                            <li>Sınırsız analiz</li>
                            <li>Pazaryeri entegrasyonları</li>
                            <li>Toplu CSV / PDF işlemleri</li>
                            <li>Premium destek</li>
                        </ul>
                    </PopoverContent>
                </Popover>
            </div>

            <div className="space-y-2.5 mb-4 bg-white/60 dark:bg-background/50 rounded-xl p-3 border border-emerald-200/60 dark:border-emerald-800/30">
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-600/70 dark:text-emerald-300/70">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Bitiş:</span>
                    </div>
                    <span className="font-medium text-emerald-800 dark:text-emerald-100">{expireLabel}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-600/70 dark:text-emerald-300/70">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Kalan:</span>
                    </div>
                    <span className="font-medium text-emerald-800 dark:text-emerald-100">
                        {daysRemaining !== null ? `${daysRemaining} gün` : '—'}
                    </span>
                </div>
                <div className="flex flex-col text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 text-emerald-600/70 dark:text-emerald-300/70">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Yenileme:</span>
                        </div>
                        <span className="font-medium text-emerald-800 dark:text-emerald-100">{renewalLabel}</span>
                    </div>
                    {renewalLabel === 'Manuel' && (
                        <p className="text-[9px] text-emerald-500/60 dark:text-emerald-400/50 italic text-right">
                            Süre bitince tekrar satın almanız gerekir.
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1 bg-white/60 dark:bg-background/50 border-emerald-300 dark:border-emerald-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200 shadow-sm transition-all h-8 text-xs">
                    <Link href="/pricing">
                        Planı Yönet
                    </Link>
                </Button>
            </div>
        </div>
    );
}
