'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useAlerts } from '@/contexts/alert-context';
import { deleteAnalysis as storageDeleteAnalysis } from '@/lib/api/analyses';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProductsTable, StockItem } from '@/components/dashboard/products-table';
import { PazaryeriIstatistikKarti } from '@/components/shared/PazaryeriIstatistikKarti';
import { isProUser } from '@/utils/access';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { RiskBadge } from '@/components/shared/risk-badge';
import { getMarketplaceLabel } from '@/lib/marketplace-data';
import {
  TrendingUp, Percent, ShieldAlert, Package,
  Calendar, CheckCircle, FileText, Download, Plus,
  Star, AlertTriangle, TrendingDown, ArrowRight,
  Store, ExternalLink, List, ChevronRight, Loader2, Eye
} from 'lucide-react';
import { toast } from 'sonner';

interface ConnStatus {
  status: string;
  seller_id?: string;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Iyi geceler';
  if (h < 12) return 'Gunaydin';
  if (h < 17) return 'Iyi gunler';
  return 'Iyi aksamlar';
}

function getNameFromEmail(email?: string): string {
  if (!email) return '';
  const prefix = email.split('@')[0];
  const cleaned = prefix.replace(/[._\-0-9]/g, ' ').trim().split(' ')[0];
  if (!cleaned || cleaned.length < 2) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { analyses, loading, refresh } = useAlerts();
  const [trendyolConn, setTrendyolConn] = useState<ConnStatus>({ status: 'disconnected' });
  const [stockMap, setStockMap] = useState<Map<string, StockItem> | undefined>();
  const isPro = isProUser(user);

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

  // Stok verisini çek (Pro kullanıcılar için)
  useEffect(() => {
    if (!isPro) return;
    fetch('/api/marketplace/trendyol/stock')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.success) return;
        const map = new Map<string, StockItem>();
        for (const p of data.products) {
          const item: StockItem = { barcode: p.barcode, quantity: p.quantity, salePrice: p.salePrice, imageUrl: p.imageUrl, productUrl: p.productUrl };
          if (p.barcode) map.set(p.barcode, item);
          if (p.stockCode && p.stockCode !== p.barcode) map.set(p.stockCode, item);
          if (p.title) {
            map.set(p.title.toLowerCase(), item);
            const norm = p.title.toLowerCase().replace(/[\s\-_./]+/g, '');
            if (norm) map.set(norm, item);
          }
          if (p.id) map.set(p.id, item);
        }
        setStockMap(map);
      })
      .catch(() => {});
  }, [isPro]);

  const handleDelete = async (id: string) => {
    if (!confirm('Bu analizi silmek istediginize emin misiniz?')) return;
    try {
      const res = await storageDeleteAnalysis(id);
      if (res.success) {
        toast.success('Analiz silindi.');
        await refresh();
      } else {
        toast.error('Silme islemi basarisiz.');
      }
    } catch {
      toast.error('Hata olustu.');
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

  // Kritik ürünler (zarar eden veya riskli)
  const kritikUrunler = useMemo(() =>
    analyses
      .filter(a => a.result.monthly_net_profit <= 0 || a.risk.level === 'risky' || a.risk.level === 'dangerous')
      .sort((a, b) => a.result.margin_pct - b.result.margin_pct)
      .slice(0, 5),
    [analyses]
  );

  // Portföy durumu
  const profitableCount = analyses.filter(a => a.result.monthly_net_profit > 0).length;
  const lossCount = analyses.filter(a => a.result.monthly_net_profit <= 0).length;

  const dateStr = useMemo(() =>
    new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    []
  );

  const greeting = getGreeting();
  const name = getNameFromEmail(user?.email);

  // Son 5 analiz
  const recentAnalyses = useMemo(() =>
    [...analyses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [analyses]
  );

  if (loading && analyses.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-sm text-gray-500">Yukleniyor...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-10">

        {/* ═══ BÖLÜM 1 — Header ═══ */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar size={14} />
              <span>{dateStr}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/products">
                <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground bg-card border border-border/40 rounded-lg hover:bg-muted/20 transition-colors">
                  <FileText size={14} />
                  PDF Rapor
                </button>
              </Link>
              <Link href="/products">
                <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground bg-card border border-border/40 rounded-lg hover:bg-muted/20 transition-colors">
                  <Download size={14} />
                  CSV
                </button>
              </Link>
              <Link href="/analysis/new">
                <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors">
                  <Plus size={14} />
                  Yeni Analiz
                </button>
              </Link>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}{name ? `, ${name}` : ''}
          </h1>
          <div className="mt-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              <CheckCircle size={12} />
              {riskyCount > 0 ? `${riskyCount} urun riskli — aksiyon gerekiyor` : 'Finansal durum dengeli'}
            </span>
          </div>
        </div>

        {/* ═══ BÖLÜM 2 — 4 Metrik Kart ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Aylık Net Kâr — Ana kart */}
          <div className="bg-orange-500 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-orange-100">Aylik Net Kar</span>
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <TrendingUp size={16} className="text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold">{formatCurrency(totalProfit)}</div>
            <div className="text-sm text-orange-100 mt-1">{totalProfit >= 0 ? 'Toplam net kar' : 'Toplam zarar'}</div>
          </div>

          {/* Ortalama Marj */}
          <div className="bg-card rounded-xl p-5 border border-border/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Ortalama Marj</span>
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <Percent size={16} className="text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{formatPercent(avgMargin)}</div>
            <div className="text-sm text-muted-foreground mt-1">{analyses.length} aktif urun</div>
          </div>

          {/* Kritik Ürün */}
          <div className="bg-card rounded-xl p-5 border border-border/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Kritik Urun</span>
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <ShieldAlert size={16} className="text-blue-500" />
              </div>
            </div>
            <div className="text-3xl font-bold text-foreground">{riskyCount}</div>
            <div className="text-sm text-muted-foreground mt-1">{riskyCount > 0 ? 'Acil aksiyon gerekli' : 'Risk bulunamadi'}</div>
          </div>

          {/* Toplam Ürün */}
          <div className="bg-card rounded-xl p-5 border border-border/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Toplam Urun</span>
              <div className="w-8 h-8 bg-muted/30 rounded-lg flex items-center justify-center">
                <Package size={16} className="text-muted-foreground" />
              </div>
            </div>
            <div className="text-3xl font-bold text-foreground">{analyses.length}</div>
            <div className="text-sm text-muted-foreground mt-1">{analyses.length > 0 ? 'Aktif urun analizi' : 'Henuz urun eklenmedi'}</div>
          </div>
        </div>

        {/* ═══ BÖLÜM 3 — Özet Satırı ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* En Kârlı Ürün */}
          <div className="bg-card rounded-xl px-5 py-4 border border-border/40 flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Star size={16} className="text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">En Karli Urun</div>
              {mostProfitable ? (
                <>
                  <div className="text-sm font-semibold text-foreground truncate">{mostProfitable.input.product_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatCurrency(mostProfitable.result.monthly_net_profit)} / ay · {formatPercent(mostProfitable.result.margin_pct)} marj
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Henuz analiz yok</div>
              )}
            </div>
          </div>

          {/* Portföy Durumu */}
          <div className="bg-card rounded-xl px-5 py-4 border border-border/40 flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle size={16} className="text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Portfolyo Durumu</div>
              <div className="text-sm font-semibold text-foreground">
                {profitableCount} karli, {lossCount} zararda
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Toplam: {formatCurrency(totalProfit)} / ay
              </div>
            </div>
          </div>
        </div>

        {/* ═══ BÖLÜM 4 — Kritik Ürün Önerileri ═══ */}
        {kritikUrunler.length > 0 && (
          <div className="bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/20 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-amber-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="font-semibold text-amber-800 dark:text-amber-400 text-sm">Kritik Urun Onerileri</span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full">
                  {kritikUrunler.length} urun
                </span>
              </div>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Acil aksiyon gerekiyor</span>
            </div>
            <div className="divide-y divide-amber-500/10">
              {kritikUrunler.map(urun => (
                <div key={urun.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{urun.input.product_name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <TrendingDown size={12} className="text-red-400" />
                      <span className="text-xs text-red-500">
                        {urun.result.monthly_net_profit <= 0 ? 'Zarar ediyor' : 'Yuksek risk'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full">
                      {formatPercent(urun.result.margin_pct)}
                    </span>
                    <Link href={`/analysis/${urun.id}`}>
                      <button className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-card border border-amber-500/20 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-colors">
                        Incele <ArrowRight size={12} />
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ BÖLÜM 5 — Pazaryeri İstatistikleri ═══ */}
        <PazaryeriIstatistikKarti
          bagliPazaryerleri={[
            { id: 'trendyol', status: trendyolConn.status, supplier_id: trendyolConn.seller_id },
            { id: 'hepsiburada', status: 'disconnected' },
          ]}
        />

        {/* ═══ BÖLÜM 6 — Son Analizler ═══ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <List size={16} className="text-muted-foreground" />
              <span className="font-semibold text-foreground text-sm">Son Analizler</span>
            </div>
            <Link href="/products" className="text-xs text-orange-500 font-medium hover:underline">
              Tumunu Gor
            </Link>
          </div>
          <ProductsTable analyses={analyses.slice(0, 10)} onDelete={handleDelete} stockMap={stockMap} />
        </div>

      </div>
    </DashboardLayout>
  );
}
