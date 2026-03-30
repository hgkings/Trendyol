// ----------------------------------------------------------------
// ProductRepository — Katman 8
// Tablolar: product_marketplace_map, product_sales_metrics
// ----------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProductMarketplaceMapRow, ProductSalesMetricsRow } from '@/lib/db/types'

export class ProductRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  // ---- product_marketplace_map ----

  async getMapByUserId(userId: string, marketplace?: string): Promise<ProductMarketplaceMapRow[]> {
    let query = this.supabase
      .from('product_marketplace_map')
      .select('*')
      .eq('user_id', userId)

    if (marketplace) {
      query = query.eq('marketplace', marketplace)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Urun eslestirme getirilemedi: ${error.message}`)
    }

    return (data ?? []) as ProductMarketplaceMapRow[]
  }

  async upsertMap(data: {
    user_id: string
    marketplace: string
    external_product_id: string
    merchant_sku?: string
    barcode?: string
    external_title?: string
    internal_product_id?: string
    match_confidence: string
    connection_id?: string
  }): Promise<ProductMarketplaceMapRow> {
    const { data: result, error } = await this.supabase
      .from('product_marketplace_map')
      .upsert(data, {
        onConflict: 'user_id,marketplace,external_product_id',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Urun eslestirme guncellenemedi: ${error.message}`)
    }

    return result as ProductMarketplaceMapRow
  }

  async getMapById(userId: string, mapId: string): Promise<ProductMarketplaceMapRow | null> {
    const { data, error } = await this.supabase
      .from('product_marketplace_map')
      .select('*')
      .eq('id', mapId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Urun eslestirme getirilemedi: ${error.message}`)
    }

    return data as ProductMarketplaceMapRow
  }

  async deleteMap(userId: string, mapId: string): Promise<void> {
    const { error } = await this.supabase
      .from('product_marketplace_map')
      .delete()
      .eq('id', mapId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Urun eslestirme silinemedi: ${error.message}`)
    }
  }

  async updateMap(
    userId: string,
    mapId: string,
    data: Partial<Omit<ProductMarketplaceMapRow, 'id' | 'user_id' | 'created_at'>>
  ): Promise<ProductMarketplaceMapRow> {
    const { data: result, error } = await this.supabase
      .from('product_marketplace_map')
      .update(data)
      .eq('id', mapId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      throw new Error(`Urun eslestirme guncellenemedi: ${error.message}`)
    }

    return result as ProductMarketplaceMapRow
  }

  // ---- product_sales_metrics ----

  async getSalesMetrics(
    userId: string,
    productId?: string,
    periodMonth?: string
  ): Promise<ProductSalesMetricsRow[]> {
    let query = this.supabase
      .from('product_sales_metrics')
      .select('*')
      .eq('user_id', userId)

    if (productId) {
      query = query.eq('internal_product_id', productId)
    }

    if (periodMonth) {
      query = query.eq('period_month', periodMonth)
    }

    const { data, error } = await query.order('period_month', { ascending: false })

    if (error) {
      throw new Error(`Satis metrikleri getirilemedi: ${error.message}`)
    }

    return (data ?? []) as ProductSalesMetricsRow[]
  }

  async upsertSalesMetrics(data: {
    user_id: string
    internal_product_id: string
    marketplace: string
    period_month: string
    sold_qty: number
    returned_qty: number
    gross_revenue: number
    net_revenue: number
  }): Promise<ProductSalesMetricsRow> {
    const { data: result, error } = await this.supabase
      .from('product_sales_metrics')
      .upsert(data, {
        onConflict: 'user_id,internal_product_id,marketplace,period_month',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Satis metrigi guncellenemedi: ${error.message}`)
    }

    return result as ProductSalesMetricsRow
  }
}
