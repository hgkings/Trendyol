// ----------------------------------------------------------------
// DB Katmani — Tip Tanimlari
// DATABASE-SCHEMA.md ile birebir eslesen satir tipleri.
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// Sifreleme
// ----------------------------------------------------------------

export interface EncryptedBlob {
  iv: string
  ciphertext: string
  tag: string
  version: number
}

// ----------------------------------------------------------------
// Sorgu Yardimcilari
// ----------------------------------------------------------------

export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ----------------------------------------------------------------
// Tablo Satir Tipleri (DATABASE-SCHEMA.md)
// ----------------------------------------------------------------

export interface ProfileRow {
  id: string
  email: string
  plan: string
  created_at: string | null
  plan_expires_at: string | null
  updated_at: string | null
  fixed_cost_monthly: number | null
  target_profit_monthly: number | null
  pro_until: string | null
  pro_expires_at: string | null
  pro_renewal: boolean | null
  pro_started_at: string | null
  email_notifications_enabled: boolean | null
  notification_email: string | null
  last_notification_sent_at: string | null
  is_pro: boolean | null
  plan_type: string | null
  full_name: string | null
  email_weekly_report: boolean | null
  email_risk_alert: boolean | null
  email_margin_alert: boolean | null
  email_pro_expiry: boolean | null
  target_margin: number | null
  margin_alert: boolean | null
  default_marketplace: string | null
  default_commission: number | null
  default_vat: number | null
  monthly_profit_target: number | null
  default_return_rate: number | null
  default_ads_cost: number | null
}

export interface AnalysisRow {
  id: string
  user_id: string
  marketplace: string
  product_name: string
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  risk_score: number
  risk_level: string
  created_at: string | null
  competitor_price: number | null
  competitor_name: string | null
  target_position: string | null
  merchant_sku: string | null
  barcode: string | null
  marketplace_source: string | null
  auto_synced: boolean | null
  auto_sales_qty: number | null
}

export interface NotificationRow {
  id: string
  user_id: string
  analysis_id: string | null
  product_id: string | null
  href: string | null
  type: string
  category: string
  title: string
  message: string
  is_read: boolean
  dedupe_key: string | null
  created_at: string
}

export interface PaymentRow {
  id: string
  user_id: string
  plan: string
  amount_try: number
  status: string
  provider: string
  provider_order_id: string
  provider_tx_id: string | null
  created_at: string
  paid_at: string | null
  raw_payload: Record<string, unknown> | null
  email: string | null
  currency: string | null
  token: string | null
  token_expires_at: string | null
}

export interface TicketRow {
  id: string
  user_id: string
  user_email: string | null
  subject: string
  category: string
  priority: string
  status: string
  message: string
  admin_reply: string | null
  admin_replied_at: string | null
  created_at: string
  updated_at: string
}

export interface EmailLogRow {
  id: string
  user_id: string | null
  to_email: string
  template: string
  subject: string
  status: string | null
  provider: string | null
  provider_message_id: string | null
  error: string | null
  created_at: string | null
}

export interface CommissionRateRow {
  id: string
  user_id: string
  marketplace: string
  category: string
  rate: number
  updated_at: string
}

export interface MarketplaceConnectionRow {
  id: string
  user_id: string
  marketplace: string
  status: string
  store_name: string | null
  seller_id: string | null
  last_sync_at: string | null
  webhook_active: boolean
  created_at: string
  updated_at: string
}

export interface MarketplaceSecretRow {
  id: string
  connection_id: string
  encrypted_blob: string
  key_version: number
  created_at: string
  updated_at: string
}

export interface MarketplaceSyncLogRow {
  id: string
  connection_id: string
  sync_type: string
  status: string
  message: string | null
  started_at: string
  finished_at: string | null
}

export interface BlogCommentRow {
  id: string
  post_slug: string
  author_name: string
  content: string
  created_at: string | null
  is_approved: boolean | null
}

export interface ProductMarketplaceMapRow {
  id: string
  user_id: string
  marketplace: string
  external_product_id: string
  merchant_sku: string | null
  barcode: string | null
  external_title: string | null
  internal_product_id: string | null
  match_confidence: string
  connection_id: string | null
  created_at: string
  updated_at: string
}

export interface ProductSalesMetricsRow {
  id: string
  user_id: string
  internal_product_id: string
  marketplace: string
  period_month: string
  sold_qty: number
  returned_qty: number
  gross_revenue: number
  net_revenue: number
  created_at: string
  updated_at: string
}
