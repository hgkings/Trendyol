'use client';

import { useAuth } from '@/contexts/auth-context';
import { Analysis } from '@/types';
import { useEffect, useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, AlertTriangle, AlertOctagon, ArrowRight, Calendar } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 6) return 'İyi geceler';
    if (h < 12) return 'Günaydın';
    if (h < 17) return 'İyi günler';
    return 'İyi akşamlar';
}

function getNameFromEmail(email?: string): string {
    if (!email) return '';
    const prefix = email.split('@')[0];
    const cleaned = prefix.replace(/[._\-0-9]/g, ' ').trim().split(' ')[0];
    if (!cleaned || cleaned.length < 2) return 'Kullanıcı';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

type RiskLevel = 'safe' | 'moderate' | 'high';

interface DashboardHeaderProps {
    analyses: Analysis[];
}

export function DashboardHeader({ analyses }: DashboardHeaderProps) {
    const { user } = useAuth();
    const [riskLevel, setRiskLevel] = useState<RiskLevel>('safe');
    const [riskLabel, setRiskLabel] = useState('');

    const isPro = user?.plan === 'pro' || user?.plan === 'pro_monthly' || user?.plan === 'pro_yearly' || user?.plan === 'admin';

    useEffect(() => {
        if (!user || !isPro) return;
        const checkRisk = async () => {
            let level: RiskLevel = 'safe';
            try {
                const res = await fetch('/api/cash-plan/risk');
                if (res.ok) {
                    const { negativeMonths } = await res.json();
                    if (negativeMonths > 0) {
                        level = 'high';
                        setRiskLabel(`${negativeMonths} ayda nakit acigi`);
                    }
                }
            } catch { /* optional */ }
            if (level === 'safe') setRiskLabel('Finansal durum dengeli');
            setRiskLevel(level);
        };
        checkRisk();
    }, [user, isPro]);

    const name = getNameFromEmail(user?.email);
    const greeting = getGreeting();
    const { profitableCount, riskyCount } = useMemo(() => ({
        profitableCount: analyses.filter(a => a.result.monthly_net_profit > 0).length,
        riskyCount: analyses.filter(a => a.risk.level === 'risky' || a.risk.level === 'dangerous').length,
    }), [analyses]);
    const dateStr = useMemo(() => new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }), []);

    const riskConfig = {
        safe: { icon: ShieldCheck, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
        moderate: { icon: AlertTriangle, color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
        high: { icon: AlertOctagon, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    };
    const rc = riskConfig[riskLevel];
    const RiskIcon = rc.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
        >
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{dateStr}</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                    {greeting}{name ? `, ${name}` : ''}
                </h1>
                {analyses.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                        {profitableCount > 0 && <span className="text-emerald-700 dark:text-emerald-400">{profitableCount} ürün kârlı</span>}
                        {profitableCount > 0 && riskyCount > 0 && ', '}
                        {riskyCount > 0 && <span className="text-red-400">{riskyCount} ürün riskli</span>}
                        {profitableCount === 0 && riskyCount === 0 && 'Ürün portföyünüzün özeti'}
                    </p>
                )}
                {analyses.length === 0 && (
                    <p className="text-sm text-muted-foreground">Ürün portföyünüzün anlık kârlılık ve risk durumu.</p>
                )}
            </div>

            {isPro && riskLabel && (
                <Link href="/cash-plan">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${rc.border} ${rc.bg} hover:opacity-80 transition-opacity cursor-pointer`}>
                        <RiskIcon className={`h-4 w-4 ${rc.color}`} />
                        <span className={`text-xs font-medium ${rc.color}`}>{riskLabel}</span>
                        <ArrowRight className={`h-3 w-3 ${rc.color}`} />
                    </div>
                </Link>
            )}
        </motion.div>
    );
}
