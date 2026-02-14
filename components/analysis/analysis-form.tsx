'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useAlerts } from '@/contexts/alert-context';
import { ProductInput, Marketplace } from '@/types';
import { marketplaces, getMarketplaceDefaults } from '@/lib/marketplace-data';
import { calculateProfit, calculateRequiredPrice } from '@/utils/calculations';
import { calculateRisk } from '@/utils/risk-engine';
import { saveAnalysis, generateId, getUserAnalysisCount } from '@/lib/storage';
import { UpgradeModal } from '@/components/shared/upgrade-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/components/shared/format';
import { toast } from 'sonner';
import { Target, ArrowRight } from 'lucide-react';

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
  { key: 'product_name', label: 'Urun Adi', type: 'text', required: true, group: 'basic' },
  { key: 'monthly_sales_volume', label: 'Aylik Satis Adedi', type: 'number', suffix: 'adet', min: 0, step: 1, required: true, group: 'basic' },
  { key: 'product_cost', label: 'Urun Maliyeti', type: 'number', suffix: '₺', min: 0, step: 0.01, required: true, group: 'costs' },
  { key: 'sale_price', label: 'Satis Fiyati', type: 'number', suffix: '₺', min: 0, step: 0.01, required: true, group: 'costs' },
  { key: 'commission_pct', label: 'Komisyon Orani', type: 'number', suffix: '%', min: 0, max: 100, step: 0.1, group: 'marketplace' },
  { key: 'shipping_cost', label: 'Kargo Ucreti', type: 'number', suffix: '₺', min: 0, step: 0.01, group: 'costs' },
  { key: 'packaging_cost', label: 'Paketleme Maliyeti', type: 'number', suffix: '₺', min: 0, step: 0.01, group: 'costs' },
  { key: 'ad_cost_per_sale', label: 'Reklam Maliyeti (Birim)', type: 'number', suffix: '₺', min: 0, step: 0.01, group: 'costs' },
  { key: 'return_rate_pct', label: 'Iade Orani', type: 'number', suffix: '%', min: 0, max: 100, step: 0.1, group: 'marketplace' },
  { key: 'vat_pct', label: 'KDV Orani', type: 'number', suffix: '%', min: 0, max: 100, step: 1, group: 'tax' },
  { key: 'other_cost', label: 'Diger Giderler', type: 'number', suffix: '₺', min: 0, step: 0.01, group: 'costs' },
  { key: 'payout_delay_days', label: 'Odeme Gecikme Suresi', type: 'number', suffix: 'gun', min: 0, step: 1, group: 'cashflow' },
];

interface AnalysisFormProps {
  initialData?: ProductInput;
  analysisId?: string;
}

export function AnalysisForm({ initialData, analysisId }: AnalysisFormProps) {
  const { user } = useAuth();
  const { refresh } = useAlerts();
  const router = useRouter();
  const [input, setInput] = useState<ProductInput>(initialData || defaultInput);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [targetMargin, setTargetMargin] = useState<number | undefined>();
  const [targetProfit, setTargetProfit] = useState<number | undefined>();
  const [suggestedPrice, setSuggestedPrice] = useState<number | undefined>();

  const handleMarketplaceChange = (mp: Marketplace) => {
    const defaults = getMarketplaceDefaults(mp);
    setInput((prev) => ({
      ...prev,
      marketplace: mp,
      commission_pct: defaults.commission_pct,
      return_rate_pct: defaults.return_rate_pct,
      vat_pct: defaults.vat_pct,
      payout_delay_days: defaults.payout_delay_days
    }));
  };

  const handleFieldChange = (key: keyof ProductInput, value: string) => {
    const field = fields.find((f) => f.key === key);
    if (!field) return;

    if (field.type === 'text') {
      setInput((prev) => ({ ...prev, [key]: value }));
    } else {
      const num = parseFloat(value);
      if (value === '' || value === '-') {
        setInput((prev) => ({ ...prev, [key]: 0 }));
        return;
      }
      if (isNaN(num)) return;
      if (field.min !== undefined && num < field.min) return;
      if (field.max !== undefined && num > field.max) return;
      setInput((prev) => ({ ...prev, [key]: num }));
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!input.product_name.trim()) errs.product_name = 'Urun adi gereklidir.';
    if (input.sale_price <= 0) errs.sale_price = 'Satis fiyati 0\'dan buyuk olmalidir.';
    if (input.product_cost <= 0) errs.product_cost = 'Urun maliyeti 0\'dan buyuk olmalidir.';
    if (input.monthly_sales_volume <= 0) errs.monthly_sales_volume = 'Satis adedi 0\'dan buyuk olmalidir.';
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

      const result = calculateProfit(input);
      const risk = calculateRisk(input, result);
      const analysisData = {
        id: analysisId || generateId(),
        userId: user.id,
        input,
        result,
        risk,
        createdAt: new Date().toISOString(),
      };

      const saveResult = await saveAnalysis(analysisData);

      if (!saveResult.success) {
        toast.error(`Hata olustu: ${saveResult.error || 'Bilinmeyen hata'}`);
        setLoading(false);
        return;
      }

      toast.success(analysisId ? 'Analiz guncellendi.' : 'Analiz basariyla kaydedildi.');
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
    { key: 'marketplace', title: 'Pazaryeri Ayarlari' },
    { key: 'tax', title: 'Vergi' },
    { key: 'cashflow', title: 'Nakit Akisi' },
  ];

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-3">
          <Label>Pazaryeri Secimi</Label>
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
          <p className="text-xs text-muted-foreground">Pazaryeri degisikligi komisyon, iade ve KDV alanlarini otomatik doldurur.</p>
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
            <h3 className="font-bold text-lg">Kar Hedefi Simulasyonu</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Hedeflediginiz kar oranina veya birim kara gore gerekli satis fiyatini hesaplayin.
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
                  toast.error('Lutfen bir hedef girin.');
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
                    <span className="text-xs text-muted-foreground block">Onerilen Satis Fiyati</span>
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
                      toast.success('Satis fiyati guncellendi.');
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
            {loading ? 'Hesaplaniyor...' : (analysisId ? 'Guncelle' : 'Analiz Et')}
          </Button>
        </div>
      </form >

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  );
}
