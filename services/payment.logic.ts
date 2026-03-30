// ----------------------------------------------------------------
// PaymentLogic — Katman 6
// 🔒 KORUNAN DOSYA — Hilmi onayi olmadan degistirilemez.
// PayTR entegrasyonu: hash uretimi/dogrulama, token, plan yonetimi.
// KNOWLEDGE-BASE.md Section 5 ile birebir.
// ----------------------------------------------------------------

import { createHmac, randomBytes } from 'crypto'
import { ServiceError } from '@/lib/gateway/types'
import type { PaymentRepository } from '@/repositories/payment.repository'

// ----------------------------------------------------------------
// Sabitler
// ----------------------------------------------------------------

export interface PlanConfig {
  id: string
  name: string
  plan: string
  isPro: boolean
  amountTry: number
  durationDays: number
}

const PLANS: Record<string, PlanConfig> = {
  starter_monthly: {
    id: 'starter_monthly',
    name: 'Starter Aylık',
    plan: 'starter',
    isPro: false,
    amountTry: 399,
    durationDays: 30,
  },
  starter_yearly: {
    id: 'starter_yearly',
    name: 'Starter Yıllık',
    plan: 'starter',
    isPro: false,
    amountTry: 3990,
    durationDays: 365,
  },
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Pro Aylık',
    plan: 'pro',
    isPro: true,
    amountTry: 799,
    durationDays: 30,
  },
  pro_yearly: {
    id: 'pro_yearly',
    name: 'Pro Yıllık',
    plan: 'pro',
    isPro: true,
    amountTry: 7990,
    durationDays: 365,
  },
}

const TOKEN_EXPIRY_MINUTES = 15
const TOKEN_BYTES = 48 // 96 hex karakter

// ----------------------------------------------------------------
// Yardimcilar
// ----------------------------------------------------------------

function getMerchantId(): string {
  const v = process.env.PAYTR_MERCHANT_ID
  if (!v) throw new Error('PAYTR_MERCHANT_ID tanimlanmamis')
  return v
}

function getMerchantKey(): string {
  const v = process.env.PAYTR_MERCHANT_KEY
  if (!v) throw new Error('PAYTR_MERCHANT_KEY tanimlanmamis')
  return v
}

function getMerchantSalt(): string {
  const v = process.env.PAYTR_MERCHANT_SALT
  if (!v) throw new Error('PAYTR_MERCHANT_SALT tanimlanmamis')
  return v
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex')
}

function generateMerchantOid(): string {
  return `KNT-${Date.now()}-${randomBytes(4).toString('hex')}`
}

/**
 * PayTR callback hash dogrulama.
 * HMAC-SHA256(callback_id + merchant_oid + salt + status + total_amount, key) → base64
 */
function verifyCallbackHash(
  callbackId: string,
  merchantOid: string,
  status: string,
  totalAmount: string,
  receivedHash: string
): boolean {
  const data = callbackId + merchantOid + getMerchantSalt() + status + totalAmount
  const expectedHash = createHmac('sha256', getMerchantKey())
    .update(data)
    .digest('base64')
  return expectedHash === receivedHash
}

// ----------------------------------------------------------------
// Servis
// ----------------------------------------------------------------

export class PaymentLogic {
  constructor(private readonly paymentRepo: PaymentRepository) {}

