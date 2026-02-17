'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { KPICard } from '@/components/shared/kpi-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Crown,
  Mail,
  Shield,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Percent,
  PlusCircle,
  FileUp,
  FileText,
  CreditCard,
  Target,
  Store,
  LogOut,
  Key,
  CheckCircle2,
  Clock,
  ChevronRight,
  Settings,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PLAN_LIMITS } from '@/config/plans';
import { isProUser } from '@/utils/access';
import { getStoredAnalyses } from '@/lib/storage';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import type { Analysis, Marketplace } from '@/types';

const MARKETPLACE_OPTIONS: { key: Marketplace; label: string }[] = [
  { key: 'trendyol', label: 'Trendyol' },
  { key: 'hepsiburada', label: 'Hepsiburada' },
  { key: 'amazon_tr', label: 'Amazon TR' },
  { key: 'n11', label: 'N11' },
  { key: 'custom', label: 'Diğer' },
];

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function riskBadge(level: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    safe: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', label: 'Düşük' },
    moderate: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', label: 'Orta' },
    risky: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', label: 'Yüksek' },
    dangerous: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', label: 'Kritik' },
  };
  const m = map[level] || map.moderate;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

export default function AccountPage() {
  const { user, upgradePlan, logout, updateProfile } = useAuth();
  const router = useRouter();

  const isPro = isProUser(user);

  // — Stats & analyses state —
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);

  // — Preference local state (seeded from user) —
  const [targetMargin, setTargetMargin] = useState<number>(user?.target_margin ?? 20);
  const [marginAlert, setMarginAlert] = useState<boolean>(user?.margin_alert ?? false);
  const [defaultMp, setDefaultMp] = useState<Marketplace>(user?.default_marketplace ?? 'trendyol');
  const [defaultCommission, setDefaultCommission] = useState<number>(user?.default_commission ?? 12);
  const [defaultVat, setDefaultVat] = useState<number>(user?.default_vat ?? 20);
  const [monthlyTarget, setMonthlyTarget] = useState<number>(user?.monthly_profit_target ?? 0);
  const [saving, setSaving] = useState(false);

  // — Auth provider info —
  const [providers, setProviders] = useState<string[]>([]);

  // Seed preference state when user loads
  useEffect(() => {
    if (user) {
      setTargetMargin(user.target_margin ?? 20);
      setMarginAlert(user.margin_alert ?? false);
      setDefaultMp(user.default_marketplace ?? 'trendyol');
      setDefaultCommission(user.default_commission ?? 12);
      setDefaultVat(user.default_vat ?? 20);
      setMonthlyTarget(user.monthly_profit_target ?? 0);
    }
  }, [user]);

  // Load analyses & providers
  useEffect(() => {
    if (!user) return;
    (async () => {
      const data = await getStoredAnalyses(user.id);
      setAnalyses(data);
      setStatsLoaded(true);
    })();
    // Get auth providers
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.app_metadata?.providers) {
        setProviders(data.user.app_metadata.providers);
      } else if (data?.user?.app_metadata?.provider) {
        setProviders([data.user.app_metadata.provider]);
      }
    })();
  }, [user]);

  // — Computed stats —
  const now = new Date();
  const thisMonth = analyses.filter((a) => {
    const d = new Date(a.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const profitable = analyses.filter((a) => a.result.unit_net_profit > 0).length;
  const losing = analyses.filter((a) => a.result.unit_net_profit <= 0).length;
  const avgMargin = analyses.length > 0
    ? analyses.reduce((sum, a) => sum + a.result.margin_pct, 0) / analyses.length
    : 0;
  const monthlyNetProfit = thisMonth.reduce((sum, a) => sum + (a.result.monthly_net_profit ?? 0), 0);
  const recent5 = analyses.slice(0, 5);

  // — Save preferences —
  const savePrefs = useCallback(async (updates: Record<string, any>) => {
    if (!user) return;
    setSaving(true);
    const res = await updateProfile(updates);
    if (res.success) {
      toast.success('Tercihler kaydedildi.');
    } else {
      toast.error('Kaydetme sırasında bir hata oluştu.');
    }
    setSaving(false);
  }, [user, updateProfile]);

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-8 pb-12">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hesap & Tercihler</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Profilinizi, hedeflerinizi ve varsayılan ayarlarınızı yönetin.
            </p>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="h-4 w-4" />
              Ayarlar
            </Button>
          </Link>
        </div>

        {/* ─── 1. Account Summary KPIs ─── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Bu Ay Analiz"
            value={statsLoaded ? String(thisMonth.length) : '—'}
            icon={BarChart3}
            subtitle={statsLoaded ? `Toplam ${analyses.length}` : undefined}
          />
          <KPICard
            title="Kârlı Ürün"
            value={statsLoaded ? String(profitable) : '—'}
            icon={TrendingUp}
            trend="up"
            subtitle={statsLoaded && analyses.length > 0 ? `%${Math.round((profitable / analyses.length) * 100)}` : undefined}
          />
          <KPICard
            title="Zarar Eden"
            value={statsLoaded ? String(losing) : '—'}
            icon={TrendingDown}
            trend={losing > 0 ? 'down' : 'neutral'}
            subtitle={statsLoaded && losing > 0 ? 'Dikkat!' : undefined}
          />
          <KPICard
            title="Ortalama Marj"
            value={statsLoaded ? `%${avgMargin.toFixed(1)}` : '—'}
            icon={Percent}
            trend={avgMargin > 15 ? 'up' : avgMargin > 0 ? 'neutral' : 'down'}
          />
        </div>

        {/* ─── 2. Quick Actions ─── */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Hızlı İşlemler</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: PlusCircle, label: 'Yeni Analiz Başlat', href: '/analysis/new', color: 'text-blue-500' },
              { icon: FileUp, label: 'CSV İçe Aktar', href: '/products', color: 'text-emerald-500' },
              { icon: FileText, label: 'PDF Rapor Oluştur', href: '/dashboard', color: 'text-amber-500' },
              { icon: CreditCard, label: 'Fiyatlandırma', href: '/pricing', color: 'text-purple-500' },
            ].map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="flex items-center gap-3 rounded-xl border bg-background p-4 hover:bg-muted/50 hover:shadow-sm transition-all cursor-pointer group">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted group-hover:bg-card transition-colors">
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <span className="text-sm font-medium flex-1">{action.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ─── 3. Profit Goals ─── */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Kâr Hedefi</h2>
              <p className="text-xs text-muted-foreground">Hedef marjınızı belirleyin, altına düşünce uyarı alın.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Hedef Net Marj</Label>
                <span className="text-lg font-bold text-primary tabular-nums">%{targetMargin}</span>
              </div>
              <Slider
                value={[targetMargin]}
                onValueChange={([v]) => setTargetMargin(v)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>%0</span>
                <span>%50</span>
                <span>%100</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-medium">Marj hedefin altına düşerse uyar</p>
                <p className="text-xs text-muted-foreground">Bildirim ve e-posta ile uyarı gönderilir.</p>
              </div>
              <Switch
                checked={marginAlert}
                onCheckedChange={(v) => setMarginAlert(v)}
              />
            </div>

            {/* Monthly Profit Target */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Hedef Aylık Kâr (₺)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={monthlyTarget || ''}
                    onChange={(e) => setMonthlyTarget(parseFloat(e.target.value) || 0)}
                    min={0}
                    step={100}
                    placeholder="5000"
                    className="h-10 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₺</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Dashboard&apos;da hedefe ne kadar yaklaştığını gösterir.</p>
              </div>

              {/* Mini progress */}
              {statsLoaded && monthlyTarget > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Bu Ay Toplam Net Kâr</span>
                    <span className={`font-bold tabular-nums ${monthlyNetProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                      {formatCurrency(monthlyNetProfit)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${monthlyNetProfit >= monthlyTarget
                          ? 'bg-emerald-500'
                          : monthlyNetProfit >= monthlyTarget * 0.5
                            ? 'bg-amber-500'
                            : 'bg-primary'
                        }`}
                      style={{ width: `${Math.min(100, Math.max(0, (monthlyNetProfit / monthlyTarget) * 100))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>%{Math.round(Math.max(0, (monthlyNetProfit / monthlyTarget) * 100))} tamamlandı</span>
                    <span>Hedef: {formatCurrency(monthlyTarget)}</span>
                  </div>
                </div>
              )}
            </div>

            <Button
              size="sm"
              disabled={saving}
              onClick={() => savePrefs({ target_margin: targetMargin, margin_alert: marginAlert, monthly_profit_target: monthlyTarget })}
              className="rounded-[10px]"
            >
              {saving ? 'Kaydediliyor...' : 'Hedefi Kaydet'}
            </Button>
          </div>
        </div>

        {/* ─── 4. Business Defaults ─── */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Store className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="font-semibold">Varsayılan Değerler</h2>
              <p className="text-xs text-muted-foreground">Yeni analizlerde otomatik doldurulacak varsayılanlar.</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Varsayılan Pazaryeri</Label>
              <select
                value={defaultMp}
                onChange={(e) => setDefaultMp(e.target.value as Marketplace)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {MARKETPLACE_OPTIONS.map((mp) => (
                  <option key={mp.key} value={mp.key}>
                    {mp.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Varsayılan Komisyon</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={defaultCommission}
                  onChange={(e) => setDefaultCommission(parseFloat(e.target.value) || 0)}
                  min={0}
                  max={100}
                  className="h-10 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Varsayılan KDV</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={defaultVat}
                  onChange={(e) => setDefaultVat(parseFloat(e.target.value) || 0)}
                  min={0}
                  max={100}
                  className="h-10 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            disabled={saving}
            onClick={() => savePrefs({
              default_marketplace: defaultMp,
              default_commission: defaultCommission,
              default_vat: defaultVat,
            })}
            className="rounded-[10px]"
          >
            {saving ? 'Kaydediliyor...' : 'Varsayılanları Kaydet'}
          </Button>
        </div>

        {/* ─── 5. Plan Section ─── */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isPro ? 'bg-amber-500/10' : 'bg-muted'}`}>
                <Crown className={`h-5 w-5 ${isPro ? 'text-amber-500' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{isPro ? 'Pro Plan' : 'Ücretsiz Plan'}</h2>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${isPro
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                    }`}>
                    {isPro ? 'Aktif' : 'Temel'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPro
                    ? 'Sınırsız analiz · PRO muhasebe · CSV/PDF dışa aktarma'
                    : `Maksimum ${PLAN_LIMITS.free.maxProducts} analiz. Pro için yükseltin.`}
                </p>
              </div>
            </div>
          </div>

          {isPro ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                'Sınırsız analiz',
                'PRO muhasebe modu',
                'CSV içe/dışa aktarma',
                'Hassasiyet analizi',
                'Nakit akışı tahmini',
              ].map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2.5 py-1 text-xs">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  {f}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <Button onClick={() => upgradePlan()} className="rounded-[10px]">Pro&apos;ya Yükselt</Button>
              <Link href="/pricing">
                <Button variant="outline" className="rounded-[10px]">Planları Gör</Button>
              </Link>
            </div>
          )}

          {isPro && (
            <div className="mt-4 pt-4 border-t">
              <Link href="/pricing">
                <Button variant="outline" size="sm" className="gap-1.5 rounded-[10px]">
                  Planı Yönet
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* ─── 6. Security ─── */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>
            <h2 className="font-semibold">Güvenlik</h2>
          </div>

          {/* Profile info */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[11px] text-muted-foreground">E-posta</p>
                <p className="text-sm font-medium">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[11px] text-muted-foreground">Bağlı Sağlayıcı</p>
                <div className="flex gap-1.5 mt-0.5">
                  {providers.length > 0 ? providers.map((p) => (
                    <span key={p} className="inline-flex items-center rounded-full border bg-muted/30 px-2 py-0.5 text-[10px] font-medium capitalize">
                      {p === 'email' ? 'E-posta' : p}
                    </span>
                  )) : (
                    <span className="text-xs text-muted-foreground">E-posta</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/20 rounded-[10px]"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              Çıkış Yap
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/20 rounded-[10px]"
              onClick={async () => {
                await supabase.auth.signOut({ scope: 'global' });
                router.push('/auth');
              }}
            >
              <LogOut className="h-4 w-4" />
              Tüm Cihazlardan Çıkış
            </Button>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="gap-1.5 rounded-[10px]">
                <Settings className="h-4 w-4" />
                Veri Yönetimi
              </Button>
            </Link>
          </div>
        </div>

        {/* ─── 7. Recent Activity ─── */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Son Analizler</h2>
            {analyses.length > 5 && (
              <Link href="/dashboard" className="text-xs text-primary hover:underline">
                Tümünü Gör
              </Link>
            )}
          </div>

          {recent5.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Henüz analiz yok.</p>
              <Link href="/analysis/new" className="text-xs text-primary mt-1 hover:underline">
                İlk analizinizi oluşturun →
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recent5.map((a) => (
                <Link key={a.id} href={`/analysis/${a.id}`}>
                  <div className="flex items-center gap-4 rounded-xl p-3 -mx-1 hover:bg-muted/50 transition-colors cursor-pointer group">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.result.unit_net_profit > 0
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : 'bg-red-50 dark:bg-red-900/20'
                      }`}>
                      {a.result.unit_net_profit > 0 ? (
                        <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.input.product_name || 'İsimsiz Ürün'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">{formatDate(a.createdAt)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold tabular-nums ${a.result.unit_net_profit > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                        }`}>
                        {formatCurrency(a.result.unit_net_profit)}
                      </p>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">%{a.result.margin_pct.toFixed(1)}</span>
                        {riskBadge(a.risk.level)}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
