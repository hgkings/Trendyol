// ----------------------------------------------------------------
// NotificationRepository — Katman 8
// Tablo: notifications
// Pagination YOK — max 50 kayit (KNOWLEDGE-BASE.md).
// ----------------------------------------------------------------

import { BaseRepository } from './base.repository'
import type { NotificationRow } from '@/lib/db/types'

export class NotificationRepository extends BaseRepository<NotificationRow> {
  protected tableName = 'notifications'

  async getByUserId(
    userId: string,
    options: { limit?: number; isRead?: boolean } = {}
  ): Promise<NotificationRow[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(options.limit ?? 50)

    if (options.isRead !== undefined) {
      query = query.eq('is_read', options.isRead)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Bildirimler getirilemedi: ${error.message}`)
    }

    return (data ?? []) as NotificationRow[]
  }

  async upsert(notification: Partial<NotificationRow>): Promise<NotificationRow> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert(notification, {
        onConflict: 'user_id,dedupe_key',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Bildirim olusturulamadi: ${error.message}`)
    }

    return data as NotificationRow
  }

  async markAsRead(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ is_read: true })
      .eq('id', id)

    if (error) {
      throw new Error(`Bildirim okundu isaretlenemedi: ${error.message}`)
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      throw new Error(`Bildirimler okundu isaretlenemedi: ${error.message}`)
    }
  }

  async getLastRiskAlertTime(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('created_at')
      .eq('user_id', userId)
      .eq('category', 'risk_alert')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Son risk alert zamani getirilemedi: ${error.message}`)
    }

    return (data as NotificationRow | null)?.created_at ?? null
  }
}
