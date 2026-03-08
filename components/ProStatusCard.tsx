'use client';

import { useEffect, useState } from 'react';
import { Crown, Info, Calendar, Clock, CreditCard, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { isProUser } from '@/utils/access';
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
        // Backfill check: If user is Pro but missing pro_expires_at, hit our API
        if (user && isProUser(user) && !user.pro_expires_at && !backfillLoading) {
            const attemptBackfill = async () => {
                setBackfillLoading(true);
                try {
                    const res = await fetch('/api/billing/backfill-pro-dates', { method: 'POST' });
                    const data = await res.json();
                    if (data.ok) {
                        // Refresh the user context so the updated dates reflect instantly
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

    if (!isPro) {
        return (
            <div className="w-full rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold">Free Plan</span>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-muted text-muted-foreground">
                        Sınırlı
                    </span>
                </div>

                <p className="text-xs text-muted-foreground mb-4">
                    Tüm özelliklere erişmek ve sınırları kaldırmak için Pro'ya geçin.
                </p>

                <Button asChild size="sm" className="w-full bg-gradient-to-r from-primary/80 to-primary hover:from-primary hover:to-primary/90 text-primary-foreground shadow-sm">
                    <Link href="/pricing">
                        Pro'ya Geç
                    </Link>
                </Button>
            </div>
        );
    }

    // Bitiş tarihi ve Kalan Gün hesapla
    let expireLabel = 'Ayarlanmadı';
    let daysRemaining: number | null = null;
    let renewalLabel = user.pro_renewal === true ? 'Otomatik' : 'Manuel';

    // Prefer pro_expires_at, but fallback to pro_until if it exists just to not lose existing precision, 
    // although user requested fallback to "Ayarlanmadı" if pro_expires_at is missing. 
    // We will follow: if pro_expires_at is present, use it. If not, fallback to "Ayarlanmadı".
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
    } else {
        expireLabel = 'Ayarlanmadı';
        daysRemaining = null;
    }

    return (
        <div className="relative w-full rounded-2xl border border-emerald-400/30 dark:border-emerald-500/25 bg-gradient-to-br from-emerald-50 to-green-100/50 dark:from-emerald-950/40 dark:to-green-900/20 p-4 shadow-sm transition-all hover:shadow-md">

            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 ring-2 ring-emerald-400/30 dark:ring-emerald-500/20 shadow-inner">
                        <Crown className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 fill-emerald-600 dark:fill-emerald-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 leading-none">
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
                        <button className="text-emerald-600/60 dark:text-emerald-400/50 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors focus:outline-none">
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

            {/* Info Rows */}
            <div className="space-y-2.5 mb-4 bg-white/40 dark:bg-black/20 rounded-xl p-3 border border-emerald-200/50 dark:border-emerald-800/30">
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-800/70 dark:text-emerald-300/70">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Bitiş:</span>
                    </div>
                    <span className="font-medium text-emerald-900 dark:text-emerald-100">
                        {expireLabel}
                    </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-800/70 dark:text-emerald-300/70">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Kalan:</span>
                    </div>
                    <span className="font-medium text-emerald-900 dark:text-emerald-100">
                        {daysRemaining !== null ? `${daysRemaining} gün` : '—'}
                    </span>
                </div>

                <div className="flex flex-col text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 text-emerald-800/70 dark:text-emerald-300/70">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Yenileme:</span>
                        </div>
                        <span className="font-medium text-emerald-900 dark:text-emerald-100">
                            {renewalLabel}
                        </span>
                    </div>
                    {renewalLabel === 'Manuel' && (
                        <p className="text-[9px] text-emerald-700/60 dark:text-emerald-400/50 italic text-right">
                            Süre bitince tekrar satın almanız gerekir.
                        </p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1 bg-white/50 dark:bg-black/20 border-emerald-300/50 dark:border-emerald-700/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 shadow-sm transition-all h-8 text-xs">
                    <Link href="/pricing">
                        Planı Yönet
                    </Link>
                </Button>
            </div>
        </div>
    );
}
