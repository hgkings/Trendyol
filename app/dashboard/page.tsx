'use client';

import { useState, useEffect } from 'react';
import { useAlerts } from '@/contexts/alert-context';
import { deleteAnalysis as storageDeleteAnalysis } from '@/lib/api/analyses';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { KPICard } from '@/components/shared/kpi-card';
import { ProductsTable } from '@/components/dashboard/products-table';
import { RiskChart } from '@/components/dashboard/risk-chart';
import { ProfitTrendChart } from '@/components/dashboard/profit-trend-chart';
import { ParetoChart } from '@/components/dashboard/pareto-chart';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { TrendingUp, Percent, AlertTriangle, Star, BarChart3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { GeneralRiskCard } from '@/components/dashboard/general-risk-card';
import { RecommendationsPanel } from '@/components/dashboard/recommendations-panel';

interface TrendyolFinans {
  toplamKomisyon: number;
  toplamKargo: number;
  toplamIade: number;
  netKazanc: number;
}

export default function DashboardPage() {
  const { analyses, loading, refresh } = useAlerts();

  const [trendyolFinans, setTrendyolFinans] = useState<TrendyolFinans | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const connRes = await fetch('/api/marketplace/trendyol');
        if (!connRes.ok) return;
        const conn = await connRes.json();
        if (conn.status !== 'connected' || !conn.seller_id?.trim()) return;

        const bitis = new Date();
        const baslangic = new Date();
        baslangic.setDate(baslangic.getDate() - 30);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        const res = await fetch(`/api/marketplace/trendyol/finance?startDate=${fmt(baslangic)}&endDate=${fmt(bitis)}`);
        if (!res.ok) return;
        const json = await res.json();
        const rows: Array<{ commissionAmount?: number; shippingAmount?: number; returnAmount?: number; netAmount?: number }> = json.data ?? [];
        if (rows.length === 0) return;
        setTrendyolFinans({
          toplamKomisyon: rows.reduce((s, r) => s + (r.commissionAmount ?? 0), 0),
          toplamKargo: rows.reduce((s, r) => s + (r.shippingAmount ?? 0), 0),
          toplamIade: rows.reduce((s, r) => s + (r.returnAmount ?? 0), 0),
          netKazanc: rows.reduce((s, r) => s + (r.netAmount ?? 0), 0),
        });
      } catch {
        // sessizce geç
      }
    })();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await storageDeleteAnalysis(id);
      if (res.success) {
        toast.success('Analiz silindi.');
        await refresh();
      } else {
        toast.error('Silme işlemi başarısız.');
      }
    } catch (error) {
      toast.error('Hata oluştu.');
    }
  };

  const totalProfit = analyses.reduce((sum, a) => sum + a.result.monthly_net_profit, 0);
  const avgMargin = analyses.length > 0
    ? analyses.reduce((sum, a) => sum + a.result.margin_pct, 0) / analyses.length
    : 0;
  const riskyCount = analyses.filter((a) => a.risk.level === 'risky' || a.risk.level === 'dangerous').length;
  const mostProfitable = analyses.length > 0
    ? analyses.reduce((best, a) => a.result.monthly_net_profit > best.result.monthly_net_profit ? a : best, analyses[0])
    : null;

  if (loading && analyses.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Veriler yükleniyor...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-10">
        {/* Header with Risk Card */}
        <div className="flex flex-col lg:flex-row gap-6 items-start justify-between border-b border-[rgba(255,255,255,0.06)] pb-6">
          <div className="space-y-1.5 w-full lg:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Panel</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Ürün portföyünüzün anlık karlılık ve risk durumu.
            </p>
          </div>
          <div className="w-full lg:w-auto min-w-0 lg:min-w-[300px]">
            <GeneralRiskCard />
          </div>
        </div>

        {/* Actionable Recommendations */}
        <RecommendationsPanel analyses={analyses} />

        {/* Dashboard KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Aylık Tahmini Kâr"
            value={formatCurrency(totalProfit)}
            subtitle={totalProfit >= 0 ? 'Toplam net kâr' : 'Toplam zarar'}
            icon={TrendingUp}
            trend={totalProfit >= 0 ? 'up' : 'down'}
          />
          <KPICard
            title="Ortalama Marj"
            value={formatPercent(avgMargin)}
            subtitle={`${analyses.length} aktif ürün`}
            icon={Percent}
            trend={avgMargin >= 15 ? 'up' : avgMargin >= 5 ? 'neutral' : 'down'}
          />
          <KPICard
            title="Kritik Ürün"
            value={riskyCount.toString()}
            subtitle={riskyCount > 0 ? 'Acil aksiyon gerekli' : 'Risk bulunamadı'}
            icon={AlertTriangle}
            trend={riskyCount > 0 ? 'down' : 'up'}
          />
          <KPICard
            title="En Karlı Ürün"
            value={mostProfitable ? mostProfitable.input.product_name : '-'}
            subtitle={mostProfitable ? formatCurrency(mostProfitable.result.monthly_net_profit) : 'Henüz veri yok'}
            icon={Star}
          />
        </div>

        {/* Trendyol Finansal Özet */}
        {trendyolFinans && (
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Trendyol — Son 30 Gün</h2>
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                Canlı veri
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-red-500/10 p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground">Komisyon</p>
                <p className="text-base font-bold text-red-500">{formatCurrency(trendyolFinans.toplamKomisyon)}</p>
              </div>
              <div className="rounded-xl bg-orange-500/10 p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground">Kargo</p>
                <p className="text-base font-bold text-orange-500">{formatCurrency(trendyolFinans.toplamKargo)}</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground">Net Kazanç</p>
                <p className="text-base font-bold text-primary">{formatCurrency(trendyolFinans.netKazanc)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ProfitTrendChart analyses={analyses} />
          </div>
          <div className="space-y-6">
            <ParetoChart analyses={analyses} />
            <RiskChart analyses={analyses} />
          </div>
        </div>

        {/* Products Table Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Son Analizler</h2>
            </div>
          </div>
          <ProductsTable analyses={analyses.slice(0, 10)} onDelete={handleDelete} />
        </div>
      </div>
    </DashboardLayout>
  );
}
