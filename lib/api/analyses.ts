import { Analysis, ProductInput, CalculationResult, RiskResult } from '@/types'

/**
 * DB row → Analysis tipine dönüştürür.
 * API gateway AnalysisRow döner (flat: inputs/outputs JSONB, risk_score, risk_level).
 * UI ise Analysis tipi bekler (nested: input/result/risk).
 */
function rowToAnalysis(row: Record<string, unknown>): Analysis {
  // Zaten Analysis formatındaysa (input/result/risk var) — olduğu gibi dön
  if (row.input && row.result && row.risk) {
    return row as unknown as Analysis
  }

  const inputs = (row.inputs ?? {}) as Record<string, unknown>
  const outputs = (row.outputs ?? {}) as Record<string, unknown>

  return {
    id: row.id as string,
    userId: (row.user_id ?? row.userId ?? '') as string,
    input: {
      ...inputs,
      product_name: (row.product_name ?? inputs.product_name ?? inputs.productName ?? '') as string,
      marketplace: (row.marketplace ?? inputs.marketplace ?? 'trendyol') as ProductInput['marketplace'],
      sale_price: num(inputs.sale_price ?? inputs.salePrice),
      product_cost: num(inputs.product_cost ?? inputs.productCost),
      shipping_cost: num(inputs.shipping_cost ?? inputs.shippingCost),
      packaging_cost: num(inputs.packaging_cost ?? inputs.packagingCost),
      ad_cost_per_sale: num(inputs.ad_cost_per_sale ?? inputs.adCostPerSale),
      other_cost: num(inputs.other_cost ?? inputs.otherCost),
      commission_pct: num(inputs.commission_pct ?? inputs.commissionPct),
      return_rate_pct: num(inputs.return_rate_pct ?? inputs.returnRatePct),
      vat_pct: num(inputs.vat_pct ?? inputs.vatPct ?? 20),
      monthly_sales_volume: num(inputs.monthly_sales_volume ?? inputs.monthlySalesVolume),
      payout_delay_days: num(inputs.payout_delay_days ?? inputs.payoutDelayDays),
    } as ProductInput,
    result: {
      unit_net_profit: num(outputs.unit_net_profit ?? outputs.unitNetProfit),
      margin_pct: num(outputs.margin_pct ?? outputs.marginPercent ?? outputs.marginPct),
      monthly_net_profit: num(outputs.monthly_net_profit ?? outputs.monthlyNetProfit),
      monthly_revenue: num(outputs.monthly_revenue ?? outputs.monthlyRevenue),
      monthly_total_cost: num(outputs.monthly_total_cost ?? outputs.monthlyTotalCost),
      commission_amount: num(outputs.commission_amount ?? outputs.commissionAmount),
      vat_amount: num(outputs.vat_amount ?? outputs.vatAmount),
      expected_return_loss: num(outputs.expected_return_loss ?? outputs.expectedReturnLoss),
      service_fee_amount: num(outputs.service_fee_amount ?? outputs.serviceFeeAmount),
      unit_variable_cost: num(outputs.unit_variable_cost ?? outputs.unitVariableCost),
      unit_total_cost: num(outputs.unit_total_cost ?? outputs.unitTotalCost),
      breakeven_price: num(outputs.breakeven_price ?? outputs.breakevenPrice),
      sale_price: num(outputs.sale_price ?? outputs.salePrice ?? inputs.sale_price ?? inputs.salePrice),
      sale_price_excl_vat: num(outputs.sale_price_excl_vat ?? outputs.salePriceExclVat),
      output_vat_monthly: num(outputs.output_vat_monthly ?? outputs.outputVatMonthly),
      input_vat_monthly: num(outputs.input_vat_monthly ?? outputs.inputVatMonthly),
      vat_position_monthly: num(outputs.vat_position_monthly ?? outputs.vatPositionMonthly),
      monthly_net_sales: num(outputs.monthly_net_sales ?? outputs.monthlyNetSales),
    } as CalculationResult,
    risk: {
      score: num(row.risk_score ?? (row.risk as Record<string, unknown>)?.score),
      level: ((row.risk_level ?? (row.risk as Record<string, unknown>)?.level ?? 'moderate') as string) as RiskResult['level'],
      factors: (outputs._risk_factors ?? (row.risk as Record<string, unknown>)?.factors ?? []) as RiskResult['factors'],
    },
    createdAt: (row.created_at ?? row.createdAt ?? new Date().toISOString()) as string,
  }
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) || 0 : 0)
}

export async function getStoredAnalyses(): Promise<Analysis[]> {
  const res = await fetch('/api/analyses')
  if (!res.ok) throw new Error('Analizler yüklenemedi')
  const json = await res.json()
  const rows: Record<string, unknown>[] = Array.isArray(json) ? json : (json.data ?? [])
  return rows.map(rowToAnalysis)
}

export async function getAnalysisById(id: string): Promise<Analysis | null> {
  const res = await fetch(`/api/analyses/${id}`)
  if (!res.ok) return null
  const json = await res.json()
  const row = Array.isArray(json) ? json[0] : (json.data ?? json)
  if (!row || !row.id) return null
  return rowToAnalysis(row as Record<string, unknown>)
}

export async function saveAnalysis(analysis: Analysis): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(analysis),
  })
  return res.json()
}

export async function deleteAnalysis(id: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/analyses/${id}`, {
    method: 'DELETE',
  })
  return res.json()
}

export async function getUserAnalysisCount(): Promise<number> {
  const res = await fetch('/api/analyses/count')
  if (!res.ok) return 0
  const data = await res.json()
  return data.count ?? 0
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
