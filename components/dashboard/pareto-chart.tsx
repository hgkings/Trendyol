'use client';

import { Analysis } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { BarChart3, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface ParetoChartProps {
    analyses: Analysis[];
}

export function ParetoChart({ analyses }: ParetoChartProps) {
    // 1. Calculate Total Net Profit (only profitable products)
    const profitableProducts = analyses
        .filter(a => a.result.monthly_net_profit > 0)
        .sort((a, b) => b.result.monthly_net_profit - a.result.monthly_net_profit);

    const totalProfit = profitableProducts.reduce((sum, a) => sum + a.result.monthly_net_profit, 0);

    if (totalProfit === 0) return null;

    // 2. Identify Top 80% contributors
    let currentSum = 0;
    const topContributors = [];
    const threshold = totalProfit * 0.8;

    for (const product of profitableProducts) {
        currentSum += product.result.monthly_net_profit;
        topContributors.push(product);
        if (currentSum >= threshold) break;
    }

    const remainingCount = analyses.length - topContributors.length;
    const contributionPct = (currentSum / totalProfit) * 100;

    return (
        <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                            <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-bold">Kârın Omurgası (80/20)</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Toplam kârın <b>{Math.round(contributionPct)}%</b>'si bu <b>{topContributors.length}</b> üründen geliyor.
                            </p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 mt-2">
                    {topContributors.slice(0, 5).map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                    {idx + 1}
                                </span>
                                <div className="flex flex-col min-w-0 flex-1 px-2">
                                    <Link href={`/analysis/${item.id}`} className="hover:underline block w-full">
                                        <span className="text-sm font-medium truncate block w-full">
                                            {item.input.product_name}
                                        </span>
                                    </Link>
                                    <span className="text-[10px] text-muted-foreground hidden sm:inline whitespace-nowrap">
                                        Marj: {formatPercent(item.result.margin_pct)}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                    {formatCurrency(item.result.monthly_net_profit)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                    {formatPercent((item.result.monthly_net_profit / totalProfit) * 100)} pay
                                </p>
                            </div>
                        </div>
                    ))}

                    {topContributors.length > 5 && (
                        <p className="text-xs text-center text-muted-foreground pt-1">
                            ...ve {topContributors.length - 5} diğer kritik ürün.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
