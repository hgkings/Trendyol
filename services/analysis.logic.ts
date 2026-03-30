// ----------------------------------------------------------------
// AnalysisLogic — Katman 6
// Net kar hesaplama motoru + CRUD islemleri.
// Formuller: KNOWLEDGE-BASE.md Section 1 ile birebir.
// ----------------------------------------------------------------

import { ServiceError } from '@/lib/gateway/types'
import type { AnalysisRepository } from '@/repositories/analysis.repository'
import { riskLogic } from './risk.logic'
import { getCategoryDefaults } from './commission.logic'
import type { MarketplaceName } from './commission.logic'
import type { RiskResult } from './risk.logic'

// ----------------------------------------------------------------
// Tipler
// ----------------------------------------------------------------

export interface AnalysisInput {
  productName: string
  marketplace: MarketplaceName
  category?: string
  salePrice: number
  productCost: number
  shippingCost: number
  packagingCost: number
  adCostPerSale: number
  otherCost: number
  commissionPct: number
  returnRatePct: number
  vatPct: number
  monthlySalesVolume: number
  payoutDelayDays: number
  serviceFeeAmount: number
  n11ExtraPct: number
}

export interface CalculationResult {
  salePriceExclVat: number
  vatAmount: number
  commissionAmount: number
  expectedReturnLoss: number
  unitVariableCost: number
  unitTotalCost: number
  unitNetProfit: number
  marginPercent: number
  monthlyNetProfit: number
  monthlyRevenue: number
  monthlyTotalCost: number
}

export interface BreakevenResult {
  breakevenPrice: number
  isProfitable: boolean
}

export interface RequiredPriceResult {
  requiredPrice: number
  achievable: boolean
}

export interface AdCeilingResult {
  maxAdCostPerSale: number
}

export interface CashflowResult {
  unitCashOut: number
  monthlyOutflow: number
  dailyOutflow: number
  workingCapitalNeeded: number
  monthlyInflow: number
  monthlyCashGap: number
}

export interface SensitivityScenario {
  label: string
  unitNetProfit: number
  marginPercent: number
  difference: number
}

export interface ProAccountingInput extends AnalysisInput {
  productCostVatPct: number
  productCostIncludesVat: boolean
  shippingCostVatPct: number
  shippingCostIncludesVat: boolean
  packagingCostVatPct: number
  packagingCostIncludesVat: boolean
  adCostVatPct: number
  adCostIncludesVat: boolean
  otherCostVatPct: number
  otherCostIncludesVat: boolean
  commissionVatPct: number
  refundCommissionOnReturn: boolean
}

export interface ProAccountingResult extends CalculationResult {
  outputVat: number
  inputVat: number
  monthlyVatPosition: number
  costComponents: {
    productCostExclVat: number
    productCostVat: number
    shippingCostExclVat: number
    shippingCostVat: number
    packagingCostExclVat: number
    packagingCostVat: number
    adCostExclVat: number
    adCostVat: number
    otherCostExclVat: number
    otherCostVat: number
    commissionVat: number
  }
}

export interface FullAnalysisResult {
  calculation: CalculationResult
  risk: RiskResult
  breakeven: BreakevenResult
  sensitivity: SensitivityScenario[]
}

// ----------------------------------------------------------------
// Hesaplama Fonksiyonlari (KNOWLEDGE-BASE.md Section 1)
// ----------------------------------------------------------------

