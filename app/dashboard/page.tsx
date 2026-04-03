'use client';

import { useState, useEffect } from 'react';
import { useAlerts } from '@/contexts/alert-context';
import { deleteAnalysis as storageDeleteAnalysis } from '@/lib/api/analyses';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProductsTable } from '@/components/dashboard/products-table';
import { RiskChart } from '@/components/dashboard/risk-chart';
import { ProfitTrendChart } from '@/components/dashboard/profit-trend-chart';
import { ParetoChart } from '@/components/dashboard/pareto-chart';
import { PazaryeriIstatistikKarti } from '@/components/shared/PazaryeriIstatistikKarti';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { TrendingUp, Percent, AlertTriangle, Package, BarChart3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { RecommendationsPanel } from '@/components/dashboard/recommendations-panel';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { EnhancedKPICard } from '@/components/dashboard/enhanced-kpi-card';
import { QuickActionsBar } from '@/components/dashboard/quick-actions-bar';
import { SmartInsights } from '@/components/dashboard/smart-insights';
import { TooltipProvider } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';

interface ConnStatus {
    status: string;
    seller_id?: string;
}

export default function DashboardPage() {
    const { analyses, loading, refresh } = useAlerts();
    const [trendyolConn, setTrendyolConn] = useState<ConnStatus>({ status: 'disconnected' });

    useEffect(() => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        fetch('/api/marketplace/trendyol', { signal: controller.signal })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d) setTrendyolConn({ status: d.status ?? 'disconnected', seller_id: d.seller_id });
            })
            .catch(() => { })
            .finally(() => clearTimeout(timeout));
        return () => { controller.abort(); clearTimeout(timeout); };
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Bu analizi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
        try {
            const res = await storageDeleteAnalysis(id);
            if (res.success) {
                toast.success('Analiz silindi.');
                await refresh();
            } else {
                toast.error('Silme işlemi başarısız.');
            }
        } catch {
            toast.error('Hata oluştu.');
        }
    };

    // KPI calculations
    const totalProfit = analyses.reduce((sum, a) => sum + a.result.monthly_net_profit, 0);
    const avgMargin = analyses.length > 0
        ? analyses.reduce((sum, a) => sum + a.result.margin_pct, 0) / analyses.length
        : 0;
    const riskyCount = analyses.filter(a => a.risk.level === 'risky' || a.risk.level === 'dangerous').length;
    const mostProfitable = analyses.length > 0
        ? analyses.reduce((best, a) => a.result.monthly_net_profit > best.result.monthly_net_profit ? a : best, analyses[0])
        : null;

    if (loading && analyses.length === 0) {
        return (
            <DashboardLayout>
                <div className="space-y-6 animate-pulse">
                    {/* Header skeleton */}
                    <div className="space-y-2">
                        <div className="h-7 w-48 bg-muted/30 rounded-lg" />
                        <div className="h-4 w-64 bg-muted/20 rounded-lg" />
                    </div>
                    {/* KPI cards skeleton */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
                                <div className="h-3 w-20 bg-muted/20 rounded" />
                                <div className="h-6 w-24 bg-muted/30 rounded" />
                            </div>
                        ))}
                    </div>
                    {/* Charts skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-border/40 bg-card h-64" />
                        <div className="rounded-xl border border-border/40 bg-card h-64" />
                    </div>
                    {/* Table skeleton */}
                    <div className="rounded-xl border border-border/40 bg-card h-48" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <TooltipProvider delayDuration={200}>
                <div className="space-y-6 pb-10 max-w-7xl mx-auto">

                    {/* Header */}
                    <DashboardHeader analyses={analyses} />

                    {/* Quick Actions */}
                    <QuickActionsBar />

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <EnhancedKPICard
                            title="Aylik Tahmini Kar"
                            value={formatCurrency(totalProfit)}
                            subtitle={totalProfit >= 0 ? 'Toplam net kar' : 'Toplam zarar'}
                            icon={TrendingUp}
                            color={totalProfit >= 0 ? 'emerald' : 'red'}
                            href="/cash-plan"
                            delay={0.05}
                        />
                        <EnhancedKPICard
                            title="Ortalama Marj"
                            value={formatPercent(avgMargin)}
                            subtitle={`${analyses.length} aktif ürün`}
                            icon={Percent}
                            color={avgMargin >= 15 ? 'blue' : avgMargin >= 5 ? 'amber' : 'red'}
                            href="/break-even"
                            delay={0.07}
                        />
                        <EnhancedKPICard
                            title="Kritik Ürün"
                            value={riskyCount.toString()}
                            subtitle={riskyCount > 0 ? 'Acil aksiyon gerekli' : 'Risk bulunamadı'}
                            icon={AlertTriangle}
                            color={riskyCount > 0 ? 'red' : 'emerald'}
                            delay={0.09}
                        />
                        <EnhancedKPICard
                            title="Toplam Urun"
                            value={analyses.length.toString()}
                            subtitle={analyses.length > 0 ? 'Aktif urun analizi' : 'Henuz urun eklenmedi'}
                            icon={Package}
                            color="violet"
                            href="/products"
                            delay={0.11}
                        />
                    </div>

                    {/* Smart Insights */}
                    <SmartInsights analyses={analyses} />

                    {/* Recommendations */}
                    <RecommendationsPanel analyses={analyses} />

                    {/* Marketplace Stats */}
                    <PazaryeriIstatistikKarti
                        bagliPazaryerleri={[
                            { id: 'trendyol', status: trendyolConn.status, supplier_id: trendyolConn.seller_id },
                            { id: 'hepsiburada', status: 'disconnected' },
                        ]}
                    />

                    {/* Charts Section */}
                    <div className="grid gap-5 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <ProfitTrendChart analyses={analyses} />
                        </div>
                        <div className="space-y-5">
                            <RiskChart analyses={analyses} />
                            <ParetoChart analyses={analyses} />
                        </div>
                    </div>

                    {/* Products Table */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center gap-2 px-1">
                            <BarChart3 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                            <h2 className="text-sm font-semibold">Son Analizler</h2>
                        </div>
                        <ProductsTable analyses={analyses.slice(0, 10)} onDelete={handleDelete} />
                    </motion.div>
                </div>
            </TooltipProvider>
        </DashboardLayout>
    );
}
