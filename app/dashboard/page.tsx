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
  Store, ExternalLink, Loader2,
  ShoppingBag, Truck, Clock, XCircle, Zap, Pencil
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
  const { user, updateProfile } = useAuth();
  const { analyses, loading, refresh } = useAlerts();
  const [trendyolConn, setTrendyolConn] = useState<ConnStatus>({ status: 'disconnected' });
  const [stockMap, setStockMap] = useState<Map<string, StockItem> | undefined>();
  const [orderSummary, setOrderSummary] = useState<{
    today: number; todayChange: number; shipped: number;
    pending: number; cancelled: number; pendingOver24h: number; activeClaims: number;
  } | null>(null);
  const [dailyProfit, setDailyProfit] = useState<{
    days: Array<{ date: string; label: string; profit: number }>;
    totalRevenue: number; revenueChange: number; revenueGoal: number; goalPercent: number;
  } | null>(null);
  const isPro = isProUser(user);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

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
          const item: StockItem = { barcode: p.barcode, quantity: p.quantity, salePrice: p.salePrice, imageUrl: p.imageUrl, productUrl: p.productUrl, monthlySales: p.monthlySales ?? 0 };
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

    // Sipariş özetini çek
    fetch('/api/marketplace/trendyol/order-summary')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.success) setOrderSummary(data); })
      .catch(() => {});

    // Günlük kar verisini cek
    fetch('/api/marketplace/trendyol/daily-profit')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.success) setDailyProfit(data); })
      .catch(() => {});
  }, [isPro]);

  const handleSaveGoal = async () => {
    const val = parseFloat(goalInput);
    if (isNaN(val) || val < 0) { toast.error('Gecerli bir hedef girin.'); return; }
    const res = await updateProfile({ revenue_goal: val });
    if (res.success) {
      toast.success('Ciro hedefi kaydedildi.');
      setEditingGoal(false);
    } else {
      toast.error('Hedef kaydedilemedi.');
    }
  };

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
  const totalUnitsSold = useMemo(() => {
    // orderSummary varsa shipped+delivered kullan, yoksa analizlerden monthly_sales_volume topla
    if (orderSummary) return orderSummary.today + orderSummary.shipped;
    return analyses.reduce((sum, a) => sum + (a.input.monthly_sales_volume ?? 0), 0);
  }, [analyses, orderSummary]);
  const totalProfit = analyses.reduce((sum, a) => sum + a.result.monthly_net_profit, 0);
  const avgMargin = analyses.length > 0
    ? analyses.reduce((sum, a) => sum + a.result.margin_pct, 0) / analyses.length
    : 0;
  const riskyCount = analyses.filter(a => a.risk.level === 'risky' || a.risk.level === 'dangerous').length;
  const mostProfitable = analyses.length > 0
    ? analyses.reduce((best, a) => a.result.monthly_net_profit > best.result.monthly_net_profit ? a : best, analyses[0])
    : null;

  // Kritik ürün durumu
  const criticalProducts = useMemo(() => {
    const lossCount = analyses.filter(a => a.result.unit_net_profit < 0).length;
    const lowMarginCount = analyses.filter(a => a.result.margin_pct >= 0 && a.result.margin_pct < 10).length;
    // Stok riski: stockMap'ten 5 altı stoklu ürünleri say
    let lowStockCount = 0;
    if (stockMap) {
      const counted = new Set<string>();
      for (const a of analyses) {
        const inputs = a.input as unknown as Record<string, unknown>;
        const barcode = String(inputs.barcode ?? '').trim();
        const nameKey = a.input.product_name.toLowerCase();
        const normKey = nameKey.replace(/[\s\-_./]+/g, '');
        const stock = (barcode ? stockMap.get(barcode) : undefined)
          ?? stockMap.get(nameKey)
          ?? stockMap.get(normKey);
        if (stock && stock.quantity <= 5 && !counted.has(a.id)) {
          lowStockCount++;
          counted.add(a.id);
        }
      }
    }
    return { total: lossCount + lowMarginCount + lowStockCount, lossCount, lowMarginCount, lowStockCount };
  }, [analyses, stockMap]);

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

          {/* Bu Ay Satış */}
          <div className="bg-card rounded-xl p-5 border border-border/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Bu Ay Satis</span>
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <ShoppingBag size={16} className="text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-foreground">{totalUnitsSold.toLocaleString('tr-TR')}</div>
            <div className="text-sm text-muted-foreground mt-1">Bu ay satilan urun</div>
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

        {/* ═══ BÖLÜM 3 — Bu Ay Ciro + Ürün Durumu ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* SOL: Bu Ay Ciro + Grafik */}
          <div className="bg-card rounded-xl border border-border/40 p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Bu Ay Ciro</div>
                <div className="text-2xl font-bold text-foreground mt-1">{formatCurrency(dailyProfit?.totalRevenue ?? 0)}</div>
                {(dailyProfit?.revenueChange ?? 0) !== 0 && (
                  <div className={`text-xs mt-1 flex items-center gap-1 ${(dailyProfit?.revenueChange ?? 0) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    <TrendingUp size={12} className={(dailyProfit?.revenueChange ?? 0) < 0 ? 'rotate-180' : ''} />
                    %{Math.abs(dailyProfit?.revenueChange ?? 0)} gecen aya gore
                  </div>
                )}
              </div>
              <div className="text-right">
                {editingGoal ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      className="w-24 h-7 text-xs text-foreground bg-muted/20 border border-border/40 rounded px-2"
                      value={goalInput}
                      onChange={e => setGoalInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
                      autoFocus
                      placeholder="60000"
                    />
                    <button onClick={handleSaveGoal} className="text-[10px] text-emerald-600 font-medium">Kaydet</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setGoalInput(String(user?.revenue_goal ?? 60000)); setEditingGoal(true); }}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Hedef: {formatCurrency(user?.revenue_goal ?? 60000)}
                    <Pencil size={10} />
                  </button>
                )}
                {(() => {
                  const goal = user?.revenue_goal ?? 60000;
                  const pct = goal > 0 ? Math.min(100, Math.round(((dailyProfit?.totalRevenue ?? 0) / goal) * 100)) : 0;
                  return (
                    <>
                      <div className="w-24 h-1.5 bg-muted/30 rounded-full mt-1.5 overflow-hidden ml-auto">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-emerald-600 mt-0.5">%{pct} tamamlandi</div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Grafik */}
            {dailyProfit && dailyProfit.days.length > 0 && (() => {
              const maxAbs = Math.max(...dailyProfit.days.map(d => Math.abs(d.profit)), 1);
              const points = dailyProfit.days.map((d, i) => ({
                x: i * (400 / 6),
                y: 50 - (d.profit / maxAbs * 45),
              }));
              // Smooth bezier path
              let path = `M${points[0].x},${points[0].y}`;
              for (let i = 1; i < points.length; i++) {
                const cx = (points[i - 1].x + points[i].x) / 2;
                path += ` C${cx},${points[i - 1].y} ${cx},${points[i].y} ${points[i].x},${points[i].y}`;
              }
              const areaPathUp = path + ` L${points[points.length - 1].x},50 L${points[0].x},50 Z`;
              const areaPathDn = areaPathUp;
              const last = points[points.length - 1];

              return (
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Gunluk Kar / Zarar — Son 7 Gun</div>
                  <svg width="100%" viewBox="0 0 400 100" preserveAspectRatio="none" style={{ height: 100 }}>
                    <defs>
                      <clipPath id="up"><rect x="0" y="0" width="400" height="50" /></clipPath>
                      <clipPath id="dn"><rect x="0" y="50" width="400" height="50" /></clipPath>
                      <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.02" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.22" />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="50" x2="400" y2="50" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4,6" />
                    <path d={areaPathUp} fill="url(#gGreen)" clipPath="url(#up)" />
                    <path d={areaPathDn} fill="url(#gRed)" clipPath="url(#dn)" />
                    <path d={path} fill="none" stroke="#22c55e" strokeWidth="2.5" clipPath="url(#up)" />
                    <path d={path} fill="none" stroke="#ef4444" strokeWidth="2.5" clipPath="url(#dn)" />
                    <circle cx={last.x} cy={last.y} r="8" fill={last.y <= 50 ? '#22c55e' : '#ef4444'} opacity="0.15" />
                    <circle cx={last.x} cy={last.y} r="3.5" fill={last.y <= 50 ? '#22c55e' : '#ef4444'} />
                  </svg>
                  <div className="flex justify-between mt-1">
                    {dailyProfit.days.map((d, i) => (
                      <span key={i} className="text-[10px] text-muted-foreground/45">{d.label}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-3 h-0.5 bg-emerald-500 rounded" /> Karli gun</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-3 h-0.5 bg-red-500 rounded" /> Zararli gun</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* SAĞ: Ürün Durumu */}
          <div className="bg-card rounded-xl border border-border/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Urun Durumu</span>
              <Link href="/products" className="text-xs text-orange-500 font-medium hover:underline">Detay</Link>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div className="text-2xl font-bold text-emerald-600">{profitableCount}</div>
                <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Karli</div>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="text-2xl font-bold text-red-500">{lossCount}</div>
                <div className="text-[10px] text-red-500 font-medium mt-0.5">Zararda</div>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
                <div className="text-2xl font-bold text-amber-600">{riskyCount}</div>
                <div className="text-[10px] text-amber-600 font-medium mt-0.5">Riskli</div>
              </div>
            </div>

            {/* En Kârlı Ürün */}
            {mostProfitable && (
              <div className="border-t border-border/40 pt-4">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">En Karli Urun</div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Star size={14} className="text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{mostProfitable.input.product_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(mostProfitable.result.monthly_net_profit)} / ay · {formatPercent(mostProfitable.result.margin_pct)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Portföy özeti */}
            <div className="border-t border-border/40 pt-4">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Toplam aylik kar</span>
                <span className={`font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(totalProfit)}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-muted-foreground">Ortalama marj</span>
                <span className="font-bold text-foreground">{formatPercent(avgMargin)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ BÖLÜM 4 — Kritik Ürün Durumu ═══ */}
        {criticalProducts.total > 0 && (
          <div className="bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/20 overflow-hidden">
            {/* Başlık */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <span className="font-semibold text-foreground text-sm">Kritik Urun Durumu</span>
                <span className="text-xs font-medium text-amber-600 bg-amber-500/15 px-2 py-0.5 rounded-full">
                  {criticalProducts.total}
                </span>
              </div>
              <Link href="/products" className="text-xs text-amber-600 font-medium hover:underline">
                Tumunu Gor
              </Link>
            </div>

            {/* 3 Sütun */}
            <div className="grid grid-cols-3 divide-x divide-amber-500/15 border-t border-amber-500/15">
              {/* Zarar Eden */}
              <div className="p-5 flex flex-col gap-3" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, transparent 60%)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.7)' }} />
                  <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>Zarar Eden</span>
                </div>
                <div className="text-4xl font-extrabold" style={{ color: '#ef4444' }}>{criticalProducts.lossCount}</div>
                <p className="text-[11px] text-muted-foreground">Satis fiyati maliyetin altinda</p>
                <Link href="/products?filter=loss" className="text-xs font-medium hover:underline" style={{ color: '#ef4444' }}>
                  Incele
                </Link>
              </div>

              {/* Düşük Marj */}
              <div className="p-5 flex flex-col gap-3" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, transparent 60%)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#f97316', boxShadow: '0 0 6px rgba(249,115,22,0.7)' }} />
                  <span className="text-xs font-semibold" style={{ color: '#f97316' }}>Dusuk Marj</span>
                </div>
                <div className="text-4xl font-extrabold" style={{ color: '#f97316' }}>{criticalProducts.lowMarginCount}</div>
                <p className="text-[11px] text-muted-foreground">%10&apos;un altinda marj</p>
                <Link href="/products?filter=low-margin" className="text-xs font-medium hover:underline" style={{ color: '#f97316' }}>
                  Incele
                </Link>
              </div>

              {/* Stok Riski */}
              <div className="p-5 flex flex-col gap-3" style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.08) 0%, transparent 60%)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#eab308', boxShadow: '0 0 6px rgba(234,179,8,0.7)' }} />
                  <span className="text-xs font-semibold" style={{ color: '#ca8a04' }}>Stok Riski</span>
                </div>
                <div className="text-4xl font-extrabold" style={{ color: '#ca8a04' }}>{criticalProducts.lowStockCount}</div>
                <p className="text-[11px] text-muted-foreground">Stok tukenme esiginde</p>
                <Link href="/products?filter=low-stock" className="text-xs font-medium hover:underline" style={{ color: '#ca8a04' }}>
                  Incele
                </Link>
              </div>
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

        {/* ═══ BÖLÜM 6 — Siparişler ═══ */}
        {orderSummary && (
          <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
            {/* Başlık */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-primary" />
                <span className="font-semibold text-foreground text-sm">Siparisler</span>
              </div>
              <Link href="/marketplace" className="text-xs text-orange-500 font-medium hover:underline">
                Tumunu Gor
              </Link>
            </div>

            {/* 4 Metrik */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border/40">
              <div className="px-5 py-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Bugunku Siparis</div>
                <div className="text-2xl font-bold text-foreground">{orderSummary.today}</div>
                {orderSummary.todayChange !== 0 && (
                  <div className={`text-xs mt-1 flex items-center justify-center gap-1 ${orderSummary.todayChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    <TrendingUp size={12} className={orderSummary.todayChange < 0 ? 'rotate-180' : ''} />
                    %{Math.abs(orderSummary.todayChange)} {orderSummary.todayChange > 0 ? 'dunden fazla' : 'dunden az'}
                  </div>
                )}
              </div>
              <div className="px-5 py-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Kargolanan</div>
                <div className="text-2xl font-bold text-emerald-600">{orderSummary.shipped}</div>
                <div className="text-xs text-muted-foreground mt-1">teslim edildi</div>
              </div>
              <div className="px-5 py-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Bekleyen</div>
                <div className="text-2xl font-bold text-orange-500">{orderSummary.pending}</div>
                <div className="text-xs text-muted-foreground mt-1">islem bekliyor</div>
              </div>
              <div className="px-5 py-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Iptal / Iade</div>
                <div className="text-2xl font-bold text-red-500">{orderSummary.cancelled + orderSummary.activeClaims}</div>
                <div className="text-xs text-muted-foreground mt-1">inceleme gerekiyor</div>
              </div>
            </div>

            {/* Aksiyon Bölümü */}
            <div className="border-t border-border/40">
              <div className="px-5 py-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Zap size={10} /> Aksiyon Gerekiyor
                </span>
              </div>
              <div className="divide-y divide-border/20">
                {orderSummary.pendingOver24h > 0 && (
                  <div className="flex items-center justify-between px-5 py-3 bg-orange-500/5">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-orange-500" />
                      <span className="text-xs text-orange-700 dark:text-orange-400">
                        {orderSummary.pendingOver24h} siparis 24 saati geciyor — Kargoya verilmedi
                      </span>
                    </div>
                    <Link href="/marketplace">
                      <button className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-lg hover:bg-orange-500/20 transition-colors">
                        <Truck size={12} /> Kargola
                      </button>
                    </Link>
                  </div>
                )}
                {orderSummary.activeClaims > 0 && (
                  <div className="flex items-center justify-between px-5 py-3 bg-red-500/5">
                    <div className="flex items-center gap-2">
                      <XCircle size={14} className="text-red-500" />
                      <span className="text-xs text-red-700 dark:text-red-400">
                        {orderSummary.activeClaims} iade talebi bekliyor — Musteri yaniti bekleniyor
                      </span>
                    </div>
                    <Link href="/finance">
                      <button className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors">
                        <ArrowRight size={12} /> Incele
                      </button>
                    </Link>
                  </div>
                )}
                {orderSummary.pendingOver24h === 0 && orderSummary.activeClaims === 0 && (
                  <div className="flex items-center gap-2 px-5 py-3 bg-emerald-500/5">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">Tum siparisler guncel</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