  /**
   * Odeme olusturur — statik PayTR link dondurur.
   * Env'den plan bazli link okunur, DB'ye kayit olusturulur.
   */
  async createPayment(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ paymentId: string; paymentLink: string; merchantOid: string }> {
    const { planId, userEmail } = payload as { planId: string; userEmail: string }

    const planConfig = PLANS[planId]
    if (!planConfig) {
      throw new ServiceError('Geçersiz plan seçimi', {
        code: 'INVALID_PLAN',
        statusCode: 400,
        traceId,
      })
    }

    // Statik PayTR link'i env'den al
    const linkEnvMap: Record<string, string | undefined> = {
      starter_monthly: process.env.PAYTR_LINK_STARTER_MONTHLY,
      starter_yearly: process.env.PAYTR_LINK_STARTER_YEARLY,
      pro_monthly: process.env.PAYTR_LINK_PRO_MONTHLY,
      pro_yearly: process.env.PAYTR_LINK_PRO_YEARLY,
    }

    const paymentLink = linkEnvMap[planId]
    if (!paymentLink) {
      throw new ServiceError('Ödeme bağlantısı yapılandırılmamış. Lütfen yöneticiyle iletişime geçin.', {
        code: 'PAYMENT_LINK_NOT_CONFIGURED',
        statusCode: 500,
        traceId,
      })
    }

    const token = generateToken()
    const merchantOid = generateMerchantOid()
    const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString()

    // DB'ye odeme kaydi olustur
    const payment = await this.paymentRepo.createPayment({
      user_id: userId,
      plan: planConfig.id,
      amount_try: planConfig.amountTry,
      provider_order_id: merchantOid,
      token,
      token_expires_at: tokenExpiresAt,
      email: userEmail,
    })

    return {
      paymentId: payment.id,
      paymentLink,
      merchantOid,
    }
  }

  /**
   * PayTR callback isler — hash dogrula, atomic DB update.
   * Idempotent: ayni provider_order_id icin tekrar cagrilirsa atlar.
   */
  async handleCallback(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ processed: boolean }> {
    const body = payload as Record<string, string>

    const merchantOid = body.merchant_oid ?? ''
    const status = body.status ?? ''
    const totalAmount = body.total_amount ?? ''
    const hash = body.hash ?? ''
    const callbackId = body.callback_id ?? body.id ?? ''

    // Hash dogrulama — KRITIK
    if (!verifyCallbackHash(callbackId, merchantOid, status, totalAmount, hash)) {
      throw new ServiceError('Hash dogrulama basarisiz', {
        code: 'INVALID_HASH',
        statusCode: 403,
        traceId,
      })
    }

    // Odemeyi bul
    const payment = await this.paymentRepo.findByProviderOrderId(merchantOid)
    if (!payment) {
      throw new ServiceError('Odeme bulunamadi', {
        code: 'PAYMENT_NOT_FOUND',
        statusCode: 404,
        traceId,
      })
    }

    // Idempotency: zaten islenmis mi?
    if (payment.status === 'paid') {
      return { processed: true }
    }

    // Basarisiz odeme
    if (status !== 'success') {
      await this.paymentRepo.update(payment.id, {
        status: 'failed',
        raw_payload: body as unknown as Record<string, unknown>,
      } as Partial<{ id: string; status: string; raw_payload: Record<string, unknown> }>)
      return { processed: true }
    }

    // Basarili odeme — plan hesapla
    const planConfig = PLANS[payment.plan]
    if (!planConfig) {
      throw new ServiceError('Gecersiz plan', {
        code: 'INVALID_PLAN_CONFIG',
        statusCode: 500,
        traceId,
      })
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + planConfig.durationDays * 24 * 60 * 60 * 1000)

    // ATOMIC guncelleme: payments + profiles
    await this.paymentRepo.updatePaymentAndProfile(
      payment.id,
      payment.user_id,
      {
        status: 'paid',
        paid_at: now.toISOString(),
        provider_order_id: merchantOid,
        raw_payload: body as unknown as Record<string, unknown>,
      },
      {
        plan: planConfig.plan,
        is_pro: planConfig.isPro,
        plan_type: planConfig.id,
        pro_started_at: now.toISOString(),
        pro_expires_at: expiresAt.toISOString(),
        pro_renewal: false,
      }
    )

    return { processed: true }
  }

  /**
   * Odeme dogrulama — UI tarafından polling.
   * Token + user_id eslesmeli, suresi gecmemis, status = 'paid'.
   */
  async verifyPayment(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ verified: boolean; plan?: string }> {
    const { token } = payload as { token: string }

    if (!token) {
      throw new ServiceError('Token zorunludur', {
        code: 'MISSING_TOKEN',
        statusCode: 400,
        traceId,
      })
    }

    const payment = await this.paymentRepo.findByToken(token)
    if (!payment) {
      return { verified: false }
    }

    // Token kullaniciya ait mi?
    if (payment.user_id !== userId) {
      return { verified: false }
    }

    // Token suresi gecmis mi?
    if (payment.token_expires_at && new Date(payment.token_expires_at) < new Date()) {
      return { verified: false }
    }

    // Odeme basarili mi?
    if (payment.status !== 'paid') {
      return { verified: false }
    }

    const planConfig = PLANS[payment.plan]
    return {
      verified: true,
      plan: planConfig?.name ?? payment.plan,
    }
  }

