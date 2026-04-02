'use client';

import { useState, useMemo } from 'react';
import { ProductInput, CalculationResult } from '@/types';
import { calculateProfit, n } from '@/utils/calculations';
import { formatCurrency } from '@/components/shared/format';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tag, Bookmark } from 'lucide-react';

interface Props {
  input: ProductInput;
  originalResult: CalculationResult;
}

interface SavedScenario {
  id: number;
  label: string;
  salePrice: number;
  netProfit: number;
  marginPct: number;
}

const DISCOUNT_PRESETS = [0, 5, 10, 15, 20, 25, 30, 40, 50];

// ─── küçük yardımcı bileşenler ───────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  enabled,
  onChange,
  informational = false,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  informational?: boolean;
}) {
  return (
    <div className="flex justify-between items-start py-3 border-b border-border/20">
      <div className="min-w-0 pr-4">
        <p className={`text-sm font-medium leading-snug ${informational ? 'text-muted-foreground' : 'text-foreground'}`}>
          {label}
          {informational && (
            <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground border rounded px-1 py-0.5">
              Bilgi
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={informational}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

function ResultRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'green' | 'red' | 'neutral';
}) {
  const colorClass =
    highlight === 'green'
      ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
      : highlight === 'red'
      ? 'text-red-400 font-semibold'
      : 'font-medium';
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-base font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}

// ─── ana bileşen ─────────────────────────────────────────────────────────────

export function CampaignSimulator({ input, originalResult }: Props) {
  // Fiyat indirimi
  const [discountPct, setDiscountPct] = useState(0);

  // Trendyol
  const [trendyolFreeShipping, setTrendyolFreeShipping] = useState(false);
  const [bugunKargoda, setBugunKargoda] = useState(false);

  // Hepsiburada
  const [hepFreeShipping, setHepFreeShipping] = useState(false);
  const [hizliTeslimat, setHizliTeslimat] = useState(false);

  // n11
  const [n11FreeShipping, setN11FreeShipping] = useState(false);
  const [campaignComm, setCampaignComm] = useState(false);
  const [campaignCommRate, setCampaignCommRate] = useState(n(input.commission_pct));

  // Amazon TR
  const [couponPctEnabled, setCouponPctEnabled] = useState(false);
  const [couponPctValue, setCouponPctValue] = useState(5);
  const [couponFixedEnabled, setCouponFixedEnabled] = useState(false);
  const [couponFixedValue, setCouponFixedValue] = useState(0);

  // Kaydedilen senaryolar (sadece local state)
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);

  const marketplace = input.marketplace;
  const basePrice = n(input.sale_price);
  const shippingCost = n(input.shipping_cost);

  // ── Simülasyon hesabı ──────────────────────────────────────────────────────
  const simResult = useMemo<CalculationResult>(() => {
    const newSalePrice = basePrice * (1 - discountPct / 100);
    const overrides: Partial<ProductInput> = { sale_price: newSalePrice };

    if (marketplace === 'trendyol' && bugunKargoda) {
      overrides.trendyol_service_fee = 5.49;
    }
    if (marketplace === 'hepsiburada' && hizliTeslimat) {
      overrides.trendyol_service_fee = 0;
    }
    if (marketplace === 'n11' && campaignComm) {
      overrides.commission_pct = campaignCommRate;
    }
    if (marketplace === 'amazon_tr') {
      let extra = n(input.other_cost, 0);
      if (couponPctEnabled) extra += newSalePrice * (couponPctValue / 100);
      if (couponFixedEnabled) extra += couponFixedValue;
      overrides.other_cost = extra;
    }

    return calculateProfit({ ...input, ...overrides });
  }, [
    input,
    marketplace,
    basePrice,
    discountPct,
    bugunKargoda,
    hizliTeslimat,
    campaignComm,
    campaignCommRate,
    couponPctEnabled,
    couponPctValue,
    couponFixedEnabled,
    couponFixedValue,
  ]);

  const profitDiff = simResult.unit_net_profit - originalResult.unit_net_profit;
  const monthlySales = n(input.monthly_sales_volume, 0);
  const monthlyImpact = simResult.unit_net_profit * monthlySales;

  const isLoss = simResult.unit_net_profit < 0;
  const isNearBreakeven = !isLoss && simResult.unit_net_profit <= 10 && simResult.unit_net_profit >= 0;
  const isLowMargin = !isLoss && !isNearBreakeven && simResult.margin_pct < 10;

  // ── Senaryo kaydetme ───────────────────────────────────────────────────────
  function handleSaveScenario() {
    const parts: string[] = [];
    if (discountPct > 0) parts.push(`%${discountPct} indirim`);
    if (marketplace === 'trendyol') {
      if (trendyolFreeShipping) parts.push('Bedava Kargo');
      if (bugunKargoda) parts.push('Bugün Kargoda');
    }
    if (marketplace === 'hepsiburada') {
      if (hepFreeShipping) parts.push('Bedava Kargo');
      if (hizliTeslimat) parts.push('Hızlı Teslimat');
    }
    if (marketplace === 'n11') {
      if (n11FreeShipping) parts.push('Bedava Kargo');
      if (campaignComm) parts.push(`%${campaignCommRate} kampanyalı komisyon`);
    }
    if (marketplace === 'amazon_tr') {
      if (couponPctEnabled) parts.push(`%${couponPctValue} kupon`);
      if (couponFixedEnabled) parts.push(`${couponFixedValue}₺ kupon`);
    }

    const newS: SavedScenario = {
      id: Date.now(),
      label: parts.length > 0 ? parts.join(' + ') : 'Değişiklik yok',
      salePrice: simResult.sale_price,
      netProfit: simResult.unit_net_profit,
      marginPct: simResult.margin_pct,
    };
    setSavedScenarios(prev => [newS, ...prev].slice(0, 3));
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-6">

      {/* Başlık */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Tag className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base">Kampanya Simülatörü</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Farklı kampanya senaryolarında kârlılığınızı anlık simüle edin. Asıl analiz
          sonuçlarınız değişmez.
        </p>
      </div>

      {/* Fiyat İndirimi */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Fiyat İndirimi</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={70}
              value={discountPct}
              onChange={e =>
                setDiscountPct(Math.min(70, Math.max(0, Number(e.target.value) || 0)))
              }
              className="w-16 h-7 text-sm text-center"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <Slider
          min={0}
          max={70}
          step={1}
          value={[discountPct]}
          onValueChange={([v]) => setDiscountPct(v)}
        />
        <div className="flex flex-wrap gap-1.5">
          {DISCOUNT_PRESETS.map(pct => (
            <button
              key={pct}
              onClick={() => setDiscountPct(pct)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                discountPct === pct
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-transparent hover:border-border'
              }`}
            >
              %{pct}
            </button>
          ))}
        </div>
      </div>

      {/* Trendyol toggleları */}
      {marketplace === 'trendyol' && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Trendyol Kampanyaları
          </p>
          <ToggleRow
            label="Flash İndirim"
            description="Trendyol bu ürünü öne çıkarır, görünürlük artar. Fiyat indirimi yukarıdan ayarlanır."
            enabled={false}
            onChange={() => {}}
            informational
          />
          <ToggleRow
            label="Bedava Kargo Kampanyası"
            description={`Kargo bedelini sen karşılarsın. Maliyet: ${formatCurrency(shippingCost)} (girilen kargo bedeli)`}
            enabled={trendyolFreeShipping}
            onChange={setTrendyolFreeShipping}
          />
          {trendyolFreeShipping && (
            <div className="ml-12 rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-300">
              ✓ {shippingCost > 0 ? `${formatCurrency(shippingCost)} kargo bedeli` : 'Kargo bedeli'} maliyet hesabına dahildir. Müşteri 0₺ öder.
            </div>
          )}
          <ToggleRow
            label='"Bugün Kargoda" Etiketi'
            description="Platform hizmet bedeli 8,49₺'den 5,49₺'ye düşer. Tasarruf: +3₺"
            enabled={bugunKargoda}
            onChange={setBugunKargoda}
          />
        </div>
      )}

      {/* Hepsiburada toggleları */}
      {marketplace === 'hepsiburada' && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Hepsiburada Kampanyaları
          </p>
          <ToggleRow
            label="Süper Fırsat Kampanyası"
            description="Fiyat indirimi gerektirir. Yukarıdan indirim oranını belirleyin."
            enabled={false}
            onChange={() => {}}
            informational
          />
          <ToggleRow
            label="Bedava Kargo"
            description={`Kargo bedelini sen karşılarsın. Maliyet: ${formatCurrency(shippingCost)}`}
            enabled={hepFreeShipping}
            onChange={setHepFreeShipping}
          />
          {hepFreeShipping && (
            <div className="ml-12 rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-300">
              ✓ {shippingCost > 0 ? `${formatCurrency(shippingCost)} kargo bedeli` : 'Kargo bedeli'} maliyet hesabına dahildir. Müşteri 0₺ öder.
            </div>
          )}
          <ToggleRow
            label="Hızlı Teslimat (0-1 gün)"
            description="Servis bedeli 9,50₺ kalkar. Tasarruf: +9,50₺"
            enabled={hizliTeslimat}
            onChange={setHizliTeslimat}
          />
        </div>
      )}

      {/* n11 toggleları */}
      {marketplace === 'n11' && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            n11 Kampanyaları
          </p>
          <div className="space-y-2">
            <ToggleRow
              label="Kampanyalı Komisyon"
              description="Platform kampanyasına katılırsan komisyon oranı düşebilir."
              enabled={campaignComm}
              onChange={setCampaignComm}
            />
            {campaignComm && (
              <div className="ml-12 flex items-center gap-2 mt-1">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  İndirimli Komisyon (%)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={campaignCommRate}
                  onChange={e =>
                    setCampaignCommRate(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-20 h-7 text-sm"
                />
              </div>
            )}
          </div>
          <ToggleRow
            label="Bedava Kargo"
            description={`Kargo bedelini sen karşılarsın. Maliyet: ${formatCurrency(shippingCost)}`}
            enabled={n11FreeShipping}
            onChange={setN11FreeShipping}
          />
          {n11FreeShipping && (
            <div className="ml-12 rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-300">
              ✓ {shippingCost > 0 ? `${formatCurrency(shippingCost)} kargo bedeli` : 'Kargo bedeli'} maliyet hesabına dahildir. Müşteri 0₺ öder.
            </div>
          )}
        </div>
      )}

      {/* Amazon TR toggleları */}
      {marketplace === 'amazon_tr' && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Amazon TR Kampanyaları
          </p>
          <ToggleRow
            label="Lightning Deal (Flaş Teklif)"
            description="Amazon öne çıkarır, görünürlük artar. Fiyat indirimi zorunludur — yukarıdan ayarlayın."
            enabled={false}
            onChange={() => {}}
            informational
          />
          <div className="space-y-2">
            <ToggleRow
              label="Kupon (%)"
              description="Müşteriye yüzde indirim kuponu ver. Kupon maliyeti satıcıya yansır."
              enabled={couponPctEnabled}
              onChange={setCouponPctEnabled}
            />
            {couponPctEnabled && (
              <div className="ml-12 flex items-center gap-2 mt-1">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  Kupon İndirimi (%)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={70}
                  value={couponPctValue}
                  onChange={e =>
                    setCouponPctValue(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-20 h-7 text-sm"
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <ToggleRow
              label="Kupon (₺ Sabit)"
              description="Müşteriye sabit tutarda kupon ver. Kupon maliyeti satıcıya yansır."
              enabled={couponFixedEnabled}
              onChange={setCouponFixedEnabled}
            />
            {couponFixedEnabled && (
              <div className="ml-12 flex items-center gap-2 mt-1">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  Kupon Tutarı (₺)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={couponFixedValue}
                  onChange={e =>
                    setCouponFixedValue(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-20 h-7 text-sm"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sonuç Paneli */}
      <div className="rounded-lg border border-border/30 bg-muted/40 p-4 space-y-3">
        <p className="text-sm font-semibold">
          📊 {discountPct > 0 ? `%${discountPct} İndirim` : 'Mevcut Fiyat'} Senaryosu
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
          <ResultRow label="Yeni Satış Fiyatı" value={formatCurrency(simResult.sale_price)} />
          <ResultRow label="Yeni Komisyon" value={formatCurrency(simResult.commission_amount)} />
          <ResultRow
            label="Yeni Net Kâr"
            value={formatCurrency(simResult.unit_net_profit)}
            highlight={simResult.unit_net_profit < 0 ? 'red' : simResult.unit_net_profit > 0 ? 'green' : 'neutral'}
          />
          <ResultRow label="Yeni Kâr Marjı" value={`${simResult.margin_pct.toFixed(1)}%`} />
          <ResultRow
            label="Kâr Değişimi"
            value={`${profitDiff >= 0 ? '+' : ''}${formatCurrency(profitDiff)}`}
            highlight={profitDiff >= 0 ? 'green' : 'red'}
          />
        </div>
      </div>

      {/* Uyarı sistemi */}
      {isLoss && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">🔴</span>
          <p className="text-xs text-red-400">
            Bu kampanya konfigürasyonunda <strong>ZARAR ediyorsunuz!</strong>{' '}
            {formatCurrency(Math.abs(simResult.unit_net_profit))} zarar bekleniyor.
          </p>
        </div>
      )}
      {isNearBreakeven && (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-3 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">🟠</span>
          <p className="text-xs text-orange-400">
            Uyarı! Bu kampanyada neredeyse başabaş noktasındasınız.
          </p>
        </div>
      )}
      {isLowMargin && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">🟡</span>
          <p className="text-xs text-yellow-400">
            Dikkat! Kâr marjınız <strong>%{simResult.margin_pct.toFixed(1)}</strong>&apos;e geriledi.
          </p>
        </div>
      )}

      {/* Özet satır */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm leading-relaxed">
          💡 <strong>Sonuç:</strong> Bu kampanya konfigürasyonunda birim başına{' '}
          <span
            className={
              simResult.unit_net_profit >= 0
                ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                : 'text-red-400 font-bold'
            }
          >
            {formatCurrency(simResult.unit_net_profit)}
          </span>{' '}
          {simResult.unit_net_profit >= 0 ? 'kâr edersiniz' : 'zarar edersiniz'}.
          {monthlySales > 0 && (
            <>
              {' '}Ayda {monthlySales} adet satarsanız toplam etki:{' '}
              <span
                className={
                  monthlyImpact >= 0
                    ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                    : 'text-red-400 font-bold'
                }
              >
                {monthlyImpact >= 0 ? '+' : ''}
                {formatCurrency(monthlyImpact)}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Senaryo Kaydet */}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSaveScenario}
          className="gap-2 text-xs"
        >
          <Bookmark className="h-3.5 w-3.5" />
          Bu Senaryoyu Kaydet
        </Button>
        {savedScenarios.length > 0 && (
          <span className="text-xs text-muted-foreground">{savedScenarios.length}/3 senaryo kaydedildi</span>
        )}
      </div>

      {/* Kaydedilmiş Senaryolar */}
      {savedScenarios.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {savedScenarios.map((s, i) => (
            <div key={s.id} className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs">
              <p className="font-semibold line-clamp-2">
                Senaryo {savedScenarios.length - i}: {s.label}
              </p>
              <div className="flex justify-between text-muted-foreground">
                <span>Satış Fiyatı</span>
                <span>{formatCurrency(s.salePrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Kâr</span>
                <span
                  className={
                    s.netProfit >= 0
                      ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                      : 'text-red-400 font-medium'
                  }
                >
                  {formatCurrency(s.netProfit)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Kâr Marjı</span>
                <span>{s.marginPct.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
