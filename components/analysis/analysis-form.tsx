'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useAlerts } from '@/contexts/alert-context';
import { ProductInput, Marketplace } from '@/types';
import { marketplaces, getMarketplaceDefaults } from '@/lib/marketplace-data';
import { calculateProfit, calculateRequiredPrice } from '@/utils/calculations';
import { calculateProAccounting } from '@/utils/pro-accounting';
import { calculateRisk } from '@/utils/risk-engine';
import { saveAnalysis, generateId, getUserAnalysisCount } from '@/lib/storage';
import { UpgradeModal } from '@/components/shared/upgrade-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/components/shared/format';
import { toast } from 'sonner';
import { Target, ArrowRight, Lock, Calculator, ChevronDown, ChevronUp, Info } from 'lucide-react';

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
  return_rate_pct: 8,
  vat_pct: 20,
  other_cost: 0,
  payout_delay_days: 28,
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
  { key: 'return_rate_pct', label: 'İade Oranı', type: 'number', suffix: '%', min: 0, max: 100, step: 0.1, group: 'marketplace' },
  { key: 'vat_pct', label: 'Varsayılan KDV', type: 'number', suffix: '%', min: 0, max: 100, step: 1, group: 'tax' },
  { key: 'other_cost', label: 'Diğer Giderler', type: 'number', suffix: '₺', min: 0, step: 0.01, group: 'costs' },
  { key: 'payout_delay_days', label: 'Ödeme Gecikme Süresi', type: 'number', suffix: 'gün', min: 0, step: 1, group: 'cashflow' },
];

interface AnalysisFormProps {
  initialData?: ProductInput;
  analysisId?: string;
}

