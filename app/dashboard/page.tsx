'use client';

import { useAlerts } from '@/contexts/alert-context';
import { deleteAnalysis as storageDeleteAnalysis } from '@/lib/storage';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { KPICard } from '@/components/shared/kpi-card';
import { ProductsTable } from '@/components/dashboard/products-table';
import { RiskChart } from '@/components/dashboard/risk-chart';
import { ProfitTrendChart } from '@/components/dashboard/profit-trend-chart';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { TrendingUp, Percent, AlertTriangle, Star, BarChart3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { analyses, loading, refresh } = useAlerts();

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
      <div className="space-y-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Panel</h1>
          <p className="text-muted-foreground">
            Ürünlerinizin karlılık ve risk durumuna hızlı bir bakış atın.
          </p>
        </div>

        {/* Dashboard KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Aylık Tahmini Kar"
            value={formatCurrency(totalProfit)}
            subtitle={totalProfit >= 0 ? 'Toplam net kar' : 'Toplam zarar'}
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

        <ProfitTrendChart analyses={analyses} />

        {/* Tables and Charts */}
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Son Analizler</h2>
              </div>
            </div>
            <ProductsTable analyses={analyses.slice(0, 10)} onDelete={handleDelete} />
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Risk Dağılımı</h2>
            </div>
            <RiskChart analyses={analyses} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
