import { ProductInput, CalculationResult } from '@/types';

export const n = (v: any, fallback = 0) => {
  if (v === null || v === undefined) return fallback;
  const num = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(num) ? num : fallback;
};

export function calculateProfit(input: ProductInput): CalculationResult {
  console.debug('[Calculation] Input:', input);
  const sale_price = n(input.sale_price);
  const product_cost = n(input.product_cost);
  const commission_pct = n(input.commission_pct);
  const shipping_cost = n(input.shipping_cost);
  const packaging_cost = n(input.packaging_cost);
  const ad_cost_per_sale = n(input.ad_cost_per_sale);
  const return_rate_pct = n(input.return_rate_pct);
  const vat_pct = n(input.vat_pct, 20); // Default VAT 20% if missing
  const other_cost = n(input.other_cost);
  const monthly_sales_volume = n(input.monthly_sales_volume);

  // 1.1 Komisyon
  const commission_amount = sale_price * (commission_pct / 100);

  // 1.2 KDV etkisi (Satiş fiyatı KDV dahil kabul edilerek)
  let vat_amount = 0;
  let sale_price_excl_vat = sale_price;

  if (vat_pct > 0) {
    const vatRate = vat_pct / 100;
    const calcExcl = sale_price / (1 + vatRate);
    sale_price_excl_vat = Number.isFinite(calcExcl) ? calcExcl : 0;

    const calcVat = sale_price - sale_price_excl_vat;
    vat_amount = Number.isFinite(calcVat) ? calcVat : 0;
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
    sale_price,
    sale_price_excl_vat,
    // PRO-specific fields default to 0 in standard mode
    output_vat_monthly: 0,
    input_vat_monthly: 0,
    vat_position_monthly: 0,
    monthly_net_sales: 0,
  };
}

export function calculateBreakevenPrice(input: ProductInput): number {
  const product_cost = n(input.product_cost);
  const shipping_cost = n(input.shipping_cost);
  const packaging_cost = n(input.packaging_cost);
  const ad_cost_per_sale = n(input.ad_cost_per_sale);
  const other_cost = n(input.other_cost);
  const commission_pct = n(input.commission_pct);
  const vat_pct = n(input.vat_pct, 20);
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
  const vat_pct = n(input.vat_pct, 20);
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

// ... existing code ...

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

export function calculateAdCeiling(input: ProductInput): number {
  // 1. Create a copy of input with 0 ad cost
  const tempInput = { ...input, ad_cost_per_sale: 0 };

  // 2. Calculate profit with 0 ads
  const result = calculateProfit(tempInput);

  // 3. The ceiling is exactly the Net Profit (Ads=0).
  // Why? Profit = Revenue - Costs.
  // Costs = Fixed + Variable(no_ads) + AdCost.
  // Profit = [Revenue - Fixed - Variable(no_ads)] - AdCost.
  // Profit = Profit(Ads=0) - AdCost.
  // To reach BreakEven (Profit=0): 0 = Profit(Ads=0) - AdCost => AdCost = Profit(Ads=0).

  // Safety: If Profit(Ads=0) is negative, then even 0 ads result in loss.
  // In that case, ceiling is effectively 0 (or negative to indicate impossibility).
  return Math.max(0, result.unit_net_profit);
}
