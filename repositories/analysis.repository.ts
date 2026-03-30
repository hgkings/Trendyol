// ----------------------------------------------------------------
// AnalysisRepository — Katman 8
// Tablo: analyses
// JSONB alanlar: inputs, outputs
// ----------------------------------------------------------------

import { BaseRepository } from './base.repository'
import type { AnalysisRow } from '@/lib/db/types'

export class AnalysisRepository extends BaseRepository<AnalysisRow> {
  protected tableName = 'analyses'

  async findByUserId(userId: string): Promise<AnalysisRow[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Analizler getirilemedi: ${error.message}`)
    }

    return (data ?? []) as AnalysisRow[]
  }

  async countByUserId(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Analiz sayisi getirilemedi: ${error.message}`)
    }

    return count ?? 0
  }

  async deleteByUserIdAndId(id: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Analiz silinemedi: ${error.message}`)
    }
  }

  async upsertRow(data: Partial<AnalysisRow> & { id: string; user_id: string }): Promise<AnalysisRow> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .upsert(data, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      throw new Error(`Analiz kaydedilemedi: ${error.message}`)
    }

    return result as AnalysisRow
  }

  async findByIdAndUserId(id: string, userId: string): Promise<AnalysisRow | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Analiz getirilemedi: ${error.message}`)
    }

    return data as AnalysisRow
  }
}
