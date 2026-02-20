'use client';

import { Analysis } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, AlertTriangle, TrendingDown, Wallet } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { calculateAdCeiling } from '@/utils/calculations';

interface RecommendationsPanelProps {
    analyses: Analysis[];
}

export function RecommendationsPanel({ analyses }: RecommendationsPanelProps) {
    // Identify critical products
    const criticalProducts = analyses
        .map(analysis => {
            const issues = [];
            if (analysis.risk.level === 'dangerous' || analysis.risk.level === 'risky') {
                issues.push({ type: 'risk', label: 'Yüksek Risk', icon: AlertTriangle, color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' });
            }
            if (analysis.result.margin_pct < 10) {
                issues.push({ type: 'margin', label: 'Düşük Marj', icon: TrendingDown, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' });
            }
            if (analysis.result.monthly_net_profit < 0) {
                issues.push({ type: 'profit', label: 'Zarar Ediyor', icon: Wallet, color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' });
            }

            // Ad Ceiling Check
            const adCeiling = calculateAdCeiling(analysis.input);
            if (analysis.input.ad_cost_per_sale > adCeiling && adCeiling > 0) {
                issues.push({ type: 'ads', label: 'Yüksek Reklam', icon: TrendingDown, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400' });
            }

            // Calculate a criticality score
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
        .slice(0, 3); // Top 3

    if (criticalProducts.length === 0) return null;

    return (
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-bold">Kritik Ürün Önerileri</CardTitle>
                        <p className="text-xs text-muted-foreground">Acil aksiyon gerektiren {criticalProducts.length} ürün tespit edildi.</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {criticalProducts.map((item) => (
                    <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">{item.input.product_name}</span>
                                <span className="text-xs text-muted-foreground">({formatPercent(item.result.margin_pct)} Marj)</span>
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
                            <Button size="sm" variant="ghost" className="h-8 text-xs font-medium w-full sm:w-auto">
                                İncele & Düzelt <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
