import * as analysesDal from '@/dal/analyses'
import * as profilesDal from '@/dal/profiles'
import { Analysis, RiskLevel } from '@/types'
import { getPlanLimits } from '@/config/plans'

interface AnalysisRow {
  id: string
  user_id: string
  marketplace: string
  product_name: string
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  risk_score: number
  risk_level: string
  created_at: string
  competitor_price?: number
  competitor_name?: string
  target_position?: string
}

function rowToAnalysis(row: AnalysisRow): Analysis {
  const outputs = row.outputs as Record<string, unknown>
  const riskFactors = Array.isArray(outputs._risk_factors) ? outputs._risk_factors : []

  return {
    id: row.id,
    userId: row.user_id,
    input: {
      ...(row.inputs as unknown as Analysis['input']),
      competitor_price: row.competitor_price,
      competitor_name: row.competitor_name,
      target_position: row.target_position as 'cheaper' | 'same' | 'premium' | undefined,
    },
    result: row.outputs as unknown as Analysis['result'],
    risk: {
      score: row.risk_score,
      level: row.risk_level as RiskLevel,
      factors: riskFactors,
    },
    createdAt: row.created_at,
  }
}

export async function getUserAnalyses(userId: string): Promise<Analysis[]> {
  const rows = await analysesDal.getAnalysesByUserId(userId)
  return rows.map((r: AnalysisRow) => rowToAnalysis(r))
}

export async function getAnalysisDetail(id: string, userId: string): Promise<Analysis | null> {
  const row = await analysesDal.getAnalysisById(id, userId)
  if (!row) return null
  return rowToAnalysis(row as AnalysisRow)
}

export async function createAnalysis(
  userId: string,
  analysis: Analysis
): Promise<{ success: boolean; error?: string }> {
  // Limit kontrolü — sadece yeni kayıtlar için
  const exists = await analysesDal.checkAnalysisExists(analysis.id)

  if (!exists) {
    // Plan kontrolü — DAL üzerinden (browser client kullanmadan)
    const profile = await profilesDal.getProfileById(userId)
    const userPlan = (profile as Record<string, unknown>)?.plan || 'free'

    if (userPlan !== 'pro' && userPlan !== 'admin') {
      const currentCount = await analysesDal.getAnalysisCount(userId)
      const limits = getPlanLimits(userPlan as string)
      if (currentCount >= limits.maxProducts) {
        const limitLabel = limits.maxProducts === Infinity ? 'Sınırsız' : String(limits.maxProducts)
        return {
          success: false,
          error: `Plan limiti aşıldı (Maksimum ${limitLabel} analiz). Planınızı yükselterek daha fazla analiz yapabilirsiniz.`,
        }
      }
    }
  }

  // sale_price doğrulama
  if (!Number.isFinite(analysis.input.sale_price) || analysis.input.sale_price <= 0) {
    console.error('Invalid sale_price:', analysis.input.sale_price)
    return { success: false, error: 'SALE_PRICE_MISSING_OR_INVALID' }
  }

  const outputsWithRisk = {
    ...analysis.result,
    _risk_factors: analysis.risk.factors,
  }

  const row = {
    id: analysis.id,
    user_id: analysis.userId,
    marketplace: analysis.input.marketplace,
    product_name: analysis.input.product_name,
    inputs: analysis.input as unknown as Record<string, unknown>,
    outputs: outputsWithRisk as unknown as Record<string, unknown>,
    risk_score: analysis.risk.score,
    risk_level: analysis.risk.level,
    competitor_price: analysis.input.competitor_price,
    competitor_name: analysis.input.competitor_name,
    target_position: analysis.input.target_position,
  }

  try {
    await analysesDal.createAnalysis(row)
    return { success: true }
  } catch (err) {
    console.error('createAnalysis error:', err)
    return { success: false, error: (err as Error).message }
  }
}

export async function deleteAnalysis(
  id: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await analysesDal.deleteAnalysis(id, userId)
    return { success: true }
  } catch (err) {
    console.error('deleteAnalysis error:', err)
    return { success: false, error: (err as Error).message }
  }
}

export async function getSidebarStats(userId: string) {
  const analyses = await analysesDal.getAnalysisStats(userId)

  const total = analyses.length
  let profitable = 0
  let risky = 0

  analyses.forEach((a: Record<string, unknown>) => {
    const outputs = a.outputs as Record<string, unknown> | undefined
    if (Number(outputs?.monthly_net_profit) > 0) profitable++
    if (a.risk_level === 'High' || a.risk_level === 'Critical') risky++
  })

  const lastUpdated = analyses.length > 0 ? (analyses[0].created_at as string) : null

  return { total, profitable, risky, lastUpdated }
}