function calculateProfit(input: AnalysisInput): CalculationResult {
  // Adim 1: KDV'yi satis fiyatindan cikar
  const vatRate = input.vatPct / 100
  const salePriceExclVat = input.salePrice / (1 + vatRate)
  const vatAmount = input.salePrice - salePriceExclVat

  // Adim 2: Komisyon hesapla (KDV haric fiyat uzerinden + n11 ekstra)
  const commissionAmount =
    salePriceExclVat * (input.commissionPct / 100) +
    input.salePrice * (input.n11ExtraPct / 100)

  // Adim 3: Beklenen iade kaybi
  const expectedReturnLoss = (input.returnRatePct / 100) * input.salePrice

  // Adim 4: Platform servis bedeli (input'tan geliyor)
  const serviceFeeAmount = input.serviceFeeAmount

  // Adim 5: Birim degisken maliyet
  const unitVariableCost =
    input.productCost +
    input.shippingCost +
    input.packagingCost +
    input.adCostPerSale +
    input.otherCost +
    serviceFeeAmount

  // Adim 6: Birim toplam maliyet
  const unitTotalCost =
    unitVariableCost +
    commissionAmount +
    vatAmount +
    expectedReturnLoss

  // Adim 7: Birim net kar
  const unitNetProfit = input.salePrice - unitTotalCost

  // Adim 8: Kar marji
  const marginPercent = input.salePrice > 0
    ? (unitNetProfit / input.salePrice) * 100
    : 0

  // Adim 9: Aylik toplamlar
  const monthlyNetProfit = unitNetProfit * input.monthlySalesVolume
  const monthlyRevenue = input.salePrice * input.monthlySalesVolume
  const monthlyTotalCost = unitTotalCost * input.monthlySalesVolume

  return {
    salePriceExclVat,
    vatAmount,
    commissionAmount,
    expectedReturnLoss,
    unitVariableCost,
    unitTotalCost,
    unitNetProfit,
    marginPercent,
    monthlyNetProfit,
    monthlyRevenue,
    monthlyTotalCost,
  }
}

function calculateBreakevenPrice(input: AnalysisInput): BreakevenResult {
  const baseCost =
    input.productCost +
    input.shippingCost +
    input.packagingCost +
    input.adCostPerSale +
    input.otherCost +
    input.serviceFeeAmount

  const vatFactor = 1 / (1 + input.vatPct / 100)
  const returnFactor = input.returnRatePct / 100
  const denominator =
    vatFactor * (1 - input.commissionPct / 100) -
    (input.n11ExtraPct / 100) -
    returnFactor

  if (denominator <= 0) {
    return { breakevenPrice: Infinity, isProfitable: false }
  }

  return {
    breakevenPrice: baseCost / denominator,
    isProfitable: true,
  }
}

function calculateRequiredPrice(
  input: AnalysisInput,
  targetMarginRate?: number,
  targetProfitPerUnit?: number
): RequiredPriceResult {
  const baseCost =
    input.productCost +
    input.shippingCost +
    input.packagingCost +
    input.adCostPerSale +
    input.otherCost +
    input.serviceFeeAmount

  const vatFactor = 1 / (1 + input.vatPct / 100)
  const returnFactor = input.returnRatePct / 100
  const denominator =
    vatFactor * (1 - input.commissionPct / 100) -
    (input.n11ExtraPct / 100) -
    returnFactor

  if (targetProfitPerUnit !== undefined) {
    if (denominator <= 0) {
      return { requiredPrice: Infinity, achievable: false }
    }
    return {
      requiredPrice: (targetProfitPerUnit + baseCost) / denominator,
      achievable: true,
    }
  }

  if (targetMarginRate !== undefined) {
    const adjustedDenominator = denominator - targetMarginRate
    if (adjustedDenominator <= 0) {
      return { requiredPrice: Infinity, achievable: false }
    }
    return {
      requiredPrice: baseCost / adjustedDenominator,
      achievable: true,
    }
  }

  return { requiredPrice: 0, achievable: false }
}

function calculateAdCeiling(input: AnalysisInput): AdCeilingResult {
  const zeroAdInput = { ...input, adCostPerSale: 0 }
  const result = calculateProfit(zeroAdInput)
  return { maxAdCostPerSale: Math.max(0, result.unitNetProfit) }
}

function calculateCashflowImpact(input: AnalysisInput): CashflowResult {
  const unitCashOut =
    input.productCost +
    input.shippingCost +
    input.packagingCost +
    input.otherCost +
    input.adCostPerSale

  const monthlyOutflow = unitCashOut * input.monthlySalesVolume
  const dailyOutflow = monthlyOutflow / 30
  const workingCapitalNeeded = dailyOutflow * input.payoutDelayDays

  const result = calculateProfit(input)
  const perUnitDeductions = result.commissionAmount + input.serviceFeeAmount + result.vatAmount
  const monthlyInflow =
    result.monthlyRevenue - perUnitDeductions * input.monthlySalesVolume

  const monthlyCashGap =
    monthlyOutflow - (monthlyInflow * (30 - input.payoutDelayDays) / 30)

  return {
    unitCashOut,
    monthlyOutflow,
    dailyOutflow,
    workingCapitalNeeded,
    monthlyInflow,
    monthlyCashGap,
  }
}