  /**
   * Pro tarihleri backfill eder.
   * Son basarili odeme kaydina gore pro_started_at ve pro_expires_at hesaplar.
   */
  async backfillProDates(
    traceId: string,
    _payload: unknown,
    userId: string
  ): Promise<{ proStartedAt: string; proExpiresAt: string }> {
    const payments = await this.paymentRepo.findByUserId(userId)
    const paidPayment = payments.find(p => p.status === 'paid')

    if (!paidPayment) {
      throw new ServiceError('Ödeme kaydı bulunamadı', {
        code: 'NO_PAYMENT_FOUND',
        statusCode: 404,
        traceId,
      })
    }

    const startedAt = paidPayment.paid_at ?? paidPayment.created_at
    const isYearly = paidPayment.plan === 'pro_yearly' || paidPayment.plan === 'starter_yearly'
    const durationDays = isYearly ? 365 : 30
    const expiresAt = new Date(new Date(startedAt).getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()

    return { proStartedAt: startedAt, proExpiresAt: expiresAt }
  }

  /**
   * Odeme durumunu kontrol eder (UI polling).
   */
  async checkPayment(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ isPro: boolean; paymentStatus: string }> {
    const { paymentId } = payload as { paymentId: string }

    if (!paymentId) {
      throw new ServiceError('paymentId gerekli', {
        code: 'MISSING_PAYMENT_ID',
        statusCode: 400,
        traceId,
      })
    }

    const payment = await this.paymentRepo.findById(paymentId)
    if (!payment) {
      throw new ServiceError('Ödeme bulunamadı', {
        code: 'PAYMENT_NOT_FOUND',
        statusCode: 404,
        traceId,
      })
    }

    return {
      isPro: payment.status === 'paid',
      paymentStatus: payment.status,
    }
  }

  /**
   * Test callback — sadece development ortami.
   * Son odeme kaydini 'paid' yapar ve profili Pro yapar.
   */
  async testCallback(
    traceId: string,
    _payload: unknown,
    _userId: string
  ): Promise<{ success: boolean; paymentId: string }> {
    if (process.env.NODE_ENV !== 'development') {
      throw new ServiceError('Sadece development ortamında kullanılabilir', {
        code: 'NOT_DEVELOPMENT',
        statusCode: 403,
        traceId,
      })
    }

    const payments = await this.paymentRepo.findMany({}, { orderBy: 'created_at', orderDirection: 'desc', limit: 1 })
    const payment = payments[0]

    if (!payment) {
      throw new ServiceError('Ödeme kaydı bulunamadı', {
        code: 'NO_PAYMENT_FOUND',
        statusCode: 404,
        traceId,
      })
    }

    const planConfig = PLANS[payment.plan]
    const durationDays = planConfig?.durationDays ?? 30
    const proUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()

    await this.paymentRepo.updatePaymentAndProfile(
      payment.id,
      payment.user_id,
      {
        status: 'paid',
        paid_at: new Date().toISOString(),
        provider_order_id: payment.provider_order_id,
        raw_payload: { status: 'success', test: true },
      },
      {
        plan: planConfig?.plan ?? 'pro',
        is_pro: true,
        plan_type: planConfig?.id ?? 'pro_monthly',
        pro_started_at: new Date().toISOString(),
        pro_expires_at: proUntil,
        pro_renewal: false,
      }
    )

    return { success: true, paymentId: payment.id }
  }

  /**
   * Plan listesini dondurur.
   */
  async getPlans(
    _traceId: string,
    _payload: unknown,
    _userId: string
  ): Promise<PlanConfig[]> {
    return Object.values(PLANS)
  }
}

// Instance olusturma registry.ts'de yapilir (repo DI)
