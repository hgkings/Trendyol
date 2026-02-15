
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Analysis } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { KPICard } from '@/components/shared/kpi-card';
import { RiskBadge } from '@/components/shared/risk-badge';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft,
    TrendingUp,
    DollarSign,
    Percent,
    AlertTriangle,
    Package,
    BarChart3,
    PieChart as PieChartIcon,
    ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

export default function AnalysisDetailPage() {
    const params = useParams();
    const id = params?.id;
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth');
            return;
        }

        if (user && id) {
            fetchAnalysis();
        }
    }, [user, id, authLoading]);

    const fetchAnalysis = async () => {
        try {
            const { data, error } = await supabase
                .from('analyses')
                .select('*')
                .eq('id', id)
                .eq('user_id', user?.id)
                .single();

            if (error) throw error;

            const mapped: Analysis = {
                id: data.id,
                userId: data.user_id,
                input: data.inputs,
                result: data.outputs,
                risk: {
                    score: data.risk_score,
                    level: data.risk_level,
                    factors: data.outputs?._risk_factors || []
                },
                createdAt: data.created_at
            };

            setAnalysis(mapped);
        } catch (err) {
            console.error('Error fetching analysis:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading || authLoading) {
        return (
            <DashboardLayout>
                <div className="flex h-[60vh] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            </DashboardLayout>
        );
    }

    if (!analysis) {
        return (
            <DashboardLayout>
                <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
                    <p className="text-xl font-semibold">Kayit bulunamadi.</p>
                    <Link href="/dashboard">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Panele Don
                        </Button>
                    </Link>
                </div>
            </DashboardLayout>
        );
    }

    const { input, result, risk } = analysis;

    const costData = [
        { name: 'Urun Maliyeti', value: input.product_cost, color: '#6366f1' },
        { name: 'Komisyon', value: result.commission_amount, color: '#f59e0b' },
        { name: 'Kargo', value: input.shipping_cost, color: '#ef4444' },
        { name: 'Paketleme', value: input.packaging_cost, color: '#10b981' },
        { name: 'Reklam', value: input.ad_cost_per_sale, color: '#ec4899' },
        { name: 'Iade Kaybi', value: result.expected_return_loss, color: '#6b7280' },
        { name: 'KDV', value: result.vat_amount, color: '#8b5cf6' },
        { name: 'Diger Giderler', value: input.other_cost, color: '#06b6d4' },
    ].filter(d => d.value > 0);

    return (
        <DashboardLayout>
            <div className="space-y-8 pb-12">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <Link href="/dashboard" className="hover:text-foreground">Panel</Link>
                            <ChevronRight className="h-3 w-3" />
                            <Link href="/products" className="hover:text-foreground">Ürünler</Link>
                            <ChevronRight className="h-3 w-3" />
                            <span className="text-foreground">Analiz Detayi</span>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">{input.product_name}</h1>
                        <p className="text-muted-foreground">
                            {new Date(analysis.createdAt).toLocaleDateString('tr-TR')} tarihinde analiz edildi.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <RiskBadge level={risk.level} />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <KPICard
                        title="Satis Fiyati"
                        value={formatCurrency(input.sale_price)}
                        subtitle="Birim satis fiyati"
                        icon={DollarSign}
                    />
                    <KPICard
                        title="Birim Net Kar"
                        value={formatCurrency(result.unit_net_profit)}
                        subtitle={`Marj: ${formatPercent(result.margin_pct)}`}
                        icon={TrendingUp}
                        trend={result.unit_net_profit > 0 ? 'up' : 'down'}
                    />
                    <KPICard
                        title="Aylik Net Kar"
                        value={formatCurrency(result.monthly_net_profit)}
                        subtitle={`${input.monthly_sales_volume} satis/ay`}
                        icon={BarChart3}
                        trend={result.monthly_net_profit > 0 ? 'up' : 'down'}
                    />
                    <KPICard
                        title="Basabas Noktasi"
                        value={formatCurrency(result.breakeven_price)}
                        subtitle="Minimum satis fiyati"
                        icon={Percent}
                    />
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="rounded-2xl border bg-card p-6 shadow-sm">
                            <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold">
                                <PieChartIcon className="h-5 w-5 text-primary" /> Maliyet Kirilimi (Birim)
                            </h3>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={costData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" fontSize={12} />
                                        <YAxis dataKey="name" type="category" fontSize={12} width={100} />
                                        <Tooltip
                                            formatter={(value: number) => formatCurrency(value)}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {costData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                            <div className="p-6 border-b">
                                <h3 className="text-lg font-semibold">Finansal Detaylar</h3>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-y">
                                <DetailRow label="Urun Maliyeti" value={formatCurrency(input.product_cost)} />
                                <DetailRow label="Komisyon" value={formatCurrency(result.commission_amount)} />
                                <DetailRow label="Kargo Ucreti" value={formatCurrency(input.shipping_cost)} />
                                <DetailRow label="Paketleme" value={formatCurrency(input.packaging_cost)} />
                                <DetailRow label="Reklam Gideri" value={formatCurrency(input.ad_cost_per_sale)} />
                                <DetailRow label="Iade Kayip Maliyeti" value={formatCurrency(result.expected_return_loss)} />
                                <DetailRow label="KDV" value={formatCurrency(result.vat_amount)} />
                                <DetailRow label="Diger Giderler" value={formatCurrency(input.other_cost)} />
                                <DetailRow label="Toplam Birim Maliyet" value={formatCurrency(result.unit_total_cost)} highlight />
                                <DetailRow label="Birim Net Kar" value={formatCurrency(result.unit_net_profit)} highlight />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-2xl border bg-card p-6 shadow-sm">
                            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                                <AlertTriangle className="h-5 w-5 text-amber-500" /> Risk Analizi
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Genel Skor</span>
                                    <span className="text-lg font-bold">{risk.score}/100</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${risk.score > 70 ? 'bg-red-500' : risk.score > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                                            }`}
                                        style={{ width: `${risk.score}%` }}
                                    />
                                </div>
                                <div className="space-y-3 pt-2">
                                    {risk.factors.map((factor, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                            <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${factor.impact > 15 ? 'bg-red-500' : 'bg-amber-500'
                                                }`} />
                                            <div>
                                                <p className="font-medium">{factor.name}</p>
                                                <p className="text-xs text-muted-foreground">{factor.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-card p-6 shadow-sm">
                            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                                <Package className="h-5 w-5 text-blue-500" /> Pazaryeri Parametreleri
                            </h3>
                            <div className="space-y-3">
                                <MarketplaceInfoRow label="Pazaryeri" value={input.marketplace.toUpperCase()} />
                                <MarketplaceInfoRow label="Iade Orani" value={`%${input.return_rate_pct}`} />
                                <MarketplaceInfoRow label="Odeme Gecikmesi" value={`${input.payout_delay_days} gun`} />
                                <MarketplaceInfoRow label="Vergi Orani" value={`%${input.vat_pct}`} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

function DetailRow({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
    return (
        <div className={`flex items-center justify-between p-4 ${highlight ? 'bg-muted/30 font-bold' : ''}`}>
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}

function MarketplaceInfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}
