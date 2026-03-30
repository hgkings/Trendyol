// ----------------------------------------------------------------
// CommissionRepository — Katman 8
// Tablo: commission_rates
// ----------------------------------------------------------------

import { BaseRepository } from './base.repository'
import type { CommissionRateRow } from '@/lib/db/types'

export class CommissionRepository extends BaseRepository<CommissionRateRow> {
  protected tableName = 'commission_rates'

  async getUserRates(userId: string, marketplace?: string): Promise<CommissionRateRow[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)

    if (marketplace) {
      query = query.eq('marketplace', marketplace)
    }

    const { data, error } = await query.order('category', { ascending: true })

    if (error) {
      throw new Error(`Komisyon oranlari getirilemedi: ${error.message}`)
    }

    return (data ?? []) as CommissionRateRow[]
  }

  async upsertRate(
    userId: string,
    marketplace: string,
    category: string,
    rate: number
  ): Promise<CommissionRateRow> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert(
        {
          user_id: userId,
          marketplace,
          category,
          rate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,marketplace,category' }
      )
      .select()
      .single()

    if (error) {
      throw new Error(`Komisyon orani guncellenemedi: ${error.message}`)
    }

    return data as CommissionRateRow
  }

  async deleteRate(userId: string, marketplace: string, category: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('user_id', userId)
      .eq('marketplace', marketplace)
      .eq('category', category)

    if (error) {
      throw new Error(`Komisyon orani silinemedi: ${error.message}`)
    }
  }

  async bulkUpsert(
    userId: string,
    rates: Array<{ marketplace: string; category: string; rate: number }>
  ): Promise<number> {
    const rows = rates.map(r => ({
      user_id: userId,
      marketplace: r.marketplace,
      category: r.category,
      rate: r.rate,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await this.supabase
      .from(this.tableName)
      .upsert(rows, { onConflict: 'user_id,marketplace,category' })

    if (error) {
      throw new Error(`Toplu komisyon import basarisiz: ${error.message}`)
    }

    return rows.length
  }
}
