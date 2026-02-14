'use client';

import { CalculationResult, ProductInput } from '@/types';
import { formatCurrency, formatPercent } from '@/components/shared/format';

interface CostBreakdownProps {
  input: ProductInput;
  result: CalculationResult;
}

export function CostBreakdown({ input, result }: CostBreakdownProps) {
  const items = [
    { label: 'Urun Maliyeti', value: input.product_cost },
    { label: 'Komisyon', value: result.commission_amount },
    { label: 'KDV', value: result.vat_amount },
    { label: 'Iade Kaybi', value: result.expected_return_loss },
    { label: 'Kargo', value: input.shipping_cost },
    { label: 'Paketleme', value: input.packaging_cost },
    { label: 'Reklam', value: input.ad_cost_per_sale },
    { label: 'Diger', value: input.other_cost },
  ];

  const total = result.unit_total_cost;
  const maxVal = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h3 className="text-sm font-semibold">Maliyet Dagilimi (Birim)</h3>
      <div className="mt-4 space-y-3">
        {items.filter((i) => i.value > 0).map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{formatCurrency(item.value)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-500"
                style={{ width: `${(item.value / maxVal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Toplam Birim Maliyet</span>
          <span className="text-lg font-bold">{formatCurrency(total)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Satis Fiyati</span>
          <span className="text-lg font-bold">{formatCurrency(input.sale_price)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Birim Net Kar</span>
          <span className={`text-lg font-bold ${result.unit_net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(result.unit_net_profit)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Kar Marji</span>
          <span className={`text-sm font-semibold ${result.margin_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatPercent(result.margin_pct)}
          </span>
        </div>
      </div>
    </div>
  );
}
