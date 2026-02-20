'use client';

import { ProductInput, Marketplace } from '@/types';
import { marketplaces } from '@/lib/marketplace-data';
import { calculateProfit } from '@/utils/calculations';
import { calculateRisk } from '@/utils/risk-engine';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { RiskBadge } from '@/components/shared/risk-badge';
import { Star } from 'lucide-react';

interface MarketplaceComparisonProps {
  input: ProductInput;
}

export function MarketplaceComparison({ input }: MarketplaceComparisonProps) {
  const comparisons = marketplaces
    .filter((mp) => mp.key !== 'custom')
    .map((mp) => {
      const adjusted: ProductInput = {
        ...input,
        marketplace: mp.key as Marketplace,
        commission_pct: mp.commission_pct,
        return_rate_pct: mp.return_rate_pct,
      };
      const result = calculateProfit(adjusted);
      const risk = calculateRisk(adjusted, result);
      return { marketplace: mp, result, risk };
    })
    .sort((a, b) => b.result.monthly_net_profit - a.result.monthly_net_profit);

  const best = comparisons[0];

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h3 className="text-sm font-semibold">Pazaryeri Karsilastirmasi</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Ayni urunun farkli pazaryerlerindeki performansini karsilastirin.
      </p>

      <div className="mt-4 space-y-3">
        {comparisons.map((c) => {
          const isBest = c === best;
          return (
            <div
              key={c.marketplace.key}
              className={`rounded-xl border p-4 transition-colors ${isBest ? 'border-primary/50 bg-primary/5' : 'bg-muted/30'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{c.marketplace.label}</span>
                  {isBest && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <Star className="h-3 w-3" />
                      En Iyi
                    </span>
                  )}
                </div>
                <RiskBadge level={c.risk.level} />
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex justify-between sm:block">
                  <p className="text-xs text-muted-foreground">Birim Kar</p>
                  <p className={`font-semibold ${c.result.unit_net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(c.result.unit_net_profit)}
                  </p>
                </div>
                <div className="flex justify-between sm:block">
                  <p className="text-xs text-muted-foreground">Marj</p>
                  <p className="font-semibold">{formatPercent(c.result.margin_pct)}</p>
                </div>
                <div className="flex justify-between sm:block">
                  <p className="text-xs text-muted-foreground">Aylik Kar</p>
                  <p className={`font-semibold ${c.result.monthly_net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(c.result.monthly_net_profit)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span>Komisyon: %{c.marketplace.commission_pct}</span>
                <span>Iade: %{c.marketplace.return_rate_pct}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
