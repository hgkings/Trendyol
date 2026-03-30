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
