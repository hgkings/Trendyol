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

  /**
   * Kullanicinin TUM verilerini siler (cascade).
   * Sira: bagli tablolar → profil → auth kullanici
   */
  async deleteAllUserData(userId: string): Promise<{ deletedTables: string[] }> {
    const deletedTables: string[] = []

    // 1. product_sales_metrics
    const { error: e1 } = await this.supabase
      .from('product_sales_metrics')
      .delete()
      .eq('user_id', userId)
    if (!e1) deletedTables.push('product_sales_metrics')

    // 2. product_marketplace_map
    const { error: e2 } = await this.supabase
      .from('product_marketplace_map')
      .delete()
      .eq('user_id', userId)
    if (!e2) deletedTables.push('product_marketplace_map')

    // 3. marketplace_sync_logs (connection_id uzerinden)
    const { data: connections } = await this.supabase
      .from('marketplace_connections')
      .select('id')
      .eq('user_id', userId)

    if (connections && connections.length > 0) {
      const connIds = connections.map(c => c.id)

      // marketplace_secrets
      const { error: e3 } = await this.supabase
        .from('marketplace_secrets')
        .delete()
        .in('connection_id', connIds)
      if (!e3) deletedTables.push('marketplace_secrets')

      // marketplace_sync_logs
      const { error: e4 } = await this.supabase
        .from('marketplace_sync_logs')
        .delete()
        .in('connection_id', connIds)
      if (!e4) deletedTables.push('marketplace_sync_logs')
    }

    // 4. marketplace_connections
    const { error: e5 } = await this.supabase
      .from('marketplace_connections')
      .delete()
      .eq('user_id', userId)
    if (!e5) deletedTables.push('marketplace_connections')

    // 5. notifications
    const { error: e6 } = await this.supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
    if (!e6) deletedTables.push('notifications')

    // 6. commission_rates
    const { error: e7 } = await this.supabase
      .from('commission_rates')
      .delete()
      .eq('user_id', userId)
    if (!e7) deletedTables.push('commission_rates')

    // 7. support_tickets
    const { error: e8 } = await this.supabase
      .from('support_tickets')
      .delete()
      .eq('user_id', userId)
    if (!e8) deletedTables.push('support_tickets')

    // 8. email_logs
    const { error: e9 } = await this.supabase
      .from('email_logs')
      .delete()
      .eq('user_id', userId)
    if (!e9) deletedTables.push('email_logs')

    // 9. analyses
    const { error: e10 } = await this.supabase
      .from('analyses')
      .delete()
      .eq('user_id', userId)
    if (!e10) deletedTables.push('analyses')

    // 10. payments
    const { error: e11 } = await this.supabase
      .from('payments')
      .delete()
      .eq('user_id', userId)
    if (!e11) deletedTables.push('payments')

    // 11. profiles
    const { error: e12 } = await this.supabase
      .from('profiles')
      .delete()
      .eq('id', userId)
    if (!e12) deletedTables.push('profiles')

    // 12. Supabase Auth kullanicisini sil
    const { error: authError } = await this.supabase.auth.admin.deleteUser(userId)
    if (!authError) deletedTables.push('auth.users')

    return { deletedTables }
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

  /**
   * Admin: Kullanicilari arar — email ilike + plan filtresi + sayfalama.
   * Birden fazla plan tipini gruplar (orn. 'pro' → pro, pro_monthly, pro_yearly).
   */
  async searchUsers(
    options: {
      search?: string
      planFilter?: string[]
      page?: number
      pageSize?: number
    }
  ): Promise<PaginatedResult<ProfileRow>> {
    const { search, planFilter, page = 1, pageSize = 20 } = options
    const offset = (page - 1) * pageSize

    // Count query
    let countQuery = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })

    if (search) {
      countQuery = countQuery.ilike('email', `%${search}%`)
    }
    if (planFilter && planFilter.length > 0) {
      countQuery = countQuery.in('plan', planFilter)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      throw new Error(`Admin kullanici arama sayisi basarisiz: ${countError.message}`)
    }

    // Data query
    let dataQuery = this.supabase
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (search) {
      dataQuery = dataQuery.ilike('email', `%${search}%`)
    }
    if (planFilter && planFilter.length > 0) {
      dataQuery = dataQuery.in('plan', planFilter)
    }

    const { data, error } = await dataQuery

    if (error) {
      throw new Error(`Admin kullanici araması basarisiz: ${error.message}`)
    }

    return {
      data: (data ?? []) as ProfileRow[],
      total: count ?? 0,
      page,
      pageSize,
    }
  }

  /**
   * Admin: Toplam kullanici sayisini plana gore sayar.
   */
  async countByPlan(plan: string[]): Promise<number> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .in('plan', plan)

    if (error) {
      throw new Error(`Plan bazli sayim basarisiz: ${error.message}`)
    }

    return count ?? 0
  }

  /**
   * Admin: Toplam kullanici sayisi.
   */
  async countAll(): Promise<number> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })

    if (error) {
      throw new Error(`Toplam kullanici sayimi basarisiz: ${error.message}`)
    }

    return count ?? 0
  }

  /**
   * Admin: Son kayit olan kullanicilari getirir.
   */
  async findRecent(limit: number = 10): Promise<ProfileRow[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Son kullanicilar getirilemedi: ${error.message}`)
    }

    return (data ?? []) as ProfileRow[]
  }

  /**
   * Admin: Baska tablolardan count alir (analyses, payments, support_tickets).
   */
  async countTable(tableName: string): Promise<number> {
    const { count, error } = await this.supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })

    if (error) {
      throw new Error(`${tableName} sayimi basarisiz: ${error.message}`)
    }

    return count ?? 0
  }

  /**
   * Admin: Toplam odeme gelirini hesaplar (status = 'paid').
   */
  async sumPaidPayments(): Promise<number> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('amount_try')
      .eq('status', 'paid')

    if (error) {
      throw new Error(`Odeme toplami basarisiz: ${error.message}`)
    }

    if (!data || data.length === 0) return 0
    return data.reduce((sum: number, row: { amount_try: number }) => sum + (row.amount_try ?? 0), 0)
  }
}
