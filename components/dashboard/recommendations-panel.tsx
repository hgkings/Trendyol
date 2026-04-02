'use client';

import { Analysis } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, AlertTriangle, TrendingDown, Wallet } from 'lucide-react';
import Link from 'next/link';
import { formatPercent } from '@/components/shared/format';
import { calculateAdCeiling } from '@/utils/calculations';
import { motion } from 'framer-motion';

interface RecommendationsPanelProps {
    analyses: Analysis[];
}

export function RecommendationsPanel({ analyses }: RecommendationsPanelProps) {
    const criticalProducts = analyses
        .map(analysis => {
            const issues: Array<{ type: string; label: string; icon: typeof AlertTriangle; color: string }> = [];
            if (analysis.risk.level === 'dangerous' || analysis.risk.level === 'risky') {
                issues.push({ type: 'risk', label: 'Yuksek Risk', icon: AlertTriangle, color: 'text-red-400 bg-red-500/10' });
            }
            if (analysis.result.margin_pct < 10) {
                issues.push({ type: 'margin', label: 'Dusuk Marj', icon: TrendingDown, color: 'text-amber-700 dark:text-amber-400 bg-amber-500/10' });
            }
            if (analysis.result.monthly_net_profit < 0) {
                issues.push({ type: 'profit', label: 'Zarar Ediyor', icon: Wallet, color: 'text-red-400 bg-red-500/10' });
            }
            const adCeiling = calculateAdCeiling(analysis.input);
            if (analysis.input.ad_cost_per_sale > adCeiling && adCeiling > 0) {
                issues.push({ type: 'ads', label: 'Yuksek Reklam', icon: TrendingDown, color: 'text-orange-400 bg-orange-500/10' });
            }

            let score = 0;
            if (analysis.result.monthly_net_profit < 0) score += 50;
            if (analysis.risk.level === 'dangerous') score += 40;
            if (analysis.risk.level === 'risky') score += 20;
            if (analysis.result.margin_pct < 5) score += 30;
            else if (analysis.result.margin_pct < 10) score += 15;
            if (analysis.input.ad_cost_per_sale > adCeiling && adCeiling > 0) score += 25;

            return { ...analysis, issues, score };
        })
        .filter(item => item.issues.length > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    if (criticalProducts.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="rounded-xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.04] to-transparent overflow-hidden"
        >
            <div className="px-5 py-4 border-b border-amber-500/10">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                        <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    </div>
                    <div>
                        <span className="text-sm font-semibold">Kritik Ürün Önerileri</span>
                        <p className="text-[10px] text-muted-foreground">Acil aksiyon gerektiren {criticalProducts.length} ürün</p>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-2">
                {criticalProducts.map((item, i) => (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.05 }}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/30 bg-muted/10 p-3 hover:bg-muted/20 transition-colors"
                    >
                        <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{item.input.product_name}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">({formatPercent(item.result.margin_pct)} Marj)</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {item.issues.slice(0, 2).map((issue, idx) => (
                                    <Badge key={idx} variant="secondary" className={`text-[10px] px-1.5 py-0 font-medium ${issue.color} border-0`}>
                                        <issue.icon className="mr-1 h-3 w-3" />
                                        {issue.label}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <Link href={`/analysis/${item.id}`} passHref>
                            <Button size="sm" variant="ghost" className="h-8 text-xs font-medium w-full sm:w-auto shrink-0">
                                Incele <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}
