'use client';

import { CalculationResult, ProductInput } from '@/types';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { n } from '@/utils/calculations';
import { splitVat } from '@/utils/pro-accounting';

interface CostBreakdownProps {
  input: ProductInput;
  result: CalculationResult;
}

export function CostBreakdown({ input, result }: CostBreakdownProps) {
  const isProMode = input.pro_mode === true;

  // Helper to get net value for display
  const getNet = (val: number, inc: boolean | undefined, pct: number | undefined) => {
    if (!isProMode) return val;
    return splitVat(n(val), n(pct, 20), inc !== false).net;
  };

  const items = [
    {
      label: isProMode ? 'Net Ürün Maliyeti' : 'Ürün Maliyeti',
      value: getNet(input.product_cost, input.product_cost_includes_vat, input.purchase_vat_pct ?? input.vat_pct)
    },
    { label: 'Komisyon (Net)', value: n(result.commission_amount) },
    ...(n(result.service_fee_amount) > 0
      ? [{
          label: input.marketplace === 'hepsiburada'
            ? 'Hepsiburada Servis Bedeli'
            : input.marketplace === 'trendyol'
            ? 'Trendyol Servis Bedeli'
            : 'Platform Hizmet Bedeli',
          value: n(result.service_fee_amount)
        }]
      : []),
    { label: isProMode ? 'Satış KDV (Çıkış)' : 'KDV', value: n(result.vat_amount) },
    { label: 'İade Kaybı (Net)', value: n(result.expected_return_loss) },
    {
      label: isProMode ? 'Kargo (Net)' : 'Kargo',
      value: getNet(input.shipping_cost, input.shipping_includes_vat, input.shipping_vat_pct)
    },
    {
      label: isProMode ? 'Paketleme (Net)' : 'Paketleme',
      value: getNet(input.packaging_cost, input.packaging_includes_vat, input.packaging_vat_pct)
    },
    {
      label: isProMode ? 'Reklam (Net)' : 'Reklam',
      value: getNet(input.ad_cost_per_sale, input.ad_includes_vat, input.ad_vat_pct)
    },
    {
      label: isProMode ? 'Diğer (Net)' : 'Diğer',
      value: getNet(input.other_cost, input.other_cost_includes_vat, input.other_cost_vat_pct)
    },
  ];

  const total = n(result.unit_total_cost);
  const maxVal = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Maliyet dağılımı (birim)</h3>
        {isProMode && <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">NET ESASLI</span>}
      </div>

      <div className="divide-y divide-border/20">
        {items.filter((i) => i.value > 0).map((item) => (
          <div key={item.label} className="space-y-1.5 py-3 hover:bg-muted/30 transition-colors rounded-md px-1 -mx-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium text-foreground">{formatCurrency(item.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/20 border border-border/40">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-700 ease-out"
                style={{ width: `${(item.value / maxVal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t pt-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Toplam birim maliyet</span>
          <span className="text-lg font-semibold">{formatCurrency(total)}</span>
        </div>
        <div className="flex items-center justify-between pb-1 border-b border-dashed border-border/30">
          <span className="text-xs font-medium text-muted-foreground">Satış fiyatı</span>
          <span className="text-lg font-semibold text-primary">{formatCurrency(n(input.sale_price) || (result as any).sale_price || 0)}</span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <div>
            <span className="text-sm font-semibold block">Birim net kâr</span>
            <span className="text-[10px] text-muted-foreground italic leading-none">
              {isProMode ? "(KDV ve Vergiler Hariç)" : "(Tahmini)"}
            </span>
          </div>
          <div className="text-right">
            <p className={`text-xl font-bold ${result.unit_net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(result.unit_net_profit)}
            </p>
            <p className={`text-xs font-medium ${result.margin_pct >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
              {formatPercent(result.margin_pct)} marj
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
