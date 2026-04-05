'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useAlerts } from '@/contexts/alert-context';
import { ProductInput, Marketplace } from '@/types';
import { marketplaces, getMarketplaceDefaults } from '@/lib/marketplace-data';
import { getMarketplaceCategories, getCategoryCommission, getCategoryReturnRate, N11_EXTRA_FEE_PCT, N11_MARKETING_FEE_PCT, N11_MARKETPLACE_FEE_PCT } from '@/lib/commission-categories';
import { getUserCommissionRates, getLastRatesUpdate, buildRateMap, lookupRate } from '@/lib/commission-rates';
import type { CommissionRate } from '@/lib/commission-rates';
import { calculateProfit, calculateRequiredPrice, calculateTrendyolServiceFee, getDefaultServiceFee, n } from '@/utils/calculations';
import { calculateProAccounting } from '@/utils/pro-accounting';
import { calculateRisk } from '@/utils/risk-engine';
import { saveAnalysis, generateId, getUserAnalysisCount } from '@/lib/api/analyses';
import { getPlanLimits } from '@/config/plans';
import { UpgradeModal } from '@/components/shared/upgrade-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/components/shared/format';
import { toast } from 'sonner';
import { Target, ArrowRight, Lock, Calculator, ChevronDown, ChevronUp, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { isProUser } from '@/utils/access';

const defaultInput: ProductInput = {
  marketplace: 'trendyol',
  product_name: '',
  monthly_sales_volume: 100,
  product_cost: 0,
  sale_price: 0,
  commission_pct: 18,
  shipping_cost: 0,
  packaging_cost: 0,
  ad_cost_per_sale: 0,
  return_rate_pct: 12, // ETBİS 2024 genel sektör ortalaması; kategori seçince otomatik güncellenir
  vat_pct: 20,
  other_cost: 0,
  payout_delay_days: 28,
  n11_extra_pct: 0,
  trendyol_service_fee: 0,
  // PRO defaults
  pro_mode: false,
  sale_price_includes_vat: true,
  sale_vat_pct: 20,
  product_cost_includes_vat: true,
  purchase_vat_pct: 20,
  marketplace_fee_vat_pct: 20,
  shipping_includes_vat: true,
  shipping_vat_pct: 20,
  packaging_includes_vat: true,
  packaging_vat_pct: 20,
  ad_includes_vat: true,
  ad_vat_pct: 20,
  other_cost_includes_vat: true,
  other_cost_vat_pct: 20,
  return_refunds_commission: true,
  return_extra_cost: 0,
};

interface FieldConfig {
  key: keyof ProductInput;
  label: string;
  type: 'number' | 'text';
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  group: string;
}

const fields: FieldConfig[] = [
  { key: 'product_name', label: 'Ürün Adı', type: 'text', required: true, group: 'basic' },
  { key: 'monthly_sales_volume', label: 'Aylık Satış Adedi', type: 'number', suffix: 'adet', min: 0, step: 1, required: true, group: 'basic' },
  { key: 'product_cost', label: 'Ürün Maliyeti', type: 'number', suffix: '₺', min: 0, step: 0.01, required: true, group: 'costs' },
  { key: 'sale_price', label: 'Satış Fiyatı', type: 'number', suffix: '₺', min: 0, step: 0.01, required: true, group: 'costs' },
  { key: 'commission_pct', label: 'Komisyon Oranı', type: 'number', suffix: '%', min: 0, max: 100, step: 0.1, group: 'marketplace' },
  { key: 'shipping_cost', label: 'Kargo Ücreti', type: 'number', suffix: '₺', min: 0, step: 0.01, group: 'costs' },
  { key: 'packaging_cost', label: 'Paketleme Maliyeti', type: 'number', suffix: '₺', min: 0, step: 0.01, group: 'costs' },
  { key: 'ad_cost_per_sale', label: 'Reklam Maliyeti (Birim)', type: 'number', suffix: '₺', min: 0, step: 0.01, group: 'costs' },
  { key: 'vat_pct', label: 'Varsayılan KDV', type: 'number', suffix: '%', min: 0, max: 100, step: 1, group: 'tax' },
  { key: 'other_cost', label: 'Diğer Giderler', type: 'number', suffix: '₺', min: 0, step: 0.01, group: 'costs' },
  { key: 'payout_delay_days', label: 'Ödeme Gecikme Süresi', type: 'number', suffix: 'gün', min: 0, step: 1, group: 'cashflow' },
];

interface AnalysisFormProps {
  initialData?: ProductInput;
  analysisId?: string;
  isDemo?: boolean;
}

export function AnalysisForm({ initialData, analysisId, isDemo = false }: AnalysisFormProps) {
  const { user } = useAuth();
  const { refresh } = useAlerts();
  const router = useRouter();

  const [input, setInput] = useState<ProductInput>({ ...defaultInput, ...initialData });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isWarningConfirmed, setIsWarningConfirmed] = useState(false);
  const [showProAdvanced, setShowProAdvanced] = useState(false);

  const [targetMargin, setTargetMargin] = useState<number | undefined>();
  const [targetProfit, setTargetProfit] = useState<number | undefined>();
  const [suggestedPrice, setSuggestedPrice] = useState<number | undefined>();

  const [customRateMap, setCustomRateMap] = useState<Map<string, number>>(new Map());
  const [ratesLastUpdated, setRatesLastUpdated] = useState<string | null>(null);
  const [iadeOranCekiliyor, setIadeOranCekiliyor] = useState(false);

  // In demo mode, treat as free user unless simulated otherwise
  const isProUserFlag = isDemo ? false : isProUser(user);
  const isProMode = input.pro_mode === true;

  const handleProToggle = (checked: boolean) => {
    if (checked && !isProUserFlag) {
      if (isDemo) {
        toast.info('Demo modunda sadece standart analiz yapılabilir.');
        return;
      }
      setShowUpgrade(true);
      // Ensure it stays off
      setInput(prev => ({ ...prev, pro_mode: false }));
      return;
    }
    setInput(prev => ({ ...prev, pro_mode: checked }));
  };

  // Watch for pro_mode changes from initialData or other sources
  useEffect(() => {
    if (input.pro_mode && !isProUserFlag && ((user) || isDemo)) {
      // Revert to standard mode if not pro
      setInput(prev => ({ ...prev, pro_mode: false }));
    }
  }, [input.pro_mode, isProUserFlag, user, isDemo]);

  useEffect(() => {
    if (!user || isDemo) return;
    (async () => {
      const [rates, lastUpdated] = await Promise.all([
        getUserCommissionRates(user.id),
        getLastRatesUpdate(user.id),
      ]);
      if (rates.length > 0) {
        setCustomRateMap(buildRateMap(rates));
      }
      setRatesLastUpdated(lastUpdated);
    })();
  }, [user, isDemo]);

  // Satış fiyatı değişince Trendyol servis bedelini otomatik güncelle
  useEffect(() => {
    if (input.marketplace !== 'trendyol') return;
    const autoFee = calculateTrendyolServiceFee(n(input.sale_price));
    setInput((prev) => ({ ...prev, trendyol_service_fee: autoFee }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.sale_price, input.marketplace]);

  const handleMarketplaceChange = (mp: Marketplace) => {
    const defaults = getMarketplaceDefaults(mp);
    setInput((prev) => ({
      ...prev,
      marketplace: mp,
      commission_pct: defaults.commission_pct,
      return_rate_pct: defaults.return_rate_pct,
      vat_pct: defaults.vat_pct,
      sale_vat_pct: defaults.vat_pct,
      purchase_vat_pct: defaults.vat_pct,
      payout_delay_days: defaults.payout_delay_days,
      marketplace_category: undefined,
      trendyol_category: undefined,
      n11_extra_pct: mp === 'n11' ? N11_EXTRA_FEE_PCT : 0,
      trendyol_service_fee: getDefaultServiceFee(mp),
    }));
  };

  const handleCategoryChange = (categoryLabel: string) => {
    // Use custom rate if available, fall back to default
    const customRate = lookupRate(customRateMap, input.marketplace, categoryLabel);
    const defaultRate = getCategoryCommission(input.marketplace, categoryLabel);
    const commission = customRate ?? defaultRate;
    // Auto-fill expected return rate from category data
    const returnRate = categoryLabel ? getCategoryReturnRate(input.marketplace, categoryLabel) : undefined;
    setInput((prev) => ({
      ...prev,
      marketplace_category: categoryLabel,
      trendyol_category: prev.marketplace === 'trendyol' ? categoryLabel : prev.trendyol_category,
      ...(commission !== undefined ? { commission_pct: commission } : {}),
      ...(returnRate !== undefined ? { return_rate_pct: returnRate } : {}),
    }));
  };

  const handleFieldChange = (key: keyof ProductInput, value: any) => {
    setInput(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    // Reset warning confirmation on any change
    if (isWarningConfirmed) {
      setIsWarningConfirmed(false);
      setWarnings([]);
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!input.product_name.trim()) errs.product_name = 'Ürün adı gereklidir.';
    // Semantic validations moved to warnings
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const checkWarnings = (): string[] => {
    const w: string[] = [];
    if (input.sale_price <= 0) w.push('Satış fiyatı 0 veya geçersiz. Gelir hesaplanamayabilir.');
    if (input.product_cost < 0) w.push('Ürün maliyeti negatif olamaz.');
    if (input.monthly_sales_volume <= 0) w.push('Aylık satış adedi 0 veya boş. Toplam kâr hesaplanamaz.');
    if (input.commission_pct > 35) w.push(`Komisyon oranı %${input.commission_pct} çok yüksek görünüyor.`);
    if (input.commission_pct < 0) w.push('Komisyon oranı negatif olamaz.');
    if (input.return_rate_pct > 35) w.push('İade oranı %35 üzerinde. Bu sektör ortalamasının üzerinde olabilir.');

    // Pro specific warnings
    if (input.pro_mode) {
      const vat = input.vat_pct ?? 0;
      const saleVat = input.sale_vat_pct ?? 0;
      if (vat > 30 || saleVat > 30) w.push('KDV oranı %30 üzerinde. Doğru mu?');
    }

    return w;
  };

  const iadeOranCek = async () => {
    setIadeOranCekiliyor(true);
    const t = toast.loading('İade oranı Trendyol\'dan çekiliyor...');
    try {
      const [claimRes, orderCountRes] = await Promise.all([
        fetch('/api/marketplace/trendyol/claims?gun=30'),
        fetch('/api/marketplace/trendyol/order-count?gun=30'),
      ]);
      const claimJson = await claimRes.json();
      const orderJson = await orderCountRes.json();
      const iadeSayisi: number = (claimJson?.claims as unknown[] | undefined)?.length ?? 0;
      const siparisAdedi: number = (orderJson?.totalOrders as number) ?? 0;
      if (siparisAdedi > 0) {
        const oran = Math.round((iadeSayisi / siparisAdedi) * 1000) / 10;
        handleFieldChange('return_rate_pct', oran);
        toast.success(`İade oranı Trendyol'dan çekildi: %${oran} (${iadeSayisi} iade / ${siparisAdedi} sipariş)`);
      } else if (iadeSayisi > 0) {
        toast.info(`${iadeSayisi} iade bulundu ama sipariş verisi alınamadı.`);
      } else {
        toast.error('Son 30 günde sipariş verisi bulunamadı.');
      }
    } catch {
      toast.error('İade oranı alınamadı.');
    } finally {
      toast.dismiss(t);
      setIadeOranCekiliyor(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Warning check
    if (!isWarningConfirmed) {
      const currentWarnings = checkWarnings();
      if (currentWarnings.length > 0) {
        setWarnings(currentWarnings);
        setIsWarningConfirmed(true);
        toast.warning('Girdiğiniz verilerde uyumsuzluklar olabilir. Lütfen kontrol edip tekrar "Kaydet"e basın.');
        return;
      }
    }

    // Auth check skipped in demo mode
    if (!isDemo && !user) return;

    setLoading(true);

    try {
      if (!isDemo && !analysisId && user) {
        const count = await getUserAnalysisCount();
        const limits = getPlanLimits(user.plan);
        if (count >= limits.maxProducts) {
          setShowUpgrade(true);
          setLoading(false);
          return;
        }
      }

      // Sanitize inputs to ensure numbers (fixes 0.00 display issue)
      const sanitized = { ...input };
      // Use fields config to identify numeric fields and parse them safely
      fields.forEach(f => {
        if (f.type === 'number') {
          // @ts-ignore
          sanitized[f.key] = n((sanitized as any)[f.key]);
        }
      });

      const effectivePro = isProUserFlag && sanitized.pro_mode;
      const result = effectivePro
        ? calculateProAccounting(sanitized)
        : calculateProfit(sanitized);

      const risk = calculateRisk(sanitized, result);

      if (isDemo) {
        // In demo mode, just show success and maybe scroll to result (if we were showing result on same page)
        // Since we redirect to detail page normally, for demo we might want to just show a toast 
        // OR prompt to sign up to see detailed report.
        // For now, let's just simulate a calculation "success" toast.
        // In a real app, we'd probably redirect to a /demo/result page or show a modal.

        setLoading(false);
        toast.success('Hesaplama Başarılı! (Demo Modu)');

        // Optional: We could trigger a state update to show results right here if the UI supported it.
        // But AnalysisForm relies on redirecting.
        // Let's redirect to a demo result page? Or simply show an alert.
        toast.info('Detaylı rapor ve kaydetme için ücretsiz hesap oluşturun.');
        return;
      }

      if (!user) return; // Should not happen given check above

      const analysisData = {
        id: analysisId || generateId(),
        userId: user.id,
        input: { ...sanitized, pro_mode: !!effectivePro },
        // Ensure sale_price is explicitly included in result if not already
        result: { ...result, sale_price: sanitized.sale_price },
        risk,
        createdAt: new Date().toISOString(),
      };

      const saveResult = await saveAnalysis(analysisData);

      if (!saveResult.success) {
        toast.error(`Hata oluştu: ${saveResult.error || 'Bilinmeyen hata'}`);
        setLoading(false);
        return;
      }

      toast.success(analysisId ? 'Analiz güncellendi.' : 'Analiz başarıyla kaydedildi.');

      // Trigger Risk Check (Fire and forget, don't await blocking UI)
      if (analysisData.id) {
        fetch('/api/notifications/check-risk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysisId: analysisData.id })
        }).catch(err => console.error('Risk check failed:', err));
      }

      await refresh();
      router.push(analysisId ? '/dashboard' : `/analysis/${analysisData.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(`Beklenmeyen hata: ${err.message || err}`);
      setLoading(false);
    }
  };

  const groups = [
    { key: 'basic', title: 'Temel Bilgiler' },
    { key: 'costs', title: 'Maliyet Bilgileri' },
    { key: 'marketplace', title: 'Pazaryeri Ayarları' },
    { key: 'tax', title: 'Vergi' },
    { key: 'cashflow', title: 'Nakit Akışı' },
  ];

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 p-6 sm:p-8">

        {/* PRO Toggle Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border bg-gradient-to-r from-card to-muted/30 p-5 sm:p-6 shadow-sm transition-all">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${isProMode ? 'bg-primary text-primary-foreground shadow-premium-sm' : 'bg-muted text-muted-foreground'}`}>
              <Calculator className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5">
                <Label htmlFor="pro-mode" className="font-bold text-base cursor-pointer">PRO Muhasebe Modu</Label>
                {!isProUserFlag && <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] px-2 py-0.5"><Lock className="h-3 w-3 mr-1" /> Premium</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">Gerçek E-Ticaret Muhasebesi (KDV Ayrıştırma)</p>
            </div>
          </div>
          <Switch
            id="pro-mode"
            checked={isProMode}
            onCheckedChange={handleProToggle}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        {/* PRO Granular Fields Section */}
        {isProMode && (
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent p-6 sm:p-7 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Badge className="bg-primary hover:bg-primary text-xs px-2.5 py-1">PRO AYARLAR</Badge>
                <span className="text-xs text-muted-foreground">İleri düzey KDV ve iade yönetimi</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Primary VAT Toggles */}
              <div className="space-y-4 rounded-xl border border-border/40 bg-card p-5 shadow-sm">
                <h4 className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" /> Gelir/Gider Temeli
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm">Satış Fiyatı KDV Dahil</Label>
                    <Switch checked={input.sale_price_includes_vat !== false} onCheckedChange={(v) => handleFieldChange('sale_price_includes_vat', v)} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm">Alış Fiyatı KDV Dahil</Label>
                    <Switch checked={input.product_cost_includes_vat !== false} onCheckedChange={(v) => handleFieldChange('product_cost_includes_vat', v)} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-border/40 bg-card p-5 shadow-sm">
                <h4 className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">KDV Oranları</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Satış KDV %</Label>
                    <Input type="number" className="h-10" value={input.sale_vat_pct ?? 20} onChange={(e) => handleFieldChange('sale_vat_pct', parseFloat(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Alış KDV %</Label>
                    <Input type="number" className="h-10" value={input.purchase_vat_pct ?? 20} onChange={(e) => handleFieldChange('purchase_vat_pct', parseFloat(e.target.value))} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-border/40 bg-card p-5 shadow-sm">
                <h4 className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Pazaryeri & İade</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm">İadede Komisyon İadesi</Label>
                    <Switch checked={input.return_refunds_commission !== false} onCheckedChange={(v) => handleFieldChange('return_refunds_commission', v)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Hizmet KDV (Komisyon) %</Label>
                    <Input type="number" className="h-10" value={input.marketplace_fee_vat_pct ?? 20} onChange={(e) => handleFieldChange('marketplace_fee_vat_pct', parseFloat(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Marketplace Selector */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Pazaryeri Seçimi</Label>
          <div className="flex flex-wrap gap-2">
            {marketplaces.map((mp) => (
              <button
                key={mp.key}
                type="button"
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${input.marketplace === mp.key
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border/40 bg-muted/10 hover:bg-muted/50 hover:border-border/60'
                  }`}
                onClick={() => handleMarketplaceChange(mp.key)}
              >
                {mp.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Pazaryeri değişikliği komisyon, iade ve KDV alanlarını otomatik doldurur.</p>
        </div>

        {/* Category Selector (all marketplaces except custom) */}
        {input.marketplace !== 'custom' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Kategori</Label>
              {ratesLastUpdated && (
                <span className="text-[10px] text-muted-foreground">
                  Son güncelleme: {new Date(ratesLastUpdated).toLocaleDateString('tr-TR')}
                </span>
              )}
            </div>
            <select
              value={input.marketplace_category || input.trendyol_category || ''}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">— Kategori seçin (isteğe bağlı) —</option>
              {getMarketplaceCategories(input.marketplace).map((cat) => {
                const customRate = lookupRate(customRateMap, input.marketplace, cat.label);
                const displayRate = customRate ?? cat.commission_pct;
                const isCustom = customRate !== undefined;
                return (
                  <option key={cat.label} value={cat.label}>
                    {cat.label} (%{displayRate}{isCustom ? ' ✓' : ''})
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-muted-foreground">
              Kategori seçimi komisyon oranını otomatik doldurur; dilediğinizde manuel değiştirebilirsiniz.
              {customRateMap.size > 0 && <span className="text-emerald-700 dark:text-emerald-400"> ✓ işaretliler kişisel oranlarınızı kullanıyor.</span>}
            </p>

            <p className="text-[11px] text-muted-foreground">
              Komisyon oranları tahmini değerlerdir. Kesin oranınızı satıcı panelinizden kontrol edip yukarıdan güncelleyebilirsiniz.
            </p>

          </div>
        )}

        {/* Beklenen İade Oranı — kategori seçiminden otomatik dolar */}
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="return_rate_pct" className="text-sm font-medium">Beklenen İade Oranı</Label>
            <span
              title="Ticaret Bakanlığı 2024 verilerine göre Türkiye'de en yüksek iade oranı giyim ve ayakkabı kategorisindedir. Kategori seçiminize göre sektör ortalaması otomatik girilmiştir. Kendi iade oranınızı biliyorsanız bu alanı manuel güncelleyebilirsiniz."
              className="cursor-help text-muted-foreground"
            >
              <Info className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="return_rate_pct"
                type="number"
                value={(input.return_rate_pct as number) ?? ''}
                onChange={(e) => handleFieldChange('return_rate_pct', parseFloat(e.target.value) || 0)}
                min={0}
                max={100}
                step={0.1}
                className="h-11 pr-8"
                placeholder="10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">%</span>
            </div>
            {input.marketplace === 'trendyol' && !isDemo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 px-3 text-xs whitespace-nowrap border-orange-500/40 text-orange-500 hover:bg-orange-500/10"
                onClick={iadeOranCek}
                disabled={iadeOranCekiliyor}
              >
                {iadeOranCekiliyor ? <span className="animate-spin mr-1">⟳</span> : null}
                Trendyol'dan Çek
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Satışlarınızın yüzde kaçının iade edileceğini tahmin edin. Otomatik hesaplanan değeri dilediğinizde manuel değiştirebilirsiniz.
            {input.marketplace === 'trendyol' && (
              <span className="text-muted-foreground/70"> &quot;Trendyol&apos;dan Çek&quot; butonu sadece son 30 günün verisiyle hesaplar.</span>
            )}
            {input.marketplace === 'amazon_tr' && (
              <span className="text-blue-400"> Amazon TR koşulsuz iade politikası nedeniyle +%3 eklendi.</span>
            )}
          </p>
        </div>

        {/* Platform Servis Bedeli — pazaryerine göre farklı davranır */}
        {input.marketplace !== 'amazon_tr' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-1.5">
              <Label
                htmlFor={input.marketplace === 'n11' ? 'n11_extra_pct' : 'trendyol_service_fee'}
                className="text-sm font-medium"
              >
                {input.marketplace === 'n11'
                  ? 'Hizmet Bedeli (%)'
                  : input.marketplace === 'custom'
                  ? 'Platform Hizmet Bedeli (₺)'
                  : 'Servis Bedeli'}
              </Label>
              <span
                title={
                  input.marketplace === 'trendyol'
                    ? "Trendyol'un her gönderi için aldığı sabit platform hizmet bedeli. Normal kargolarda 8,49 TL + KDV, 'Bugün Kargoda' etiketiyle 5,49 TL + KDV olarak uygulanır. Komisyondan bağımsız, her siparişten ayrıca kesilir."
                    : input.marketplace === 'hepsiburada'
                    ? "Hepsiburada'nın her gönderi için kestiği iki ayrı bedel: İşlem Bedeli 7₺ + Hizmet Bedeli 2,5₺ = toplam 9,5₺ + KDV. Siparişi 0-1 gün içinde kargoya verirsen bu bedel alınmıyor."
                    : input.marketplace === 'n11'
                    ? 'Satış tutarı üzerinden kesilen Pazarlama (%1,20) + Pazaryeri (%0,67) hizmet bedeli toplamı.'
                    : 'Pazaryerinin her sipariş için kestiği platform hizmet bedeli.'
                }
                className="cursor-help text-muted-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="relative">
              {input.marketplace === 'n11' ? (
                <Input
                  id="n11_extra_pct"
                  type="number"
                  value={(input.n11_extra_pct as number) ?? ''}
                  onChange={(e) => handleFieldChange('n11_extra_pct', parseFloat(e.target.value) || 0)}
                  min={0}
                  step={0.01}
                  className="h-11 pr-8"
                  placeholder="1.87"
                />
              ) : (
                <Input
                  id="trendyol_service_fee"
                  type="number"
                  value={(input.trendyol_service_fee as number) || ''}
                  onChange={(e) => handleFieldChange('trendyol_service_fee', parseFloat(e.target.value) || 0)}
                  min={0}
                  step={0.01}
                  className="h-11 pr-8"
                  placeholder="0"
                />
              )}
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                {input.marketplace === 'n11' ? '%' : '₺'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {input.marketplace === 'trendyol' && "Trendyol Platform Hizmet Bedeli (gönderi başına). 'Bugün Kargoda' etiketiyle 5,49₺'ye düşer."}
              {input.marketplace === 'hepsiburada' && 'İşlem Bedeli (7₺) + Hizmet Bedeli (2,5₺). Hızlı kargoda (0-1 gün) bu bedel alınmıyor.'}
              {input.marketplace === 'n11' && 'Pazarlama (%1,20) + Pazaryeri (%0,67) hizmet bedeli. Satış tutarı üzerinden kesilir.'}
              {input.marketplace === 'custom' && 'Platform hizmet bedelini manuel girin.'}
            </p>
          </div>
        )}

        {/* Amazon TR — servis bedeli yok, bilgi notu */}
        {input.marketplace === 'amazon_tr' && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs animate-in fade-in duration-200">
            <p className="text-blue-400">
              ℹ️ Amazon TR&apos;de ayrı bir sipariş başı servis bedeli uygulanmaz.
            </p>
          </div>
        )}

        {/* Field Groups */}
        {groups.map((group) => {
          const groupFields = fields.filter((f) => f.group === group.key);
          if (groupFields.length === 0) return null;

          return (
            <div key={group.key} className="space-y-5">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{group.title}</h3>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {groupFields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="text-sm font-medium">{field.label}</Label>
                    <div className="relative">
                      <Input
                        id={field.key}
                        type={field.type}
                        value={field.type === 'text' ? (input[field.key] as string) : (input[field.key] as number) || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        className={`h-11 ${field.suffix ? 'pr-10' : ''} ${errors[field.key] ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        placeholder={field.type === 'text' ? '' : '0'}
                      />
                      {field.suffix && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                          {field.suffix}
                        </span>
                      )}
                    </div>
                    {errors[field.key] && (
                      <p className="text-xs text-red-500">{errors[field.key]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Profit Target Simulation */}
        <div className="rounded-2xl border bg-gradient-to-br from-primary/[0.04] to-transparent p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-base">Kâr Hedefi Simülasyonu</h3>
              <p className="text-xs text-muted-foreground">Hedef kâra göre gerekli satış fiyatını hesaplayın.</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Hedef Marj (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="30"
                  value={targetMargin || ''}
                  onChange={(e) => {
                    setTargetMargin(parseFloat(e.target.value));
                    setTargetProfit(undefined);
                  }}
                  className="h-11 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Hedef Net Kâr (₺/birim)</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  value={targetProfit || ''}
                  onChange={(e) => {
                    setTargetProfit(parseFloat(e.target.value));
                    setTargetMargin(undefined);
                  }}
                  className="h-11 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₺</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="button"
              variant="secondary"
              className="rounded-[10px]"
              onClick={() => {
                if (targetMargin) {
                  const price = calculateRequiredPrice(input, 'margin', targetMargin);
                  setSuggestedPrice(price);
                } else if (targetProfit) {
                  const price = calculateRequiredPrice(input, 'profit', targetProfit);
                  setSuggestedPrice(price);
                } else {
                  toast.error('Lütfen bir hedef girin.');
                }
              }}
            >
              Hesapla
            </Button>

            {suggestedPrice !== undefined && suggestedPrice > 0 && (
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="bg-background border rounded-xl px-4 py-2.5 flex items-center gap-4 shadow-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Önerilen Satış Fiyatı</span>
                    <span className="font-bold text-primary text-lg">{formatCurrency(suggestedPrice)}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs hover:bg-primary hover:text-primary-foreground rounded-lg"
                    onClick={() => {
                      handleFieldChange('sale_price', suggestedPrice.toFixed(2));
                      setSuggestedPrice(undefined);
                      toast.success('Satış fiyatı güncellendi.');
                    }}
                  >
                    Uygula
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Warnings Display */}
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              <h4 className="font-semibold text-amber-800 text-sm">Dikkat Edilmesi Gerekenler</h4>
            </div>
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-500">{w}</li>
              ))}
            </ul>
            <p className="text-[10px] text-amber-600/80 mt-2 font-medium">Bu uyarılarla devam etmek için butona tekrar tıklayın.</p>
          </div>
        )}

        {/* Submit */}
        <div className="pt-2">
          <Button
            type="submit"
            size="lg"
            className={`w-full sm:w-auto h-12 px-8 text-base rounded-[10px] shadow-premium-sm transition-all ${isWarningConfirmed && warnings.length > 0 ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-500/20' : ''}`}
            disabled={loading}
          >
            {loading ? 'Hesaplanıyor...' : (
              isWarningConfirmed && warnings.length > 0 ? 'Yine de Kaydet / Hesapla' : (analysisId ? 'Güncelle' : 'Analiz Et')
            )}
          </Button>
        </div>
      </form>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  );
}
