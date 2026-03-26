'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  toplamHakedis: number;
  toplamAlacak: number;
  toplamIadeSayisi: number;
}

export default function DashboardPage() {
  const { analyses, loading, refresh } = useAlerts();

  const [trendyolFinans, setTrendyolFinans] = useState<TrendyolFinans | null>(null);
  const [trendyolBagli, setTrendyolBagli] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const connRes = await fetch('/api/marketplace/trendyol');
        if (!connRes.ok) { setTrendyolBagli(false); return; }
        const conn = await connRes.json();
        const bagli = conn.status === 'connected' && !!conn.seller_id?.trim();
        setTrendyolBagli(bagli);
        if (!bagli) return;

        const bitis = new Date();
        const baslangic = new Date();
        baslangic.setDate(baslangic.getDate() - 30);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);

        const [finRes, claimRes] = await Promise.all([
          fetch(`/api/marketplace/trendyol/finance?startDate=${fmt(baslangic)}&endDate=${fmt(bitis)}`),
          fetch(`/api/marketplace/trendyol/claims?gun=30`),
        ]);

        if (!finRes.ok) return;
        const finJson = await finRes.json();
        const rows: Array<{ komisyonTutari?: number; saticiHakedis?: number; alacak?: number }> = finJson.data ?? [];

        const toplamIadeSayisi = claimRes.ok
          ? ((await claimRes.json())?.ozet?.toplamIadeSayisi ?? 0)
          : 0;

        if (rows.length === 0 && toplamIadeSayisi === 0) return;
        setTrendyolFinans({
          toplamKomisyon: rows.reduce((s, r) => s + (r.komisyonTutari ?? 0), 0),
          toplamHakedis: rows.reduce((s, r) => s + (r.saticiHakedis ?? 0), 0),
          toplamAlacak: rows.reduce((s, r) => s + (r.alacak ?? 0), 0),
          toplamIadeSayisi,
        });
      } catch {
        setTrendyolBagli(false);
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

        {/* Trendyol — Bağlı Değilse Teşvik Kartı */}
        {trendyolBagli === false && (
          <Link href="/marketplace">
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 hover:bg-muted/40 hover:border-primary/40 transition-all cursor-pointer group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔗</span>
                  <p className="text-sm font-semibold text-foreground">Trendyol Bağlantısı</p>
                </div>
                <span className="text-xs bg-orange-500/15 text-orange-400 px-2 py-1 rounded-full font-medium">
                  Bağlı Değil
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Mağazanı bağla — komisyon, kargo ve iade verilerin otomatik gelsin.
              </p>
              <div className="space-y-2 mb-4">
                {['📊 Komisyon verisi otomatik', '💸 Gerçek net kâr hesabı', '📦 İade oranı otomatik'].map((item) => (
                  <p key={item} className="text-xs text-muted-foreground">{item}</p>
                ))}
              </div>
              <div className="flex items-center gap-2 text-primary text-sm font-medium group-hover:gap-3 transition-all">
                <span>Trendyol&apos;u Bağla</span>
                <span>→</span>
              </div>
            </div>
          </Link>
        )}

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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-red-500/10 p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground">Komisyon</p>
                <p className="text-base font-bold text-red-500">{formatCurrency(trendyolFinans.toplamKomisyon)}</p>
              </div>
              <div className="rounded-xl bg-blue-500/10 p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground">Hakediş</p>
                <p className="text-base font-bold text-blue-500">{formatCurrency(trendyolFinans.toplamHakedis)}</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground">Alacak</p>
                <p className="text-base font-bold text-primary">{formatCurrency(trendyolFinans.toplamAlacak)}</p>
              </div>
              <div className="rounded-xl bg-yellow-500/10 p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground">İade Sayısı</p>
                <p className="text-base font-bold text-yellow-500">{trendyolFinans.toplamIadeSayisi} adet</p>
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