function calculateSensitivityScenarios(input: AnalysisInput): SensitivityScenario[] {
  const base = calculateProfit(input)
  const scenarios: SensitivityScenario[] = []

  const variations: Array<{ label: string; modify: (i: AnalysisInput) => AnalysisInput }> = [
    { label: 'Fiyat +%5', modify: i => ({ ...i, salePrice: i.salePrice * 1.05 }) },
    { label: 'Fiyat +%10', modify: i => ({ ...i, salePrice: i.salePrice * 1.10 }) },
    { label: 'Fiyat -%5', modify: i => ({ ...i, salePrice: i.salePrice * 0.95 }) },
    { label: 'Fiyat -%10', modify: i => ({ ...i, salePrice: i.salePrice * 0.90 }) },
    { label: 'Komisyon +2 puan', modify: i => ({ ...i, commissionPct: i.commissionPct + 2 }) },
    { label: 'Komisyon -2 puan', modify: i => ({ ...i, commissionPct: i.commissionPct - 2 }) },
    { label: 'Reklam +5 ₺', modify: i => ({ ...i, adCostPerSale: i.adCostPerSale + 5 }) },
    { label: 'Reklam +10 ₺', modify: i => ({ ...i, adCostPerSale: i.adCostPerSale + 10 }) },
    { label: 'İade oranı 2x', modify: i => ({ ...i, returnRatePct: Math.min(100, i.returnRatePct * 2) }) },
    { label: 'Satış hacmi +%20', modify: i => ({ ...i, monthlySalesVolume: Math.round(i.monthlySalesVolume * 1.2) }) },
  ]

  for (const v of variations) {
    const modified = v.modify(input)
    const result = calculateProfit(modified)
    scenarios.push({
      label: v.label,
      unitNetProfit: result.unitNetProfit,
      marginPercent: result.marginPercent,
      difference: result.unitNetProfit - base.unitNetProfit,
    })
  }

  return scenarios
}

function extractVatComponent(amount: number, vatPct: number, includesVat: boolean): { exclVat: number; vat: number } {
  if (includesVat) {
    const exclVat = amount / (1 + vatPct / 100)
    return { exclVat, vat: amount - exclVat }
  }
  return { exclVat: amount, vat: amount * (vatPct / 100) }
}

function calculateProAccountingResult(input: ProAccountingInput): ProAccountingResult {
  const baseResult = calculateProfit(input)

  // Cikti KDV'si (satis uzerinden)
  const outputVat = baseResult.vatAmount

  // Girdi KDV'si (maliyet bilesenleri)
  const product = extractVatComponent(input.productCost, input.productCostVatPct, input.productCostIncludesVat)
  const shipping = extractVatComponent(input.shippingCost, input.shippingCostVatPct, input.shippingCostIncludesVat)
  const packaging = extractVatComponent(input.packagingCost, input.packagingCostVatPct, input.packagingCostIncludesVat)
  const ad = extractVatComponent(input.adCostPerSale, input.adCostVatPct, input.adCostIncludesVat)
  const other = extractVatComponent(input.otherCost, input.otherCostVatPct, input.otherCostIncludesVat)
  const commissionVat = baseResult.commissionAmount * (input.commissionVatPct / 100)

  const inputVat =
    product.vat + shipping.vat + packaging.vat + ad.vat + other.vat + commissionVat

  const monthlyVatPosition =
    (outputVat - inputVat) * input.monthlySalesVolume

  return {
    ...baseResult,
    outputVat,
    inputVat,
    monthlyVatPosition,
    costComponents: {
      productCostExclVat: product.exclVat,
      productCostVat: product.vat,
      shippingCostExclVat: shipping.exclVat,
      shippingCostVat: shipping.vat,
      packagingCostExclVat: packaging.exclVat,
      packagingCostVat: packaging.vat,
      adCostExclVat: ad.exclVat,
      adCostVat: ad.vat,
      otherCostExclVat: other.exclVat,
      otherCostVat: other.vat,
      commissionVat,
    },
  }
}

