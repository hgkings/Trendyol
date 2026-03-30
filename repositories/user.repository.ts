// ----------------------------------------------------------------
// UserRepository — Katman 8
// Tablo: profiles
// ----------------------------------------------------------------

import { BaseRepository } from './base.repository'
import type { ProfileRow, PaginatedResult } from '@/lib/db/types'

export class UserRepository extends BaseRepository<ProfileRow> {
  protected tableName = 'profiles'

  async findByPlan(plan: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<ProfileRow>> {
    return this.findPaginated({ plan }, page, pageSize, {
      orderBy: 'created_at',
      orderDirection: 'desc',
    })
  }

  async findExpiring(days: number): Promise<ProfileRow[]> {
    const now = new Date()
    const target = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    const dayStart = target.toISOString().split('T')[0] + 'T00:00:00.000Z'
    const dayEnd = target.toISOString().split('T')[0] + 'T23:59:59.999Z'

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .gte('pro_expires_at', dayStart)
      .lte('pro_expires_at', dayEnd)
      .eq('is_pro', true)

    if (error) {
      throw new Error(`Suresi dolacak kullanicilar getirilemedi: ${error.message}`)
    }

    return (data ?? []) as ProfileRow[]
  }

  async findExpired(): Promise<ProfileRow[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .lt('pro_expires_at', new Date().toISOString())
      .eq('is_pro', true)

    if (error) {
      throw new Error(`Suresi dolmus kullanicilar getirilemedi: ${error.message}`)
    }

    return (data ?? []) as ProfileRow[]
  }

  async upsertProfile(data: Partial<ProfileRow> & { id: string }): Promise<ProfileRow> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .upsert(data, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      throw new Error(`Profil olusturulamadi/guncellenemedi: ${error.message}`)
    }

    return result as ProfileRow
  }

  async getProfilesByIds(ids: string[]): Promise<ProfileRow[]> {
    if (ids.length === 0) return []

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .in('id', ids)

    if (error) {
      throw new Error(`Profiller getirilemedi: ${error.message}`)
    }

    return (data ?? []) as ProfileRow[]
  }

  async updateEmailPreferences(
    userId: string,
    prefs: {
      email_notifications_enabled?: boolean
      email_weekly_report?: boolean
      email_risk_alert?: boolean
      email_margin_alert?: boolean
      email_pro_expiry?: boolean
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update(prefs)
      .eq('id', userId)

    if (error) {
      throw new Error(`Email tercihleri guncellenemedi: ${error.message}`)
    }
  }

  async searchByEmail(email: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<ProfileRow>> {
    const offset = (page - 1) * pageSize

    const { count, error: countError } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .ilike('email', `%${email}%`)

    if (countError) {
      throw new Error(`Kullanici arama sayisi basarisiz: ${countError.message}`)
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .ilike('email', `%${email}%`)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(`Kullanici araması basarisiz: ${error.message}`)
    }

    return {
      data: (data ?? []) as ProfileRow[],
      total: count ?? 0,
      page,
      pageSize,
    }
  }
}
