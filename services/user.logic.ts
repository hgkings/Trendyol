// ----------------------------------------------------------------
// UserLogic — Katman 6
// Kullanici profil, plan kontrolu, tercihler.
// KNOWLEDGE-BASE.md Section 7 + 10.
// ----------------------------------------------------------------

import { ServiceError } from '@/lib/gateway/types'
import { emailService } from '@/lib/email/emailService'
import type { UserRepository } from '@/repositories/user.repository'
import type { ProfileRow } from '@/lib/db/types'

// ----------------------------------------------------------------
// Tipler
// ----------------------------------------------------------------

export type PlanType = 'free' | 'starter' | 'pro' | 'pro_monthly' | 'pro_yearly' | 'starter_monthly' | 'starter_yearly' | 'admin'

const PRO_PLANS: PlanType[] = ['pro', 'pro_monthly', 'pro_yearly']
const STARTER_PLANS: PlanType[] = ['starter', 'starter_monthly', 'starter_yearly']

export interface PlanLimits {
  maxProducts: number
  maxMarketplaces: number
  csvExport: boolean
  jsonExport: boolean
  csvImport: boolean
  proAccounting: boolean
  sensitivityAnalysis: boolean
  breakevenCalc: boolean
  cashflowAnalysis: boolean
  marketplaceComparison: boolean
  apiIntegration: boolean
  pdfReportMonthly: number
  weeklyEmailReport: boolean
  prioritySupport: boolean
  competitorTracking: boolean
}

export const PLAN_LIMITS: Record<'free' | 'starter' | 'pro' | 'admin', PlanLimits> = {
  free: {
    maxProducts: 3,
    maxMarketplaces: 2,
    csvExport: false,
    jsonExport: false,
    csvImport: false,
    proAccounting: false,
    sensitivityAnalysis: false,
    breakevenCalc: false,
    cashflowAnalysis: false,
    marketplaceComparison: false,
    apiIntegration: false,
    pdfReportMonthly: 0,
    weeklyEmailReport: false,
    prioritySupport: false,
    competitorTracking: false,
  },
  starter: {
    maxProducts: 25,
    maxMarketplaces: 4,
    csvExport: true,
    jsonExport: true,
    csvImport: true,
    proAccounting: true,
    sensitivityAnalysis: true,
    breakevenCalc: true,
    cashflowAnalysis: false,
    marketplaceComparison: false,
    apiIntegration: false,
    pdfReportMonthly: 5,
    weeklyEmailReport: false,
    prioritySupport: false,
    competitorTracking: false,
  },
  pro: {
    maxProducts: Infinity,
    maxMarketplaces: Infinity,
    csvExport: true,
    jsonExport: true,
    csvImport: true,
    proAccounting: true,
    sensitivityAnalysis: true,
    breakevenCalc: true,
    cashflowAnalysis: true,
    marketplaceComparison: true,
    apiIntegration: true,
    pdfReportMonthly: Infinity,
    weeklyEmailReport: true,
    prioritySupport: true,
    competitorTracking: true,
  },
  admin: {
    maxProducts: Infinity,
    maxMarketplaces: Infinity,
    csvExport: true,
    jsonExport: true,
    csvImport: true,
    proAccounting: true,
    sensitivityAnalysis: true,
    breakevenCalc: true,
    cashflowAnalysis: true,
    marketplaceComparison: true,
    apiIntegration: true,
    pdfReportMonthly: Infinity,
    weeklyEmailReport: true,
    prioritySupport: true,
    competitorTracking: true,
  },
}

export interface UserProfile {
  id: string
  email: string
  fullName: string | null
  plan: PlanType
  isPro: boolean
  proStartedAt: string | null
  proExpiresAt: string | null
  proRenewal: boolean
  emailNotificationsEnabled: boolean
  emailWeeklyReport: boolean
  emailRiskAlert: boolean
  emailMarginAlert: boolean
  emailProExpiry: boolean
}

// ----------------------------------------------------------------
// Servis
// ----------------------------------------------------------------

export class UserLogic {
  constructor(private readonly userRepo: UserRepository) {}