// ----------------------------------------------------------------
// Servis
// ----------------------------------------------------------------

export class AnalysisLogic {
  constructor(private readonly analysisRepo: AnalysisRepository) {}

  /**
   * Tam kar hesaplamasi yapar — standart mod.
   */
  async calculateNetProfit(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<CalculationResult> {
    const input = payload as AnalysisInput
    this.validateInput(input, traceId)
    return calculateProfit(input)
  }

  /**
   * Basabas fiyati hesaplar.
   */
  async calculateBreakeven(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<BreakevenResult> {
    const input = payload as AnalysisInput
    this.validateInput(input, traceId)
    return calculateBreakevenPrice(input)
  }

  /**
   * Hedef marj veya kar icin gereken fiyati hesaplar.
   */
  async calculateRequiredPrice(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<RequiredPriceResult> {
    const { input, targetMarginRate, targetProfitPerUnit } = payload as {
      input: AnalysisInput
      targetMarginRate?: number
      targetProfitPerUnit?: number
    }
    this.validateInput(input, traceId)
    return calculateRequiredPrice(input, targetMarginRate, targetProfitPerUnit)
  }

  /**
   * Maks reklam butcesi hesaplar.
   */
  async calculateAdCeiling(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<AdCeilingResult> {
    const input = payload as AnalysisInput
    this.validateInput(input, traceId)
    return calculateAdCeiling(input)
  }

  /**
   * Nakit akis etkisi hesaplar.
   */
  async calculateCashflow(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<CashflowResult> {
    const input = payload as AnalysisInput
    this.validateInput(input, traceId)
    return calculateCashflowImpact(input)
  }

  /**
   * 10 senaryo analizi yapar.
   */
  async calculateSensitivity(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<SensitivityScenario[]> {
    const input = payload as AnalysisInput
    this.validateInput(input, traceId)
    return calculateSensitivityScenarios(input)
  }

  /**
   * Pro muhasebe modu hesaplamasi.
   */
  async calculateProAccounting(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<ProAccountingResult> {
    const input = payload as ProAccountingInput
    this.validateInput(input, traceId)
    return calculateProAccountingResult(input)
  }

  /**
   * Tam analiz (hesaplama + risk + breakeven + sensitivity).
   */
  async fullAnalysis(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<FullAnalysisResult> {
    const input = payload as AnalysisInput
    this.validateInput(input, traceId)

    const calculation = calculateProfit(input)
    const risk = await riskLogic.calculateRisk(traceId, {
      salePrice: input.salePrice,
      marginPercent: calculation.marginPercent,
      returnRatePct: input.returnRatePct,
      adCostPerSale: input.adCostPerSale,
      commissionPct: input.commissionPct,
    }, userId)
    const breakeven = calculateBreakevenPrice(input)
    const sensitivity = calculateSensitivityScenarios(input)

    return { calculation, risk, breakeven, sensitivity }
  }

  /**
   * Analiz olusturur (DB'ye kaydet).
   * FAZ5'te repository baglanacak.
   */
  async create(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ id: string }> {
    const { input } = payload as { input: AnalysisInput }
    this.validateInput(input, traceId)

    const calculation = calculateProfit(input)
    const risk = await riskLogic.calculateRisk(traceId, {
      salePrice: input.salePrice,
      marginPercent: calculation.marginPercent,
      returnRatePct: input.returnRatePct,
      adCostPerSale: input.adCostPerSale,
      commissionPct: input.commissionPct,
    }, userId)

    const row = await this.analysisRepo.create({
      user_id: userId,
      marketplace: input.marketplace,
      product_name: input.productName,
      inputs: input as unknown as Record<string, unknown>,
      outputs: { ...calculation, _risk_factors: risk.factors } as unknown as Record<string, unknown>,
      risk_score: risk.score,
      risk_level: risk.level,
    })

    return { id: row.id }
  }

  /**
   * Analiz getirir.
   * FAZ5'te repository baglanacak.
   */
  async getById(
    _traceId: string,
    payload: unknown,
    userId: string
  ): Promise<unknown> {
    const { id } = payload as { id: string }
    return this.analysisRepo.findByIdAndUserId(id, userId)
  }

  /**
   * Kullanici analizlerini listeler.
   * FAZ5'te repository baglanacak.
   */
  async list(
    _traceId: string,
    _payload: unknown,
    userId: string
  ): Promise<unknown[]> {
    return this.analysisRepo.findByUserId(userId)
  }

  /**
   * Analiz siler.
   * FAZ5'te repository baglanacak.
   */
  async delete(
    _traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ success: boolean }> {
    const { id } = payload as { id: string }
    await this.analysisRepo.deleteByUserIdAndId(id, userId)
    return { success: true }
  }

  /**
   * Tam hesaplanmis analiz objesini DB'ye upsert eder.
   * V1 UI client-side hesaplama yapar ve tum veriyi gonderir.
   */
  async upsertFull(
    _traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ success: boolean; id: string }> {
    const body = payload as {
      id: string
      input: Record<string, unknown>
      result: Record<string, unknown>
      risk: { score?: number; level?: string }
      createdAt?: string
    }

    const row = await this.analysisRepo.upsertRow({
      id: body.id,
      user_id: userId,
      marketplace: (body.input.marketplace as string) ?? 'trendyol',
      product_name: (body.input.product_name as string) ?? (body.input.productName as string) ?? '',
      inputs: body.input as Record<string, unknown>,
      outputs: body.result as Record<string, unknown>,
      risk_score: body.risk.score ?? 0,
      risk_level: body.risk.level ?? 'moderate',
      created_at: body.createdAt ?? new Date().toISOString(),
    })

    return { success: true, id: row.id }
  }

  /**
   * Marketplace + kategori icin varsayilan degerlerle input olusturur.
   */
  async getDefaults(
    _traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ defaults: ReturnType<typeof getCategoryDefaults> }> {
    const { marketplace, category } = payload as {
      marketplace: MarketplaceName
      category?: string
    }
    const defaults = getCategoryDefaults(marketplace, category)
    return { defaults }
  }

  /**
   * Analizin var olup olmadigini kontrol eder (sahiplik kontrolu ile).
   */
  async checkAnalysisExists(
    _traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ exists: boolean }> {
    const { analysisId } = payload as { analysisId: string }
    const row = await this.analysisRepo.findByIdAndUserId(analysisId, userId)
    return { exists: row !== null }
  }

  /**
   * Sidebar icin ozet istatistikleri dondurur.
   */
  async getSidebarStats(
    _traceId: string,
    _payload: unknown,
    userId: string
  ): Promise<{ totalAnalyses: number; avgMargin: number; criticalCount: number }> {
    const analyses = await this.analysisRepo.findByUserId(userId)

    const totalAnalyses = analyses.length
    if (totalAnalyses === 0) {
      return { totalAnalyses: 0, avgMargin: 0, criticalCount: 0 }
    }

    let marginSum = 0
    let criticalCount = 0

    for (const a of analyses) {
      const outputs = a.outputs as Record<string, unknown> | null
      const marginPct = typeof outputs?.marginPercent === 'number' ? outputs.marginPercent : 0
      marginSum += marginPct

      if (a.risk_level === 'dangerous' || a.risk_score >= 70) {
        criticalCount++
      }
    }

    return {
      totalAnalyses,
      avgMargin: marginSum / totalAnalyses,
      criticalCount,
    }
  }

  // ----------------------------------------------------------------
  // Dahili yardimcilar
  // ----------------------------------------------------------------

  private validateInput(input: AnalysisInput, traceId: string): void {
    if (!input.salePrice || input.salePrice <= 0) {
      throw new ServiceError('Satış fiyatı 0\'dan büyük olmalıdır', {
        code: 'INVALID_SALE_PRICE',
        statusCode: 400,
        traceId,
      })
    }
    if (!isFinite(input.salePrice)) {
      throw new ServiceError('Satış fiyatı geçerli bir sayı olmalıdır', {
        code: 'INVALID_SALE_PRICE',
        statusCode: 400,
        traceId,
      })
    }
  }
}

// Instance olusturma registry.ts'de yapilir (repo DI)
