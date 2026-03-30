// ----------------------------------------------------------------
// NotificationLogic — Katman 6
// In-app bildirimler + risk alert email.
// KNOWLEDGE-BASE.md Section 11.
// v1 hata duzeltmesi: Risk alert email 6h cooldown.
// ----------------------------------------------------------------

import { ServiceError } from '@/lib/gateway/types'
import { sendEmail } from '@/lib/email/send'
import type { NotificationRepository } from '@/repositories/notification.repository'

// ----------------------------------------------------------------
// Tipler
// ----------------------------------------------------------------

export type NotificationType = 'danger' | 'warning' | 'info'

export interface Notification {
  id: string
  userId: string
  analysisId: string | null
  productId: string | null
  href: string | null
  type: NotificationType
  category: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  dedupeKey: string | null
}

export interface CreateNotificationPayload {
  type: NotificationType
  category: string
  title: string
  message: string
  analysisId?: string
  productId?: string
  href?: string
  dedupeKey?: string
}

export interface CheckRiskAlertPayload {
  analysisId: string
  riskScore: number
  riskLevel: string
  productName: string
  userEmail: string
  emailRiskAlertEnabled: boolean
}

// ----------------------------------------------------------------
// Sabitler
// ----------------------------------------------------------------

const RISK_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000 // 6 saat

// ----------------------------------------------------------------
// Servis
// ----------------------------------------------------------------

export class NotificationLogic {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  /**
   * Kullanici bildirimlerini listeler (en yeni 50, okunmamis).
   */
  async list(
    _traceId: string,
    _payload: unknown,
    userId: string
  ): Promise<unknown[]> {
    return this.notificationRepo.getByUserId(userId, { limit: 50, isRead: false })
  }

  /**
   * Bildirimi okundu olarak isaretler.
   */
  async markAsRead(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { notificationId } = payload as { notificationId: string }
    if (!notificationId) {
      throw new ServiceError('Bildirim ID\'si zorunludur', {
        code: 'MISSING_NOTIFICATION_ID',
        statusCode: 400,
        traceId,
      })
    }
    await this.notificationRepo.markAsRead(notificationId)
    return { success: true }
  }

  /**
   * Tum bildirimleri okundu olarak isaretler.
   */
  async markAllAsRead(
    _traceId: string,
    _payload: unknown,
    userId: string
  ): Promise<{ success: boolean }> {
    await this.notificationRepo.markAllAsRead(userId)
    return { success: true }
  }

  /**
   * Bildirim olusturur (upsert — dedupeKey ile).
   */
  async create(
    _traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ id: string }> {
    const input = payload as CreateNotificationPayload
    const row = await this.notificationRepo.upsert({
      user_id: userId,
      type: input.type,
      category: input.category,
      title: input.title,
      message: input.message,
      analysis_id: input.analysisId ?? null,
      product_id: input.productId ?? null,
      href: input.href ?? null,
      dedupe_key: input.dedupeKey ?? null,
    })
    return { id: row.id }
  }

  /**
   * Risk alert kontrolu yapar.
   * Kosullar:
   * - risk_score >= 70 VEYA risk_level 'dangerous'/'Tehlikeli'
   * - Kullanici email_risk_alert tercihi acik
   * - Son risk alert'ten bu yana en az 6 saat gecmis (v1 hata duzeltmesi)
   */
  async checkRiskAlert(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ emailSent: boolean; notificationCreated: boolean }> {
    const input = payload as CheckRiskAlertPayload

    const shouldAlert =
      input.riskScore >= 70 ||
      input.riskLevel === 'dangerous' ||
      input.riskLevel === 'Tehlikeli'

    if (!shouldAlert) {
      return { emailSent: false, notificationCreated: false }
    }

    // In-app bildirim olustur
    await this.create(traceId, {
      type: 'danger' as NotificationType,
      category: 'risk_alert',
      title: 'Risk Uyarısı',
      message: `${input.productName} ürününüz yüksek risk taşıyor (Skor: ${input.riskScore})`,
      analysisId: input.analysisId,
      href: `/analysis/${input.analysisId}`,
      dedupeKey: `risk_alert_${input.analysisId}`,
    }, userId)

    // Email gonderimi kontrolu
    if (!input.emailRiskAlertEnabled) {
      return { emailSent: false, notificationCreated: true }
    }

    // 6 saatlik cooldown kontrolu
    const lastAlertTime = await this.notificationRepo.getLastRiskAlertTime(userId)

    if (lastAlertTime) {
      const timeSince = Date.now() - new Date(lastAlertTime).getTime()
      if (timeSince < RISK_ALERT_COOLDOWN_MS) {
        return { emailSent: false, notificationCreated: true }
      }
    }

    // Risk alert emaili gonder
    try {
      await sendEmail({
        to: input.userEmail,
        subject: `Risk Uyarısı: ${input.productName}`,
        html: `
          <h2>Risk Uyarısı</h2>
          <p><strong>${input.productName}</strong> ürününüz yüksek risk taşıyor.</p>
          <p>Risk Skoru: <strong>${input.riskScore}/100</strong></p>
          <p>Risk Seviyesi: <strong>${input.riskLevel}</strong></p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/analysis/${input.analysisId}">Analizi İncele</a></p>
        `,
      })

      return { emailSent: true, notificationCreated: true }
    } catch {
      // Email hatasi bildirimi engellemez
      return { emailSent: false, notificationCreated: true }
    }
  }
}

// Instance olusturma registry.ts'de yapilir (repo DI)