  /**
   * Kullanici profilini getirir.
   */
  async getProfile(
    _traceId: string,
    _payload: unknown,
    userId: string
  ): Promise<UserProfile | null> {
    const row = await this.userRepo.findById(userId)
    if (!row) return null
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      plan: row.plan as PlanType,
      isPro: row.is_pro ?? false,
      proStartedAt: row.pro_started_at,
      proExpiresAt: row.pro_expires_at,
      proRenewal: row.pro_renewal ?? false,
      emailNotificationsEnabled: row.email_notifications_enabled ?? true,
      emailWeeklyReport: row.email_weekly_report ?? true,
      emailRiskAlert: row.email_risk_alert ?? true,
      emailMarginAlert: row.email_margin_alert ?? true,
      emailProExpiry: row.email_pro_expiry ?? true,
    }
  }

  /**
   * Profil gunceller.
   */
  async updateProfile(
    _traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ success: boolean }> {
    const updates = payload as Partial<Record<string, unknown>>
    await this.userRepo.update(userId, updates)
    return { success: true }
  }

  /**
   * Profil yoksa olusturur, varsa gunceller.
   */
  async upsertProfile(
    _traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const data = payload as { id: string; email: string; [key: string]: unknown }
    await this.userRepo.upsertProfile(data as Parameters<typeof this.userRepo.upsertProfile>[0])
    return { success: true }
  }

  /**
   * Email bildirim tercihlerini gunceller.
   */
  async updateEmailPreferences(
    _traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ success: boolean }> {
    const prefs = payload as {
      email_notifications_enabled?: boolean
      email_weekly_report?: boolean
      email_risk_alert?: boolean
      email_margin_alert?: boolean
      email_pro_expiry?: boolean
    }
    await this.userRepo.updateEmailPreferences(userId, prefs)
    return { success: true }
  }

  /**
   * Analiz limiti kontrol eder (plan bazli).
   * Kullanici profilinden plan'i alir, analiz sayisini repository'den sayar.
   */
  async checkAnalysisLimit(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const { currentAnalysisCount } = payload as { currentAnalysisCount: number }
    const profile = await this.userRepo.findById(userId)

    if (!profile) {
      throw new ServiceError('Kullanıcı profili bulunamadı', {
        code: 'PROFILE_NOT_FOUND',
        statusCode: 404,
        traceId,
      })
    }

    const plan = profile.plan as PlanType
    const limits = this.resolveLimits(plan)

    if (limits.maxProducts === Infinity) {
      return { allowed: true, current: currentAnalysisCount, limit: Infinity }
    }

    return {
      allowed: currentAnalysisCount < limits.maxProducts,
      current: currentAnalysisCount,
      limit: limits.maxProducts,
    }
  }

  /**
   * Plan limiti kontrol eder.
   * Analiz olusturmadan once cagrilir.
   */
  async checkPlanLimit(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ allowed: boolean; currentCount: number; maxAllowed: number }> {
    const { plan, currentAnalysisCount } = payload as {
      plan: PlanType
      currentAnalysisCount: number
    }

    const limits = this.resolveLimits(plan)

    if (limits.maxProducts === Infinity) {
      return { allowed: true, currentCount: currentAnalysisCount, maxAllowed: Infinity }
    }

    if (currentAnalysisCount >= limits.maxProducts) {
      throw new ServiceError(
        `Plan limitinize ulaştınız. Maksimum ${limits.maxProducts} analiz oluşturabilirsiniz.`,
        { code: 'PLAN_LIMIT_REACHED', statusCode: 403, traceId }
      )
    }

    return {
      allowed: true,
      currentCount: currentAnalysisCount,
      maxAllowed: limits.maxProducts,
    }
  }

  /**
   * Pro kullanici mi kontrol eder.
   * KNOWLEDGE-BASE.md Section 7: isProUser() mantigi.
   */
  async isProUser(
    _traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ isPro: boolean }> {
    const { plan, proExpiresAt } = payload as {
      plan: PlanType
      proExpiresAt: string | null
    }

    if (!PRO_PLANS.includes(plan) && plan !== 'admin') {
      return { isPro: false }
    }

    // admin her zaman pro
    if (plan === 'admin') {
      return { isPro: true }
    }

    // proExpiresAt null ise — legacy pro, suresi yok
    if (!proExpiresAt) {
      return { isPro: true }
    }

    // Suresi dolmus mu?
    const expiresAt = new Date(proExpiresAt)
    if (expiresAt > new Date()) {
      return { isPro: true }
    }

    return { isPro: false }
  }

  /**
   * Kullanici hesabini ve tum verilerini kalici olarak siler.
   * Tum bagli tablolar cascade silinir, ardindan auth kaydı kaldirilir.
   */
  async deleteAccount(
    traceId: string,
    _payload: unknown,
    userId: string
  ): Promise<{ success: boolean; deletedTables: string[] }> {
    const profile = await this.userRepo.findById(userId)
    if (!profile) {
      throw new ServiceError('Kullanıcı profili bulunamadı', {
        code: 'PROFILE_NOT_FOUND',
        statusCode: 404,
        traceId,
      })
    }

    const result = await this.userRepo.deleteAllUserData(userId)
    return { success: true, deletedTables: result.deletedTables }
  }

  /**
   * Cron: Pro suresi dolacak/dolmus kullanicilari kontrol eder.
   * 1) 7 gun sonra dolacaklar → uyari emaili
   * 2) 1 gun sonra dolacaklar → uyari emaili
   * 3) Suresi dolmuslar → is_pro=false, plan=free, email
   */
  async checkProExpiry(
    traceId: string,
    _payload: unknown,
    _userId: string
  ): Promise<{ warned7: number; warned1: number; expired: number; errors: string[] }> {
    const results = { warned7: 0, warned1: 0, expired: 0, errors: [] as string[] }

    // 1. 7 gun sonra dolacaklar
    try {
      const users7 = await this.userRepo.findExpiring(7)
      for (const user of users7) {
        try {
          const expiresDate = new Date(user.pro_expires_at as string).toLocaleDateString('tr-TR')
          await emailService.sendProExpiryWarning(
            { email: user.email, name: user.full_name ?? undefined, id: user.id },
            { daysLeft: 7, expiresAt: expiresDate }
          )
          results.warned7++
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Bilinmeyen hata'
          results.errors.push(`7 günlük uyarı başarısız (${user.email}): ${msg}`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata'
      results.errors.push(`7 günlük sorgu başarısız: ${msg}`)
    }

    // 2. 1 gun sonra dolacaklar
    try {
      const users1 = await this.userRepo.findExpiring(1)
      for (const user of users1) {
        try {
          const expiresDate = new Date(user.pro_expires_at as string).toLocaleDateString('tr-TR')
          await emailService.sendProExpiryWarning(
            { email: user.email, name: user.full_name ?? undefined, id: user.id },
            { daysLeft: 1, expiresAt: expiresDate }
          )
          results.warned1++
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Bilinmeyen hata'
          results.errors.push(`1 günlük uyarı başarısız (${user.email}): ${msg}`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata'
      results.errors.push(`1 günlük sorgu başarısız: ${msg}`)
    }

    // 3. Suresi dolmuslar → is_pro=false, plan=free
    try {
      const expiredUsers = await this.userRepo.findExpired()
      for (const user of expiredUsers) {
        try {
          await this.userRepo.update(user.id, { is_pro: false, plan: 'free' })
          await emailService.sendProExpired(
            { email: user.email, name: user.full_name ?? undefined, id: user.id }
          )
          results.expired++
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Bilinmeyen hata'
          results.errors.push(`Süre dolumu işlemi başarısız (${user.email}): ${msg}`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata'
      results.errors.push(`Süresi dolmuş sorgu başarısız: ${msg}`)
    }

    return results
  }

  /**
   * Plan icin limitleri cozumler.
   */
  resolveLimits(plan: PlanType): PlanLimits {
    if (plan === 'admin') return PLAN_LIMITS.admin
    if (PRO_PLANS.includes(plan)) return PLAN_LIMITS.pro
    if (STARTER_PLANS.includes(plan)) return PLAN_LIMITS.starter
    return PLAN_LIMITS.free
  }

  // ----------------------------------------------------------------
  // Admin metodlari
  // ----------------------------------------------------------------

  /**
   * Admin: Kullanicilari arar — email + plan filtresi + sayfalama.
   */
  async searchUsers(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ users: ProfileRow[]; total: number; page: number; limit: number }> {
    const { search, plan, page = 1, limit = 20 } = payload as {
      search?: string
      plan?: string
      page?: number
      limit?: number
    }

    // Plan gruplama: 'pro' → tum pro varyantlari, 'starter' → tum starter varyantlari
    let planFilter: string[] | undefined
    if (plan) {
      if (plan === 'pro') {
        planFilter = ['pro', 'pro_monthly', 'pro_yearly']
      } else if (plan === 'starter') {
        planFilter = ['starter', 'starter_monthly', 'starter_yearly']
      } else {
        planFilter = [plan]
      }
    }

    const result = await this.userRepo.searchUsers({
      search,
      planFilter,
      page,
      pageSize: limit,
    })

    return {
      users: result.data,
      total: result.total,
      page: result.page,
      limit: result.pageSize,
    }
  }

  /**
   * Admin: Kullanici planini gunceller.
   * is_pro, pro_started_at, pro_expires_at otomatik ayarlanir.
   */
  async updateUserPlan(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { userId, plan, pro_until } = payload as {
      userId: string
      plan: PlanType
      pro_until?: string
    }

    if (!userId || !plan) {
      throw new ServiceError('userId ve plan zorunludur', {
        code: 'MISSING_FIELDS',
        statusCode: 400,
        traceId,
      })
    }

    const profile = await this.userRepo.findById(userId)
    if (!profile) {
      throw new ServiceError('Kullanıcı bulunamadı', {
        code: 'USER_NOT_FOUND',
        statusCode: 404,
        traceId,
      })
    }

    const isPro = PRO_PLANS.includes(plan) || plan === 'admin'
    const isStarter = STARTER_PLANS.includes(plan)
    const isPaid = isPro || isStarter

    const updates: Partial<Record<string, unknown>> = {
      plan,
      is_pro: isPro,
      plan_type: plan,
    }

    if (isPaid) {
      updates.pro_started_at = new Date().toISOString()
      updates.pro_expires_at = pro_until ?? null
    } else {
      // free plana dusurulurse pro bilgilerini temizle
      updates.pro_started_at = null
      updates.pro_expires_at = null
      updates.pro_renewal = false
    }

    await this.userRepo.update(userId, updates)
    return { success: true }
  }

  /**
   * Admin: Dashboard istatistikleri.
   * Kullanici sayilari (plana gore), analiz sayisi, gelir, destek talepleri, son kullanicilar.
   */
  async getAdminStats(
    traceId: string,
    _payload: unknown,
    _userId: string
  ): Promise<{
    totalUsers: number
    freeUsers: number
    starterUsers: number
    proUsers: number
    adminUsers: number
    totalAnalyses: number
    totalRevenue: number
    totalTickets: number
    recentUsers: ProfileRow[]
  }> {
    const [
      totalUsers,
      freeUsers,
      starterUsers,
      proUsers,
      adminUsers,
      totalAnalyses,
      totalRevenue,
      totalTickets,
      recentUsers,
    ] = await Promise.all([
      this.userRepo.countAll(),
      this.userRepo.countByPlan(['free']),
      this.userRepo.countByPlan(['starter', 'starter_monthly', 'starter_yearly']),
      this.userRepo.countByPlan(['pro', 'pro_monthly', 'pro_yearly']),
      this.userRepo.countByPlan(['admin']),
      this.userRepo.countTable('analyses'),
      this.userRepo.sumPaidPayments(),
      this.userRepo.countTable('support_tickets'),
      this.userRepo.findRecent(10),
    ])

    return {
      totalUsers,
      freeUsers,
      starterUsers,
      proUsers,
      adminUsers,
      totalAnalyses,
      totalRevenue,
      totalTickets,
      recentUsers,
    }
  }

  /**
   * Kullanicinin belirli bir ozellige erisimi var mi kontrol eder.
   */
  async checkFeatureAccess(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ allowed: boolean }> {
    const { plan, feature } = payload as { plan: PlanType; feature: keyof PlanLimits }
    const limits = this.resolveLimits(plan)
    const value = limits[feature]

    if (typeof value === 'boolean') {
      if (!value) {
        throw new ServiceError('Bu özellik planınızda mevcut değil. Yükseltme yapın.', {
          code: 'FEATURE_NOT_AVAILABLE',
          statusCode: 403,
          traceId,
        })
      }
      return { allowed: true }
    }

    // Sayisal limit (0 ise erisim yok)
    if (value === 0) {
      throw new ServiceError('Bu özellik planınızda mevcut değil. Yükseltme yapın.', {
        code: 'FEATURE_NOT_AVAILABLE',
        statusCode: 403,
        traceId,
      })
    }

    return { allowed: true }
  }
}

// Instance olusturma registry.ts'de yapilir (repo DI)
