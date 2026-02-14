import { ProductInput, CalculationResult } from '@/types';

export const n = (v: any, fallback = 0) => {
  if (v === null || v === undefined) return fallback;
  const num = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(num) ? num : fallback;
};

export function calculateProfit(input: ProductInput): CalculationResult {
  const sale_price = n(input.sale_price);
  const product_cost = n(input.product_cost);
  const commission_pct = n(input.commission_pct);
  const shipping_cost = n(input.shipping_cost);
  const packaging_cost = n(input.packaging_cost);
  const ad_cost_per_sale = n(input.ad_cost_per_sale);
  const return_rate_pct = n(input.return_rate_pct);
  const vat_pct = n(input.vat_pct);
  const other_cost = n(input.other_cost);
  const monthly_sales_volume = n(input.monthly_sales_volume);

  // 1.1 Komisyon
  const commission_amount = sale_price * (commission_pct / 100);

  // 1.2 KDV etkisi (Satiş fiyatı KDV dahil kabul edilerek)
  let vat_amount = 0;
  if (sale_price > 0 && vat_pct > 0) {
    const calc = sale_price - (sale_price / (1 + vat_pct / 100));
    vat_amount = Number.isFinite(calc) ? calc : 0;
  }

  // 1.3 İade kaybı
  const expected_return_loss = (return_rate_pct / 100) * sale_price;

  // 1.4 Birim değişken gider toplamı
  const unit_variable_cost = product_cost + shipping_cost + packaging_cost + ad_cost_per_sale + other_cost;

  // 1.5 Birim toplam maliyet
  const unit_total_cost = unit_variable_cost + commission_amount + vat_amount + expected_return_loss;

  // 1.6 Birim net kâr
  const unit_net_profit = sale_price - unit_total_cost;

  // 1.7 Net kâr marjı
  const margin_pct = sale_price > 0 ? (unit_net_profit / sale_price) * 100 : 0;

  // 2.1 Aylık net kâr
  const monthly_net_profit = unit_net_profit * monthly_sales_volume;

  // 2.2 Aylık ciro
  const monthly_revenue = sale_price * monthly_sales_volume;

  // 2.3 Aylık toplam maliyet
  const monthly_total_cost = unit_total_cost * monthly_sales_volume;

  // 3.1 Başabaş fiyat
  const breakeven_price = calculateBreakevenPrice(input);

  return {
    commission_amount,
    vat_amount,
    expected_return_loss,
    unit_variable_cost,
    unit_total_cost,
    unit_net_profit,
    margin_pct,
    monthly_net_profit,
    monthly_revenue,
    monthly_total_cost,
    breakeven_price,
  };
}

export function calculateBreakevenPrice(input: ProductInput): number {
  const product_cost = n(input.product_cost);
  const shipping_cost = n(input.shipping_cost);
  const packaging_cost = n(input.packaging_cost);
  const ad_cost_per_sale = n(input.ad_cost_per_sale);
  const other_cost = n(input.other_cost);
  const commission_pct = n(input.commission_pct);
  const vat_pct = n(input.vat_pct);
  const return_rate_pct = n(input.return_rate_pct);

  const base_cost = product_cost + shipping_cost + packaging_cost + ad_cost_per_sale + other_cost;

  // KDV dahil mantığına göre paydadaki vergi çarpanı: 1 / (1 + KDV/100)
  const vat_factor = 1 / (1 + vat_pct / 100);
  const commission_factor = commission_pct / 100;
  const return_factor = return_rate_pct / 100;

  const denominator = vat_factor - commission_factor - return_factor;

  if (denominator <= 0) return Infinity;

  return base_cost / denominator;
}

export function calculateWithOverrides(
  base: ProductInput,
  overrides: Partial<ProductInput>
): CalculationResult {
  return calculateProfit({ ...base, ...overrides });
}

