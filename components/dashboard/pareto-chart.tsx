'use client';

import { Analysis } from '@/types';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { Crown, Medal, Award } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface ParetoChartProps {
    analyses: Analysis[];
}

const MEDAL_CONFIG = [
    { icon: Crown, color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { icon: Medal, color: 'text-gray-300', bg: 'bg-gray-500/10' },
    { icon: Award, color: 'text-orange-400', bg: 'bg-orange-500/10' },
];

export function ParetoChart({ analyses }: ParetoChartProps) {
    const profitableProducts = analyses
        .filter(a => a.result.monthly_net_profit > 0)
        .sort((a, b) => b.result.monthly_net_profit - a.result.monthly_net_profit);

    const totalProfit = profitableProducts.reduce((sum, a) => sum + a.result.monthly_net_profit, 0);

    if (totalProfit === 0) return null;

    let currentSum = 0;
    const topContributors: Analysis[] = [];
    const threshold = totalProfit * 0.8;

    for (const product of profitableProducts) {
        currentSum += product.result.monthly_net_profit;
        topContributors.push(product);
        if (currentSum >= threshold) break;
    }

    const contributionPct = (currentSum / totalProfit) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-border/40 bg-card overflow-hidden"
        >
            <div className="px-5 py-4 border-b border-border/40">
                <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    <div>
                        <span className="text-sm font-semibold">Karin Omurgasi (80/20)</span>
                        <p className="text-[10px] text-muted-foreground">
                            Karin <b>{Math.round(contributionPct)}%</b>&apos;si <b>{topContributors.length}</b> üründen
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-2">
                {topContributors.slice(0, 5).map((item, idx) => {
                    const share = (item.result.monthly_net_profit / totalProfit) * 100;
                    const medal = idx < 3 ? MEDAL_CONFIG[idx] : null;
                    const MedalIcon = medal?.icon;

                    return (
                        <Link key={item.id} href={`/analysis/${item.id}`}>
                            <div className="group relative flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/10 transition-colors">
                                {/* Background share bar */}
                                <div
                                    className="absolute inset-0 rounded-lg bg-emerald-500/[0.04]"
                                    style={{ width: `${share}%` }}
                                />
                                <div className="relative flex items-center gap-2.5 min-w-0 flex-1">
                                    {medal && MedalIcon ? (
                                        <div className={`p-1 rounded-md ${medal.bg}`}>
                                            <MedalIcon className={`h-3.5 w-3.5 ${medal.color}`} />
                                        </div>
                                    ) : (
                                        <span className="w-6 h-6 flex items-center justify-center rounded-md bg-muted/20 text-[10px] font-bold text-muted-foreground">
                                            {idx + 1}
                                        </span>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <span className="text-sm font-medium truncate block group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                            {item.input.product_name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatPercent(item.result.margin_pct)} marj
                                        </span>
                                    </div>
                                </div>
                                <div className="relative text-right shrink-0 ml-2">
                                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                        {formatCurrency(item.result.monthly_net_profit)}
                                    </span>
                                    <span className="block text-[10px] text-muted-foreground">
                                        {formatPercent(share)} pay
                                    </span>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </motion.div>
    );
}
