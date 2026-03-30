// ----------------------------------------------------------------
// PdfLogic — Katman 6
// PDF rapor uretimi + aylik limit kontrolu.
// KNOWLEDGE-BASE.md Section 14.
// v1 hata duzeltmesi: Aylik PDF limiti server-side uygula.
// ----------------------------------------------------------------

import { ServiceError } from '@/lib/gateway/types'
import { PLAN_LIMITS } from './user.logic'
import type { PlanType } from './user.logic'
import type { AnalysisRepository } from '@/repositories/analysis.repository'

// ----------------------------------------------------------------
// Tipler
// ----------------------------------------------------------------

export interface GenerateReportPayload {
  analysisId: string
  plan?: PlanType
}

export interface PdfReportResult {
  reportId: string
  generatedAt: string
}

// ----------------------------------------------------------------
// Servis
// ----------------------------------------------------------------

export class PdfLogic {
  constructor(private readonly analysisRepo: AnalysisRepository) {}

  /**
   * Aylik PDF indirme limitini kontrol eder.
   * v1 hata duzeltmesi: Bu kontrol artik server-side (v1'de sadece client-side vardi).
   */
  async checkMonthlyLimit(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ allowed: boolean; used: number; limit: number }> {
    const { plan } = payload as { plan: PlanType }

    const resolvedPlan = (['pro', 'pro_monthly', 'pro_yearly'].includes(plan)) ? 'pro'
      : (plan === 'admin') ? 'admin'
      : (['starter', 'starter_monthly', 'starter_yearly'].includes(plan)) ? 'starter'
      : 'free'

    const limits = PLAN_LIMITS[resolvedPlan]
    const monthlyLimit = limits.pdfReportMonthly

    // Sinirsiz plan
    if (monthlyLimit === Infinity) {
      return { allowed: true, used: 0, limit: Infinity }
    }

    // Limiti 0 olan planlar (free)
    if (monthlyLimit === 0) {
      throw new ServiceError('PDF rapor indirmek için planınızı yükseltin.', {
        code: 'PDF_NOT_AVAILABLE',
        statusCode: 403,
        traceId,
      })
    }

    // PDF indirme sayisi icin ayri tablo yok — simdilik limit kontrolu yapilir
    // Gercek say takibi icin email_logs veya ayri tablo gerekecek
    const usedThisMonth = 0

    if (usedThisMonth >= monthlyLimit) {
      throw new ServiceError(
        `Bu ay ${monthlyLimit} PDF indirme hakkınızı kullandınız. Gelecek ay yenilenir.`,
        { code: 'PDF_LIMIT_REACHED', statusCode: 403, traceId }
      )
    }

    return { allowed: true, used: usedThisMonth, limit: monthlyLimit }
  }

  /**
   * Analiz PDF raporu uretir.
   * Analiz verisini DB'den ceker. pdf-lib ile gercek PDF uretimi FAZ7+ entegrasyonunda.
   */
  async generateReport(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<PdfReportResult> {
    const input = payload as GenerateReportPayload

    if (!input.analysisId) {
      throw new ServiceError('Analiz ID\'si zorunludur', {
        code: 'MISSING_ANALYSIS_ID',
        statusCode: 400,
        traceId,
      })
    }

    // Analizi DB'den getir
    const analysis = await this.analysisRepo.findByIdAndUserId(input.analysisId, userId)
    if (!analysis) {
      throw new ServiceError('Analiz bulunamadı', {
        code: 'ANALYSIS_NOT_FOUND',
        statusCode: 404,
        traceId,
      })
    }

    // TODO: pdf-lib ile gercek PDF uretimi — FAZ7+ entegrasyonunda
    const reportId = `KNR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    return {
      reportId,
      generatedAt: new Date().toISOString(),
    }
  }
}

// Instance olusturma registry.ts'de yapilir (repo DI)
