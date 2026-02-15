export type Marketplace = 'trendyol' | 'hepsiburada' | 'n11' | 'amazon_tr' | 'custom';
export type PlanType = 'free' | 'pro';
export type RiskLevel = 'safe' | 'moderate' | 'risky' | 'dangerous';

export interface User {
  id: string;
  email: string;
  plan: PlanType;
  email_alerts_enabled?: boolean;
  email_notifications_enabled?: boolean;
}

export type AlertType = 'danger' | 'warning' | 'info';

export interface Notification {
  id: string;
  user_id: string;
  analysis_id?: string;
  product_id?: string;
  href?: string;
  type: AlertType;
  category: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  dedupe_key?: string;
}

export interface ProductInput {
  marketplace: Marketplace;
  product_name: string;
  monthly_sales_volume: number;
  product_cost: number;
  sale_price: number;
  commission_pct: number;
  shipping_cost: number;
  packaging_cost: number;
  ad_cost_per_sale: number;
  return_rate_pct: number;
  vat_pct?: number; // defaults to 20 via n() fallback in calculators
  other_cost: number;
  payout_delay_days: number;
  competitor_price?: number;
  competitor_name?: string;
  target_position?: 'cheaper' | 'same' | 'premium';

  // Granular PRO Mode Fields
  pro_mode?: boolean;
  sale_price_includes_vat?: boolean;
  sale_vat_pct?: number;
  product_cost_includes_vat?: boolean;
  purchase_vat_pct?: number;
  marketplace_fee_vat_pct?: number;

  shipping_includes_vat?: boolean;
  shipping_vat_pct?: number;
  packaging_includes_vat?: boolean;
  packaging_vat_pct?: number;
  ad_includes_vat?: boolean;
  ad_vat_pct?: number;
  other_cost_includes_vat?: boolean;
  other_cost_vat_pct?: number;

  return_refunds_commission?: boolean;
  return_extra_cost?: number;

  // Legacy/Standard fields keep compatibility
  accounting_mode?: 'standard' | 'pro';
  income_tax_pct?: number;
}

export interface CalculationResult {
  commission_amount: number;
  vat_amount: number; // Unit Output VAT
  expected_return_loss: number;
  unit_variable_cost: number;
  unit_total_cost: number;
  unit_net_profit: number;
  margin_pct: number;
  monthly_net_profit: number;
  monthly_revenue: number;
  monthly_total_cost: number;
  breakeven_price: number;
  sale_price: number; // Added for consistency
  sale_price_excl_vat: number;

  // PRO specific results
  output_vat_monthly: number;
  input_vat_monthly: number;
  vat_position_monthly: number;
  monthly_net_sales: number;
}

export interface RiskFactor {
  name: string;
  impact: number;
  description: string;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
}

export interface Analysis {
  id: string;
  userId: string;
  input: ProductInput;
  result: CalculationResult;
  risk: RiskResult;
  createdAt: string;
}

export interface MarketplaceDefaults {
  key: Marketplace;
  label: string;
  commission_pct: number;
  return_rate_pct: number;
  vat_pct: number;
  payout_delay_days: number;
}
