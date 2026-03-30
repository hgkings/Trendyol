// ----------------------------------------------------------------
// PaymentRepository — Katman 8
// 🔒 KORUNAN DOSYA — Hilmi onayi olmadan degistirilemez.
// Tablo: payments + profiles (atomic update)
// ----------------------------------------------------------------

import { BaseRepository } from './base.repository'
import type { PaymentRow } from '@/lib/db/types'

export class PaymentRepository extends BaseRepository<PaymentRow> {
  protected tableName = 'payments'

  async findByUserId(userId: string): Promise<PaymentRow[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Odemeler getirilemedi: ${error.message}`)
    }

    return (data ?? []) as PaymentRow[]
  }

  /**
   * Yeni odeme kaydi olusturur.
   * Token: 96 hex karakter, 15 dk sureli.
   */
  async createPayment(data: {
    user_id: string
    plan: string
    amount_try: number
    provider_order_id: string
    token: string
    token_expires_at: string
    email: string | null
  }): Promise<PaymentRow> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert({
        ...data,
        status: 'created',
        provider: 'paytr',
        currency: 'TRY',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Odeme olusturulamadi: ${error.message}`)
    }

    return result as PaymentRow
  }

  /**
   * Token ile odeme bulur.
   */
  async findByToken(token: string): Promise<PaymentRow | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('token', token)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Odeme bulunamadi: ${error.message}`)
    }

    return data as PaymentRow
  }

  /**
   * PayTR provider_order_id ile odeme bulur.
   */
  async findByProviderOrderId(providerOrderId: string): Promise<PaymentRow | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('provider_order_id', providerOrderId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Odeme bulunamadi: ${error.message}`)
    }

    return data as PaymentRow
  }

  /**
   * Sayfalanmis odeme listesi — opsiyonel status filtresi.
   * Her odemenin user email bilgisini profiles tablosundan cekilir.
   */
  async findPaginatedWithProfiles(
    options: { status?: string; page?: number; limit?: number }
  ): Promise<{ payments: Record<string, unknown>[]; total: number; page: number; limit: number }> {
    const page = options.page ?? 1
    const limit = options.limit ?? 20
    const offset = (page - 1) * limit

    let countQuery = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })

    if (options.status) {
      countQuery = countQuery.eq('status', options.status)
    }

    const { count, error: countError } = await countQuery
    if (countError) {
      throw new Error(`Odeme sayisi alinamadi: ${countError.message}`)
    }

    let dataQuery = this.supabase
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (options.status) {
      dataQuery = dataQuery.eq('status', options.status)
    }

    const { data: payments, error: dataError } = await dataQuery
    if (dataError) {
      throw new Error(`Odemeler getirilemedi: ${dataError.message}`)
    }

    const rows = (payments ?? []) as Record<string, unknown>[]
    const userIds = Array.from(new Set(rows.map((p) => p.user_id as string)))

    let emailMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await this.supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)

      emailMap = Object.fromEntries(
        ((profiles ?? []) as { id: string; email: string }[]).map((p) => [p.id, p.email])
      )
    }

    const result = rows.map((p) => ({
      ...p,
      profiles: { email: emailMap[p.user_id as string] ?? null },
    }))

    return { payments: result, total: count ?? 0, page, limit }
  }

  /**
   * Odeme + profil ATOMIC gunceller.
   * v1 hata duzeltmesi: payments ve profiles ayni anda guncellenir.
   * Supabase transaction destegi olmadigi icin sirali guncelleme + rollback.
   */
  async updatePaymentAndProfile(
    paymentId: string,
    userId: string,
    paymentUpdate: {
      status: string
      paid_at: string
      provider_order_id: string
      raw_payload: Record<string, unknown>
    },
    profileUpdate: {
      plan: string
      is_pro: boolean
      plan_type: string
      pro_started_at: string
      pro_expires_at: string
      pro_renewal: boolean
    }
  ): Promise<void> {
    // Adim 1: Payment guncelle
    const { error: paymentError } = await this.supabase
      .from('payments')
      .update(paymentUpdate)
      .eq('id', paymentId)

    if (paymentError) {
      throw new Error(`Odeme guncellenemedi: ${paymentError.message}`)
    }

    // Adim 2: Profil guncelle
    const { error: profileError } = await this.supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId)

    if (profileError) {
      // Rollback: payment'i tekrar 'created' yap
      await this.supabase
        .from('payments')
        .update({ status: 'created', paid_at: null, raw_payload: null })
        .eq('id', paymentId)

      throw new Error(`Profil guncellenemedi (odeme geri alindi): ${profileError.message}`)
    }
  }
}
