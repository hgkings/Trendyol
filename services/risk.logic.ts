// ----------------------------------------------------------------
// RiskLogic — Katman 6
// Risk puani hesaplama motoru (0-100).
// Formul: KNOWLEDGE-BASE.md Section 2 ile birebir.
// ----------------------------------------------------------------

import { ServiceError } from '@/lib/gateway/types'

// ----------------------------------------------------------------
// Tipler
// ----------------------------------------------------------------

export interface RiskInput {
  salePrice: number
  marginPercent: number
  returnRatePct: number
  adCostPerSale: number
  commissionPct: number
}

export interface RiskFactor {
  key: string
  label: string
  triggered: boolean
}

export type RiskLevel = 'safe' | 'moderate' | 'risky' | 'dangerous'

export interface RiskResult {
  score: number
  level: RiskLevel
  factors: RiskFactor[]
  components: {
    margin: number
    returnRate: number
    adDependency: number
    commission: number
  }
}

// ----------------------------------------------------------------
// Hesaplama
// ----------------------------------------------------------------

function calculateMarginScore(marginPercent: number): { score: number; triggered: boolean } {
  let score: number
  if (marginPercent >= 20) {
    score = 40
  } else if (marginPercent >= 10) {
    score = 20 + ((marginPercent - 10) / 10) * 20
  } else if (marginPercent >= 0) {
    score = (marginPercent / 10) * 20
  } else {
    score = 0
  }
  return { score, triggered: marginPercent < 10 }
}

function calculateReturnScore(returnRatePct: number): { score: number; triggered: boolean } {
  let score: number
  if (returnRatePct <= 5) {
    score = 20
  } else if (returnRatePct <= 15) {
    score = 20 - ((returnRatePct - 5) / 10) * 10
  } else {
    score = Math.max(0, 10 - ((returnRatePct - 15) / 10) * 10)
  }
  return { score, triggered: returnRatePct > 10 }
}

function calculateAdScore(adCostPerSale: number, salePrice: number): { score: number; triggered: boolean } {
  const adRatio = salePrice > 0 ? (adCostPerSale / salePrice) * 100 : 0
  let score: number
  if (adRatio <= 3) {
    score = 20
  } else if (adRatio <= 10) {
    score = 20 - ((adRatio - 3) / 7) * 10
  } else {
    score = Math.max(0, 10 - ((adRatio - 10) / 10) * 10)
  }
  return { score, triggered: adRatio > 10 }
}

function calculateCommissionScore(commissionPct: number): { score: number; triggered: boolean } {
  let score: number
  if (commissionPct <= 12) {
    score = 20
  } else if (commissionPct <= 20) {
    score = 20 - ((commissionPct - 12) / 8) * 10
  } else {
    score = Math.max(0, 10 - ((commissionPct - 20) / 10) * 10)
  }
  return { score, triggered: commissionPct > 20 }
}

function resolveLevel(score: number): RiskLevel {
  if (score >= 80) return 'safe'
  if (score >= 60) return 'moderate'
  if (score >= 40) return 'risky'
  return 'dangerous'
}

// ----------------------------------------------------------------
// Servis
// ----------------------------------------------------------------

export class RiskLogic {
  async calculateRisk(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<RiskResult> {
    const input = payload as RiskInput

    if (typeof input.salePrice !== 'number' || typeof input.marginPercent !== 'number') {
      throw new ServiceError('Risk hesaplamasi icin gecersiz girdi', {
        code: 'INVALID_RISK_INPUT',
        statusCode: 400,
        traceId,
      })
    }

    const margin = calculateMarginScore(input.marginPercent)
    const returnRate = calculateReturnScore(input.returnRatePct ?? 0)
    const ad = calculateAdScore(input.adCostPerSale ?? 0, input.salePrice)
    const commission = calculateCommissionScore(input.commissionPct ?? 0)

    const totalScore = Math.round(margin.score + returnRate.score + ad.score + commission.score)

    const factors: RiskFactor[] = [
      { key: 'low_margin', label: 'Düşük Kâr Marjı', triggered: margin.triggered },
      { key: 'high_return', label: 'Yüksek İade Oranı', triggered: returnRate.triggered },
      { key: 'ad_dependency', label: 'Reklam Bağımlılığı', triggered: ad.triggered },
      { key: 'high_commission', label: 'Yüksek Komisyon', triggered: commission.triggered },
    ]

    return {
      score: totalScore,
      level: resolveLevel(totalScore),
      factors,
      components: {
        margin: Math.round(margin.score),
        returnRate: Math.round(returnRate.score),
        adDependency: Math.round(ad.score),
        commission: Math.round(commission.score),
      },
    }
  }
}

export const riskLogic = new RiskLogic()
