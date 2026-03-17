'use client';

import { ProductInput } from '@/types';
import { calculateRequiredPrice } from '@/utils/calculations';
import { formatCurrency } from '@/components/shared/format';
import { getMarketplaceLabel } from '@/lib/marketplace-data';
import { Info } from 'lucide-react';

interface MinPriceCardsProps {
  input: ProductInput;
  currentPrice: number;
}

interface PriceCard {
  label: string;
  sublabel: string;
  marginPct: number;
  price: number;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  emoji: string;
  tooltipText: string;
}

export function MinPriceCards({ input, currentPrice }: MinPriceCardsProps) {
  const mpLabel = getMarketplaceLabel(input.marketplace);

  const breakeven = calculateRequiredPrice(input, 'margin', 0);
  const price15   = calculateRequiredPrice(input, 'margin', 15);
  const price30   = calculateRequiredPrice(input, 'margin', 30);

  const isInfinity = (v: number) => !isFinite(v) || v <= 0;

  const cards: PriceCard[] = [
    {
      label: 'Başabaş',
      sublabel: 'Sıfır kâr noktası',
      marginPct: 0,
      price: breakeven,
      emoji: '🔴',
      colorClass: 'text-red-600 dark:text-red-400',
      borderClass: 'border-red-200 dark:border-red-900/40',
      bgClass: 'bg-red-50 dark:bg-red-900/10',
      textClass: 'text-red-700 dark:text-red-400',
      tooltipText:
        `Bu fiyat; ürün maliyeti, kargo, paketleme, reklam, ${mpLabel} komisyonu, ` +
        `servis bedeli ve beklenen iade maliyeti dahil edilerek hesaplanan sıfır kâr noktasıdır. ` +
        `Bu fiyatın altında satış yapmak zarara yol açar.`,
    },
    {
      label: '%15 Kâr',
      sublabel: 'Makul kâr marjı',
      marginPct: 15,
      price: price15,
      emoji: '🟡',
      colorClass: 'text-amber-600 dark:text-amber-400',
      borderClass: 'border-amber-200 dark:border-amber-900/40',
      bgClass: 'bg-amber-50 dark:bg-amber-900/10',
      textClass: 'text-amber-700 dark:text-amber-400',
      tooltipText:
        `Net kâr ÷ Satış Fiyatı = %15 olacak şekilde hesaplanmıştır. ` +
        `Tüm maliyet kalemleri ve ${mpLabel}'a özgü kesintiler dahildir.`,
    },
    {
      label: '%30 Kâr',
      sublabel: 'Hedef kâr marjı',
      marginPct: 30,
      price: price30,
      emoji: '🟢',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      borderClass: 'border-emerald-200 dark:border-emerald-900/40',
      bgClass: 'bg-emerald-50 dark:bg-emerald-900/10',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      tooltipText:
        `Net kâr ÷ Satış Fiyatı = %30 olacak şekilde hesaplanmıştır. ` +
        `Tüm maliyet kalemleri ve ${mpLabel}'a özgü kesintiler dahildir.`,
    },
  ];

  // Which card is "active" — reflects where the user's current price falls
  const activeIndex =
    currentPrice >= price30   ? 3 :  // above all targets
    currentPrice >= price15   ? 2 :  // between 15% and 30%
    currentPrice >= breakeven ? 1 :  // between breakeven and 15%
    0;                               // below breakeven (loss zone)

  // Status bar config
  type StatusConfig = { icon: string; msg: string; cls: string };
  const statusConfig: StatusConfig = (() => {
    if (isInfinity(breakeven)) {
      return { icon: '⚠️', msg: 'Mevcut maliyet yapısıyla başabaş fiyatı hesaplanamıyor. Komisyon + iade oranını kontrol edin.', cls: 'border-red-200 bg-red-50 text-red-700 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400' };
    }
    if (currentPrice < breakeven) {
      return { icon: '🔴', msg: `Mevcut fiyatınız zarar ettiriyor! En az ${formatCurrency(breakeven)}'a satmalısınız.`, cls: 'border-red-200 bg-red-50 text-red-700 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400' };
    }
    if (currentPrice < price15) {
      return { icon: '🟡', msg: `Kârınız çok düşük. %15 kâr için ${formatCurrency(price15)} olmalı.`, cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/10 dark:border-amber-900/30 dark:text-amber-400' };
    }
    if (currentPrice < price30) {
      return { icon: '🟢', msg: `Makul kâr aralığındasınız. %30 için ${formatCurrency(price30)}'a yükseltebilirsiniz.`, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400' };
    }
    return { icon: '✅', msg: 'Hedef kâr marjını karşılıyorsunuz! Tebrikler.', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400' };
  })();

  return (
    <div className="space-y-4">
      {/* Header note */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Minimum Kârlı Satış Fiyatı
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {mpLabel} komisyon, servis bedeli ve iade maliyetleri dahil
        </span>
      </div>

      {/* 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((card, idx) => {
          const isActive = idx + 1 === activeIndex || (idx === 0 && activeIndex === 0);
          const isCurrentActive = activeIndex === idx + 1 || (activeIndex === 0 && idx === 0);

          return (
            <div
              key={card.label}
              className={`rounded-xl border p-4 transition-all ${card.borderClass} ${card.bgClass} ${
                isCurrentActive ? 'ring-2 ring-offset-1 ring-current shadow-md' : 'shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">{card.emoji}</span>
                  <span className={`text-xs font-bold uppercase tracking-wide ${card.textClass}`}>
                    {card.label}
                  </span>
                </div>
                <span
                  title={card.tooltipText}
                  className={`cursor-help ${card.textClass} opacity-60 hover:opacity-100 transition-opacity`}
                >
                  <Info className="h-3.5 w-3.5" />
                </span>
              </div>

              {isInfinity(card.price) ? (
                <p className={`text-base font-bold ${card.colorClass}`}>Hesaplanamaz</p>
              ) : (
                <p className={`text-xl font-black ${card.colorClass}`}>
                  {formatCurrency(card.price)}
                </p>
              )}

              <p className={`text-[11px] mt-1 ${card.textClass} opacity-70`}>
                {card.sublabel}
              </p>
            </div>
          );
        })}
      </div>

      {/* Status bar */}
      <div className={`rounded-lg border p-3 text-xs font-medium ${statusConfig.cls}`}>
        {statusConfig.icon} {statusConfig.msg}
      </div>
    </div>
  );
}