export function AnalysisForm({ initialData, analysisId }: AnalysisFormProps) {
  const { user } = useAuth();
  const { refresh } = useAlerts();
  const router = useRouter();

  const [input, setInput] = useState<ProductInput>({ ...defaultInput, ...initialData });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showProAdvanced, setShowProAdvanced] = useState(false);

  const [targetMargin, setTargetMargin] = useState<number | undefined>();
  const [targetProfit, setTargetProfit] = useState<number | undefined>();
  const [suggestedPrice, setSuggestedPrice] = useState<number | undefined>();

  const isProUser = user?.plan === 'pro';
  const isProMode = input.pro_mode === true;

  const handleProToggle = (checked: boolean) => {
    if (!isProUser) {
      setShowUpgrade(true);
      return;
    }
    setInput(prev => ({ ...prev, pro_mode: checked }));
  };

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
      payout_delay_days: defaults.payout_delay_days
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
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!input.product_name.trim()) errs.product_name = 'Ürün adı gereklidir.';
    if (input.sale_price <= 0) errs.sale_price = 'Satış fiyatı 0\'dan büyük olmalıdır.';
    if (input.product_cost <= 0) errs.product_cost = 'Ürün maliyeti 0\'dan büyük olmalıdır.';
    if (input.monthly_sales_volume <= 0) errs.monthly_sales_volume = 'Satış adedi 0\'dan büyük olmalıdır.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !user) return;

    setLoading(true);

    try {
      if (!analysisId) {
        const count = await getUserAnalysisCount(user.id);
        if (user.plan === 'free' && count >= 5) {
          setShowUpgrade(true);
          setLoading(false);
          return;
        }
      }

      const effectivePro = isProUser && input.pro_mode;
      const result = effectivePro
        ? calculateProAccounting(input)
        : calculateProfit(input);

      const risk = calculateRisk(input, result);

      const analysisData = {
        id: analysisId || generateId(),
        userId: user.id,
        input: { ...input, pro_mode: !!effectivePro },
        result,
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
      <form onSubmit={handleSubmit} className="space-y-8 pb-20">

        {/* PRO Toggle Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border-2 border-primary/20 bg-card p-5 shadow-sm transition-all hover:border-primary/40">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-colors ${isProMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label htmlFor="pro-mode" className="font-bold text-lg cursor-pointer">PRO Muhasebe Modu</Label>
                {!isProUser && <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200"><Lock className="h-3 w-3 mr-1" /> Premium</Badge>}
              </div>
              <p className="text-sm text-muted-foreground italic">Gerçek E-Ticaret Muhasebesi (VAT-Excl)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="pro-mode"
              checked={isProMode}
              onCheckedChange={handleProToggle}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </div>

        {/* PRO Granular Fields Section */}
        {isProMode && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary hover:bg-primary">PRO AYARLAR</Badge>
                <span className="text-xs text-muted-foreground">İleri düzey KDV ve iade yönetimi</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-primary font-bold"
                onClick={() => setShowProAdvanced(!showProAdvanced)}
              >
                {showProAdvanced ? <><ChevronUp className="h-4 w-4 mr-1" /> Basitleştir</> : <><ChevronDown className="h-4 w-4 mr-1" /> Detaylar</>}
              </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Primary VAT Toggles */}
              <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
                <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" /> Gelir/Gider Temeli
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Satış Fiyatı KDV Dahil</Label>
                    <Switch checked={input.sale_price_includes_vat !== false} onCheckedChange={(v) => handleFieldChange('sale_price_includes_vat', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Alış Fiyatı KDV Dahil</Label>
                    <Switch checked={input.product_cost_includes_vat !== false} onCheckedChange={(v) => handleFieldChange('product_cost_includes_vat', v)} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">KDV Oranları</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase">Satış KDV %</Label>
                    <Input type="number" value={input.sale_vat_pct ?? 20} onChange={(e) => handleFieldChange('sale_vat_pct', parseFloat(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase">Alış KDV %</Label>
                    <Input type="number" value={input.purchase_vat_pct ?? 20} onChange={(e) => handleFieldChange('purchase_vat_pct', parseFloat(e.target.value))} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">Pazaryeri & İade</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs truncate mr-2">İadede Komisyon İadesi Var mı?</Label>
                    <Switch checked={input.return_refunds_commission !== false} onCheckedChange={(v) => handleFieldChange('return_refunds_commission', v)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Hizmet KDV (Komisyon KDV) %</Label>
                    <Input type="number" value={input.marketplace_fee_vat_pct ?? 20} onChange={(e) => handleFieldChange('marketplace_fee_vat_pct', parseFloat(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>

            {showProAdvanced && (
              <div className="pt-4 animate-in fade-in duration-300">
                <Separator className="mb-6" />
                <h4 className="text-sm font-bold mb-4">Gider Bazlı KDV Ayarları</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { id: 'shipping', label: 'Kargo', inc: 'shipping_includes_vat', pct: 'shipping_vat_pct' },
                    { id: 'packaging', label: 'Paketleme', inc: 'packaging_includes_vat', pct: 'packaging_vat_pct' },
                    { id: 'ad', label: 'Reklam', inc: 'ad_includes_vat', pct: 'ad_vat_pct' },
                    { id: 'other', label: 'Diğer', inc: 'other_cost_includes_vat', pct: 'other_cost_vat_pct' },
                  ].map((item) => (
                    <div key={item.id} className="rounded-xl border bg-card p-3 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-bold">{item.label}</span>
                        <Switch
                          checked={input[item.inc as keyof ProductInput] !== false}
                          onCheckedChange={(v) => handleFieldChange(item.inc as keyof ProductInput, v)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground uppercase flex-1">KDV Dahil</span>
                        <div className="relative w-16">
                          <Input
                            className="h-7 px-1.5 text-xs pr-4"
                            type="number"
                            value={(input[item.pct as keyof ProductInput] as number) ?? 20}
                            onChange={(e) => handleFieldChange(item.pct as keyof ProductInput, parseFloat(e.target.value))}
                          />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-xl border bg-amber-50 dark:bg-amber-900/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">Ek İade Maliyeti</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 flex-1">
                      Müşteri iade ettiğinde cebinizden çıkan ekstra kargo veya operasyon bedeli (Birim/Satış başına).
                    </p>
                    <div className="relative w-24">
                      <Input
                        type="number"
                        value={input.return_extra_cost ?? 0}
                        onChange={(e) => handleFieldChange('return_extra_cost', parseFloat(e.target.value))}
                        className="h-8 border-amber-200 dark:border-amber-800"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-amber-600">₺</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <Label>Pazaryeri Seçimi</Label>
          <div className="flex flex-wrap gap-2">
            {marketplaces.map((mp) => (
              <button
                key={mp.key}
                type="button"
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${input.marketplace === mp.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:bg-muted'
                  }`}
                onClick={() => handleMarketplaceChange(mp.key)}
              >
                {mp.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Pazaryeri değişikliği komisyon, iade ve KDV alanlarını otomatik doldurur.</p>
        </div>

        {groups.map((group) => {
          const groupFields = fields.filter((f) => f.group === group.key);
          if (groupFields.length === 0) return null;

          return (
            <div key={group.key} className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
                {group.title}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {groupFields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <div className="relative">
                      <Input
                        id={field.key}
                        type={field.type}
                        value={field.type === 'text' ? (input[field.key] as string) : (input[field.key] as number) || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        className={errors[field.key] ? 'border-red-500' : ''}
                        placeholder={field.type === 'text' ? '' : '0'}
                      />
                      {field.suffix && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
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

        <div className="rounded-2xl border bg-primary/5 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Kar Hedefi Simülasyonu</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Hedeflediğiniz kar oranına veya birim kara göre gerekli satış fiyatını hesaplayın.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Hedef Marj (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="30"
                  value={targetMargin || ''}
                  onChange={(e) => {
                    setTargetMargin(parseFloat(e.target.value));
                    setTargetProfit(undefined);
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Hedef Net Kar (₺/birim)</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  value={targetProfit || ''}
                  onChange={(e) => {
                    setTargetProfit(parseFloat(e.target.value));
                    setTargetMargin(undefined);
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₺</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="button"
              variant="secondary"
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
                <div className="bg-background border rounded-lg px-3 py-2 flex items-center gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground block">Önerilen Satış Fiyatı</span>
                    <span className="font-bold text-primary">{formatCurrency(suggestedPrice)}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs hover:bg-primary hover:text-white"
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

        <div className="pt-4">
          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={loading}>
            {loading ? 'Hesaplanıyor...' : (analysisId ? 'Güncelle' : 'Analiz Et')}
          </Button>
        </div>
      </form >

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  );
}
