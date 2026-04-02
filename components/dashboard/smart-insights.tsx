'use client';

import { useMemo } from 'react';
import { Analysis } from '@/types';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Zap, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface SmartInsightsProps {
    analyses: Analysis[];
}

interface Insight {
    icon: LucideIcon;
    title: string;
    desc: string;
    type: 'success' | 'warning' | 'danger' | 'info';
}

export function SmartInsights({ analyses }: SmartInsightsProps) {
    const insights = useMemo(() => {
        if (analyses.length === 0) return [];

        const tips: Insight[] = [];
        const totalProfit = analyses.reduce((s, a) => s + a.result.monthly_net_profit, 0);
        const avgMargin = analyses.reduce((s, a) => s + a.result.margin_pct, 0) / analyses.length;
        const riskyCount = analyses.filter(a => a.risk.level === 'risky' || a.risk.level === 'dangerous').length;
        const lossCount = analyses.filter(a => a.result.monthly_net_profit < 0).length;
        const totalAdCost = analyses.reduce((s, a) => s + (a.input.ad_cost_per_sale * a.input.monthly_sales_volume), 0);
        const adRatio = totalProfit > 0 ? (totalAdCost / (totalProfit + totalAdCost)) * 100 : 0;

        // Best performer
        const best = analyses.reduce((b, a) => a.result.monthly_net_profit > b.result.monthly_net_profit ? a : b, analyses[0]);
        if (best.result.monthly_net_profit > 0) {
            tips.push({
                icon: Zap,
                title: `En karli: ${best.input.product_name}`,
                desc: `Ayda ${formatCurrency(best.result.monthly_net_profit)} net kar, ${formatPercent(best.result.margin_pct)} marj.`,
                type: 'success',
            });
        }

        // Ad cost warning
        if (adRatio > 25) {
            tips.push({
                icon: Target,
                title: `Reklam maliyeti yüksek: %${adRatio.toFixed(0)}`,
                desc: 'Toplam reklam harcamanız gelirin önemli bir kısmını oluşturuyor.',
                type: 'warning',
            });
        }

        // Risk warning
        if (riskyCount > 0) {
            tips.push({
                icon: AlertTriangle,
                title: `${riskyCount} ürün risk bölgesinde`,
                desc: 'Fiyat veya maliyet optimizasyonu yaparak riski azaltabilirsiniz.',
                type: 'danger',
            });
        }

        // Low margin
        if (avgMargin < 15 && avgMargin > 0) {
            tips.push({
                icon: TrendingDown,
                title: `Ortalama marj düşük: ${formatPercent(avgMargin)}`,
                desc: 'İdeal marj %15+ olmalıdır. Komisyon ve kargo optimizasyonu deneyin.',
                type: 'warning',
            });
        }

        // Profit positive
        if (totalProfit > 0 && lossCount === 0) {
            tips.push({
                icon: TrendingUp,
                title: 'Tüm ürünler kârlı',
                desc: `Toplam aylik net kar: ${formatCurrency(totalProfit)}`,
                type: 'success',
            });
        }

        // Loss products
        if (lossCount > 0) {
            tips.push({
                icon: Lightbulb,
                title: `${lossCount} ürün zarar ediyor`,
                desc: 'Bu ürünleri fiyatlandırma veya portföyden çıkarmayı düşünün.',
                type: 'danger',
            });
        }

        return tips.slice(0, 3);
    }, [analyses]);

    if (insights.length === 0) return null;

    const colorMap = {
        success: { bg: 'from-emerald-500/8', border: 'border-emerald-500/15', icon: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
        warning: { bg: 'from-amber-500/8', border: 'border-amber-500/15', icon: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
        danger: { bg: 'from-red-500/8', border: 'border-red-500/15', icon: 'bg-red-500/10 text-red-400' },
        info: { bg: 'from-blue-500/8', border: 'border-blue-500/15', icon: 'bg-blue-500/10 text-blue-400' },
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            >
                {insights.map((tip, i) => {
                    const Icon = tip.icon;
                    const c = colorMap[tip.type];
                    return (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 + i * 0.05 }}
                            className={`rounded-xl border ${c.border} bg-gradient-to-br ${c.bg} to-transparent p-4`}
                        >
                            <div className="flex gap-3">
                                <div className={`p-1.5 rounded-lg ${c.icon} shrink-0 h-fit`}>
                                    <Icon className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-semibold truncate">{tip.title}</h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">{tip.desc}</p>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </AnimatePresence>
    );
}
