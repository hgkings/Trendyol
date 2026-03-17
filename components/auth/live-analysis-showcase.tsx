'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Scenario Data ────────────────────────────────────────────
interface Scenario {
  product: string;
  marketplace: string;
  marketplaceColor: string;
  sale: number;
  cost: number;
  netProfit: number;
  margin: number;
  riskLabel: string;
  riskColor: string;
  riskBg: string;
  barColor: string;
  barWidth: string;
  warning?: string;
}

const SCENARIOS: Scenario[] = [
  {
    product: 'Spor Ayakkabı',
    marketplace: 'Trendyol',
    marketplaceColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    sale: 649,
    cost: 412,
    netProfit: 89,
    margin: 13.7,
    riskLabel: 'Orta',
    riskColor: 'text-amber-600 dark:text-amber-400',
    riskBg: 'bg-amber-500/10',
    barColor: 'bg-amber-500',
    barWidth: 'w-[45%]',
  },
  {
    product: 'Bluetooth Kulaklık',
    marketplace: 'Hepsiburada',
    marketplaceColor: 'bg-red-500/10 text-red-600 dark:text-red-400',
    sale: 349,
    cost: 361,
    netProfit: -12,
    margin: -3.4,
    riskLabel: 'Kritik',
    riskColor: 'text-red-600 dark:text-red-400',
    riskBg: 'bg-red-500/10',
    barColor: 'bg-red-500',
    barWidth: 'w-[8%]',
    warning: '⚠️ Zarar!',
  },
  {
    product: 'Yoga Matı',
    marketplace: 'n11',
    marketplaceColor: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    sale: 289,
    cost: 168,
    netProfit: 62,
    margin: 21.4,
    riskLabel: 'Düşük',
    riskColor: 'text-emerald-600 dark:text-emerald-400',
    riskBg: 'bg-emerald-500/10',
    barColor: 'bg-emerald-500',
    barWidth: 'w-[72%]',
  },
  {
    product: 'USB-C Kablo',
    marketplace: 'Amazon TR',
    marketplaceColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    sale: 129,
    cost: 127,
    netProfit: 2,
    margin: 1.5,
    riskLabel: 'Yüksek',
    riskColor: 'text-orange-600 dark:text-orange-400',
    riskBg: 'bg-orange-500/10',
    barColor: 'bg-orange-500',
    barWidth: 'w-[12%]',
    warning: '⚠️ Başabaş!',
  },
];

// ─── useCountUp Hook ──────────────────────────────────────────
function useCountUp(target: number, duration = 800, trigger?: number) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = from + (target - from) * eased;
      setValue(Math.round(current));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, trigger]);

  return value;
}

// ─── AnimatedNumber Component ─────────────────────────────────
function AnimatedNumber({ value, trigger }: { value: number; trigger: number }) {
  const displayed = useCountUp(value, 800, trigger);
  return <>{displayed}</>;
}

// ─── Main Component ───────────────────────────────────────────
export function LiveAnalysisShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const rotate = useCallback(() => {
    // fade out
    setVisible(false);
    setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % SCENARIOS.length);
      // fade in
      setVisible(true);
    }, 400);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(rotate, 4000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [rotate]);

  if (!mounted) {
    // SSR placeholder — static first scenario
    return <StaticCard scenario={SCENARIOS[0]} />;
  }

  const s = SCENARIOS[activeIndex];
  const profitColor =
    s.netProfit > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : s.netProfit < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-amber-600 dark:text-amber-400';

  return (
    <div className="space-y-3">
      {/* Header: title + live indicator */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          📊 Gerçek Analiz Örnekleri
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] text-muted-foreground italic">Kârnet hesaplıyor...</span>
        </span>
      </div>

      {/* Animated Card */}
      <div className="rounded-xl border bg-card/80 backdrop-blur-sm p-5 shadow-sm space-y-3 relative overflow-hidden">
        {/* Risk badge — top right */}
        <div
          className={`absolute top-3 right-3 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'} ${s.riskBg} ${s.riskColor}`}
        >
          Risk: {s.riskLabel}
        </div>

        {/* Content with fade transition */}
        <div
          className={`transition-opacity duration-300 ease-in-out ${visible ? 'opacity-100' : 'opacity-0'}`}
        >
          {/* Marketplace badge + product name */}
          <div className="space-y-1.5 mb-3">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${s.marketplaceColor}`}
            >
              {s.marketplace}
            </span>
            <p className="text-sm font-bold">{s.product}</p>
          </div>

          {/* 3-column stats */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Satış</p>
              <p className="text-sm font-bold tabular-nums">
                ₺<AnimatedNumber value={s.sale} trigger={activeIndex} />
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Maliyet</p>
              <p className="text-sm font-bold tabular-nums">
                ₺<AnimatedNumber value={s.cost} trigger={activeIndex} />
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Net Kâr</p>
              <p className={`text-sm font-bold tabular-nums ${profitColor}`}>
                {s.netProfit < 0 ? '-' : ''}₺
                <AnimatedNumber value={Math.abs(s.netProfit)} trigger={activeIndex} />
                {s.warning && (
                  <span className="ml-1 text-[10px]">{s.warning}</span>
                )}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${s.barColor} ${s.barWidth}`}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right mt-1">
              Marj: %{s.margin}
            </p>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5">
        {SCENARIOS.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setVisible(false);
              setTimeout(() => {
                setActiveIndex(i);
                setVisible(true);
              }, 300);
              // reset timer
              if (timerRef.current) clearInterval(timerRef.current);
              timerRef.current = setInterval(rotate, 4000);
            }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIndex
                ? 'w-4 bg-primary'
                : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
            aria-label={`Senaryo ${i + 1}`}
          />
        ))}
      </div>

      {/* Social proof */}
      <div className="space-y-1.5 pt-1">
        {[
          { icon: '🔒', text: 'Kredi kartı gerekmez' },
          { icon: '👥', text: '500+ aktif satıcı kullanıyor' },
          { icon: '⭐', text: 'Ücretsiz plan sonsuza kadar ücretsiz' },
        ].map((item) => (
          <div key={item.text} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="text-xs">{item.icon}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SSR-safe static placeholder ──────────────────────────────
function StaticCard({ scenario: s }: { scenario: Scenario }) {
  const profitColor =
    s.netProfit > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : s.netProfit < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-amber-600 dark:text-amber-400';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          📊 Gerçek Analiz Örnekleri
        </span>
      </div>
      <div className="rounded-xl border bg-card/80 backdrop-blur-sm p-5 shadow-sm space-y-3 relative overflow-hidden">
        <div className={`absolute top-3 right-3 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${s.riskBg} ${s.riskColor}`}>
          Risk: {s.riskLabel}
        </div>
        <div className="space-y-1.5 mb-3">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${s.marketplaceColor}`}>{s.marketplace}</span>
          <p className="text-sm font-bold">{s.product}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><p className="text-[10px] text-muted-foreground">Satış</p><p className="text-sm font-bold tabular-nums">₺{s.sale}</p></div>
          <div><p className="text-[10px] text-muted-foreground">Maliyet</p><p className="text-sm font-bold tabular-nums">₺{s.cost}</p></div>
          <div><p className="text-[10px] text-muted-foreground">Net Kâr</p><p className={`text-sm font-bold tabular-nums ${profitColor}`}>{s.netProfit < 0 ? '-' : ''}₺{Math.abs(s.netProfit)}</p></div>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${s.barColor} ${s.barWidth}`} /></div>
        <p className="text-[10px] text-muted-foreground text-right">Marj: %{s.margin}</p>
      </div>
    </div>
  );
}
