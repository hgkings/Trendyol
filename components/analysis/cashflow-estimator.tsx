'use client';

import { ProductInput } from '@/types';
import { calculateCashflow } from '@/utils/calculations';
import { formatCurrency } from '@/components/shared/format';
import { Wallet, TrendingDown, Clock } from 'lucide-react';

interface CashflowEstimatorProps {
  input: ProductInput;
}

export function CashflowEstimator({ input }: CashflowEstimatorProps) {
  const cf = calculateCashflow(input);

  const items = [
    {
      label: 'Gerekli Isletme Sermayesi',
      value: cf.workingCapitalNeeded,
      icon: Wallet,
      desc: `${input.payout_delay_days} gunluk odeme gecikmesi icin gerekli sermaye`,
    },
    {
      label: 'Aylik Nakit Acigi',
      value: cf.monthlyCashGap,
      icon: TrendingDown,
      desc: 'Tahmini aylik nakit cikisi ve giris arasi fark',
    },
    {
      label: 'Gunluk Nakit Yakma',
      value: cf.dailyCashBurn,
      icon: Clock,
      desc: 'Gunluk ortalama maliyet cikisi',
    },
  ];

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-6">
      <h3 className="text-sm font-semibold">Nakit Akisi Tahmini</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Odeme gecikmeleri ve maliyetlere gore nakit akisi tahmini.
      </p>

      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-lg font-bold">{formatCurrency(item.value)}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
