import { ProductInput, CalculationResult, RiskResult, RiskLevel, RiskFactor } from '@/types';
import { n } from './calculations';

export function calculateRisk(input: ProductInput, result: CalculationResult): RiskResult {
  console.debug('[Risk] Input:', input, 'Result:', result);
  const factors: RiskFactor[] = [];

  const margin_pct = n(result.margin_pct);
  const return_rate_pct = n(input.return_rate_pct);
  const sale_price = n(input.sale_price);
  const ad_cost_per_sale = n(input.ad_cost_per_sale);
  const commission_pct = n(input.commission_pct);

  // 4.1 Skor bileşenleri

  // Margin score (0–40)
  let marginScore = 0;
  if (margin_pct >= 20) {
    marginScore = 40;
  } else if (margin_pct >= 10) {
    marginScore = 20 + ((margin_pct - 10) / 10) * 20;
  } else if (margin_pct >= 0) {
    marginScore = (margin_pct / 10) * 20;
  }
  if (margin_pct < 10) {
    factors.push({
      name: 'Düşük Kar Marjı',
      impact: Math.round(40 - marginScore),
      description: `Kar marjı %${margin_pct.toFixed(1)} — ${margin_pct < 0 ? 'Zarar durumu' : 'Riskli seviye'}`,
    });
  }

  // Return score (0–20)
  let returnScore = 0;
  if (return_rate_pct <= 5) {
    returnScore = 20;
  } else if (return_rate_pct <= 15) {
    returnScore = 20 - ((return_rate_pct - 5) / 10) * 10;
  } else {
    returnScore = Math.max(0, 10 - ((return_rate_pct - 15) / 10) * 10);
  }
  if (return_rate_pct > 10) {
    factors.push({
      name: 'Yüksek İade Oranı',
      impact: Math.round(20 - returnScore),
      description: `İade oranı %${return_rate_pct} — Ortalamanın üzerinde iade maliyeti.`,
    });
  }

  // Ad dependency (0–20)
  const ad_ratio = sale_price > 0 ? (ad_cost_per_sale / sale_price) * 100 : 0;
  let adScore = 0;
  if (ad_ratio <= 3) {
    adScore = 20;
  } else if (ad_ratio <= 10) {
    adScore = 20 - ((ad_ratio - 3) / 7) * 10;
  } else {
    adScore = Math.max(0, 10 - ((ad_ratio - 10) / 10) * 10);
  }
  if (ad_ratio > 10) {
    factors.push({
      name: 'Reklam Bağımlılığı',
      impact: Math.round(20 - adScore),
      description: `Reklam/satış oranı %${ad_ratio.toFixed(1)} — Satışlarınız reklama çok bağımlı.`,
    });
  }

  // Commission score (0–20)
  let commissionScore = 0;
  if (commission_pct <= 12) {
    commissionScore = 20;
  } else if (commission_pct <= 20) {
    commissionScore = 20 - ((commission_pct - 12) / 8) * 10;
  } else {
    commissionScore = Math.max(0, 10 - ((commission_pct - 20) / 10) * 10);
  }
  if (commission_pct > 20) {
    factors.push({
      name: 'Yüksek Komisyon',
      impact: Math.round(20 - commissionScore),
      description: `Komisyon oranı %${commission_pct} — Pazaryeri kesintileri kârı eritiyor.`,
    });
  }

  const score = Math.round(marginScore + returnScore + adScore + commissionScore);
  const clampedScore = Math.max(0, Math.min(100, score));

  return {
    score: clampedScore,
    level: getLevel(clampedScore),
    factors,
  };
}

function getLevel(score: number): RiskLevel {
  // 4.2 Risk seviyesi
  if (score >= 80) return 'safe';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'risky';
  return 'dangerous';
}

export const riskLevelConfig: Record<RiskLevel, { label: string; color: string; bgColor: string; textColor: string }> = {
  safe: { label: 'Güvenli', color: '#10b981', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', textColor: 'text-emerald-700 dark:text-emerald-400' },
  moderate: { label: 'Orta', color: '#f59e0b', bgColor: 'bg-amber-100 dark:bg-amber-900/30', textColor: 'text-amber-700 dark:text-amber-400' },
  risky: { label: 'Riskli', color: '#f97316', bgColor: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-700 dark:text-orange-400' },
  dangerous: { label: 'Tehlikeli', color: '#ef4444', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-700 dark:text-red-400' },
};
