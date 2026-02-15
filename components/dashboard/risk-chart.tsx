'use client';

import { Analysis } from '@/types';
import { riskLevelConfig } from '@/utils/risk-engine';
import type { RiskLevel } from '@/types';

interface RiskChartProps {
  analyses: Analysis[];
}

export function RiskChart({ analyses }: RiskChartProps) {
  const counts: Record<RiskLevel, number> = {
    safe: 0,
    moderate: 0,
    risky: 0,
    dangerous: 0,
  };

  analyses.forEach((a) => {
    counts[a.risk.level]++;
  });

  const total = analyses.length || 1;
  const levels: RiskLevel[] = ['safe', 'moderate', 'risky', 'dangerous'];

  return (
    <div className="h-full rounded-2xl border bg-card p-6 shadow-premium-sm transition-shadow hover:shadow-premium-md">
      <h3 className="text-base font-bold text-foreground mb-6">Risk Dağılımı</h3>
      <div className="space-y-5">
        {levels.map((level) => {
          const config = riskLevelConfig[level];
          const pct = (counts[level] / total) * 100;
          return (
            <div key={level} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium" style={{ color: config.color }}>
                  {config.label}
                </span>
                <span className="text-muted-foreground font-medium">
                  {counts[level]} ürün
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: config.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