export function calculateRequiredPrice(
  input: ProductInput,
  type: 'margin' | 'profit',
  value: number
): number {
  const product_cost = n(input.product_cost);
  const shipping_cost = n(input.shipping_cost);
  const packaging_cost = n(input.packaging_cost);
  const ad_cost_per_sale = n(input.ad_cost_per_sale);
  const other_cost = n(input.other_cost);
  const commission_pct = n(input.commission_pct);
  const vat_pct = n(input.vat_pct);
  const return_rate_pct = n(input.return_rate_pct);

  const base_cost = product_cost + shipping_cost + packaging_cost + ad_cost_per_sale + other_cost;
  const vat_factor = 1 / (1 + vat_pct / 100);
  const commission_factor = commission_pct / 100;
  const return_factor = return_rate_pct / 100;

  if (type === 'margin') {
    const target_margin_rate = value / 100;
    const denominator = vat_factor - commission_factor - return_factor - target_margin_rate;
    if (denominator <= 0) return 0;
    return base_cost / denominator;
  } else {
    // Target net profit per unit
    const denominator = vat_factor - commission_factor - return_factor;
    if (denominator <= 0) return 0;
    return (value + base_cost) / denominator;
  }
}

export function generateSensitivityAnalysis(input: ProductInput) {
  const original = calculateProfit(input);

  const scenarios: { scenario: string; overrides: Partial<ProductInput> }[] = [
    { scenario: 'Fiyat +5%', overrides: { sale_price: input.sale_price * 1.05 } },
    { scenario: 'Fiyat +10%', overrides: { sale_price: input.sale_price * 1.10 } },
    { scenario: 'Fiyat -5%', overrides: { sale_price: input.sale_price * 0.95 } },
    { scenario: 'Fiyat -10%', overrides: { sale_price: input.sale_price * 0.90 } },
    { scenario: 'Komisyon +2%', overrides: { commission_pct: input.commission_pct + 2 } },
    { scenario: 'Komisyon -2%', overrides: { commission_pct: Math.max(0, input.commission_pct - 2) } },
    { scenario: 'Reklam maliyeti +5₺', overrides: { ad_cost_per_sale: input.ad_cost_per_sale + 5 } },
    { scenario: 'Reklam maliyeti +10₺', overrides: { ad_cost_per_sale: input.ad_cost_per_sale + 10 } },
    { scenario: 'İade oranı 2x', overrides: { return_rate_pct: Math.min(100, input.return_rate_pct * 2) } },
    { scenario: 'Satış hacmi +20%', overrides: { monthly_sales_volume: Math.round(input.monthly_sales_volume * 1.2) } },
  ];

  return scenarios.map(({ scenario, overrides }) => {
    const result = calculateWithOverrides(input, overrides);
    const diff = result.monthly_net_profit - original.monthly_net_profit;
    return {
      scenario,
      originalProfit: original.monthly_net_profit,
      newProfit: result.monthly_net_profit,
      difference: diff,
      percentChange: original.monthly_net_profit !== 0
        ? (diff / Math.abs(original.monthly_net_profit)) * 100
        : 0,
    };
  });
}

export function calculateCashflow(input: ProductInput) {
  const unitCost = input.product_cost + input.shipping_cost + input.packaging_cost + input.other_cost;
  const monthlyOutflow = unitCost * input.monthly_sales_volume;
  const dailyOutflow = monthlyOutflow / 30;
  const workingCapitalNeeded = dailyOutflow * input.payout_delay_days;
  const result = calculateProfit(input);
  const monthlyInflow = result.monthly_revenue - result.commission_amount - result.vat_amount;
  const monthlyCashGap = monthlyOutflow - (monthlyInflow * (30 - input.payout_delay_days) / 30);

  return {
    workingCapitalNeeded: Math.max(0, workingCapitalNeeded),
    monthlyCashGap: Math.max(0, monthlyCashGap),
    dailyCashBurn: dailyOutflow,
  };
}
