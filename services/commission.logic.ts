// ----------------------------------------------------------------
// CommissionLogic — Katman 6
// Komisyon oranlari yonetimi.
// Varsayilan oranlar: KNOWLEDGE-BASE.md Section 4.
// Kullanici override: DB'den.
// ----------------------------------------------------------------

import { ServiceError } from '@/lib/gateway/types'
import type { CommissionRepository } from '@/repositories/commission.repository'

// ----------------------------------------------------------------
// Tipler
// ----------------------------------------------------------------

export type MarketplaceName = 'trendyol' | 'hepsiburada' | 'n11' | 'amazon_tr' | 'custom'

export interface CommissionRate {
  marketplace: MarketplaceName
  category: string
  rate: number
}

export interface CategoryDefaults {
  commissionPct: number
  returnRatePct: number
  serviceFee: number
  vatPct: number
  payoutDelayDays: number
  n11ExtraPct: number
}

// ----------------------------------------------------------------
// Varsayilan Komisyon Oranlari (KNOWLEDGE-BASE.md Section 4)
// ----------------------------------------------------------------

const TRENDYOL_RATES: Record<string, number> = {
  'Elektronik': 8,
  'Bilgisayar & Tablet': 8,
  'Telefon & Aksesuar': 10,
  'Beyaz Eşya': 10,
  'Kozmetik & Kişisel Bakım': 14,
  'Ev & Yaşam': 14,
  'Süpermarket & Gıda': 5,
  'Spor & Outdoor': 18,
  'Giyim & Moda': 20,
  'Ayakkabı & Çanta': 20,
  'Anne & Bebek': 12,
  'Oyuncak & Hobi': 14,
  'Kitap & Kırtasiye': 10,
  'Otomotiv & Motosiklet': 12,
  'Diğer': 14,
}

const HEPSIBURADA_RATES: Record<string, number> = {
  'Elektronik': 9,
  'Bilgisayar': 9,
  'Telefon': 10,
  'Beyaz Eşya': 10,
  'Kozmetik': 15,
  'Ev & Yaşam': 13,
  'Süpermarket': 8,
  'Giyim': 18,
  'Ayakkabı': 18,
  'Anne & Bebek': 13,
  'Spor': 15,
  'Kitap': 10,
  'Diğer': 13,
}

const N11_RATES: Record<string, number> = {
  'Elektronik': 8,
  'Bilgisayar': 8,
  'Telefon': 10,
  'Beyaz Eşya': 10,
  'Kozmetik': 14,
  'Ev & Yaşam': 12,
  'Süpermarket': 8,
  'Giyim': 16,
  'Ayakkabı': 16,
  'Anne & Bebek': 12,
  'Diğer': 12,
}

const AMAZON_TR_RATES: Record<string, number> = {
  'Elektronik': 7,
  'Bilgisayar': 7,
  'Telefon': 8,
  'Beyaz Eşya': 8,
  'Kozmetik': 12,
  'Ev & Yaşam': 12,
  'Süpermarket': 8,
  'Giyim': 15,
  'Ayakkabı': 15,
  'Anne & Bebek': 10,
  'Spor': 12,
  'Diğer': 12,
}

const DEFAULT_RATES: Record<MarketplaceName, Record<string, number>> = {
  trendyol: TRENDYOL_RATES,
  hepsiburada: HEPSIBURADA_RATES,
  n11: N11_RATES,
  amazon_tr: AMAZON_TR_RATES,
  custom: {},
}

// ----------------------------------------------------------------
// Kategori Bazli Varsayilan Iade Oranlari (ETBİS 2024)
// ----------------------------------------------------------------

const CATEGORY_RETURN_RATES: Record<string, number> = {
  'Giyim & Moda': 28,
  'Giyim': 28,
  'Ayakkabı & Çanta': 30,
  'Ayakkabı': 30,
  'Kozmetik & Kişisel Bakım': 10,
  'Kozmetik': 10,
  'Elektronik': 10,
  'Bilgisayar & Tablet': 10,
  'Bilgisayar': 10,
  'Telefon & Aksesuar': 10,
  'Telefon': 10,
  'Beyaz Eşya': 10,
  'Ev & Yaşam': 10,
  'Mobilya': 7,
  'Anne & Bebek': 7,
  'Oyuncak & Hobi': 10,
  'Kitap & Kırtasiye': 3,
  'Kitap': 3,
  'Süpermarket & Gıda': 2,
  'Süpermarket': 2,
  'Otomotiv & Motosiklet': 7,
  'Spor & Outdoor': 10,
  'Spor': 10,
  'Diğer': 10,
}

// ----------------------------------------------------------------
// Marketplace Varsayilan Ayarlari
// ----------------------------------------------------------------

const MARKETPLACE_DEFAULTS: Record<MarketplaceName, Omit<CategoryDefaults, 'commissionPct' | 'returnRatePct'>> = {
  trendyol: { serviceFee: 8.49, vatPct: 20, payoutDelayDays: 28, n11ExtraPct: 0 },
  hepsiburada: { serviceFee: 9.50, vatPct: 20, payoutDelayDays: 30, n11ExtraPct: 0 },
  n11: { serviceFee: 0, vatPct: 20, payoutDelayDays: 21, n11ExtraPct: 1.87 },
  amazon_tr: { serviceFee: 0, vatPct: 20, payoutDelayDays: 14, n11ExtraPct: 0 },
  custom: { serviceFee: 0, vatPct: 20, payoutDelayDays: 14, n11ExtraPct: 0 },
}

const DEFAULT_COMMISSION: Record<MarketplaceName, number> = {
  trendyol: 18,
  hepsiburada: 20,
  n11: 16,
  amazon_tr: 17,
  custom: 0,
}

const DEFAULT_RETURN_RATE: Record<MarketplaceName, number> = {
  trendyol: 12,
  hepsiburada: 12,
  n11: 10,
  amazon_tr: 13,
  custom: 0,
}

// ----------------------------------------------------------------
// Servis
// ----------------------------------------------------------------

export class CommissionLogic {
  constructor(private readonly commissionRepo: CommissionRepository) {}

  /**
   * Varsayilan komisyon oranlarini dondurur.
   * payload: { marketplace: MarketplaceName }
   */
  async getDefaultRates(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<CommissionRate[]> {
    const { marketplace } = payload as { marketplace: MarketplaceName }

    const rates = DEFAULT_RATES[marketplace]
    if (!rates) {
      throw new ServiceError(`Bilinmeyen pazaryeri: ${marketplace}`, {
        code: 'UNKNOWN_MARKETPLACE',
        statusCode: 400,
        traceId,
      })
    }

    return Object.entries(rates).map(([category, rate]) => ({
      marketplace,
      category,
      rate,
    }))
  }

  /**
   * Kullanici ozellestirmis oranlarini dondurur.
   * FAZ5'te repository baglanacak.
   */
  async getUserRates(
    _traceId: string,
    payload: unknown,
    userId: string
  ): Promise<CommissionRate[]> {
    const { marketplace } = (payload ?? {}) as { marketplace?: MarketplaceName }
    const rows = await this.commissionRepo.getUserRates(userId, marketplace)
    return rows.map(r => ({ marketplace: r.marketplace as MarketplaceName, category: r.category, rate: r.rate }))
  }

  /**
   * Komisyon orani gunceller.
   * FAZ5'te repository baglanacak.
   */
  async updateRate(
    _traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ success: boolean }> {
    const { marketplace, category, rate } = payload as { marketplace: string; category: string; rate: number }
    await this.commissionRepo.upsertRate(userId, marketplace, category, rate)
    return { success: true }
  }

  /**
   * CSV'den toplu komisyon orani import eder.
   * FAZ5'te repository baglanacak.
   */
  async importFromCsv(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ imported: number; errors: string[] }> {
    const { csvContent } = payload as { csvContent: string }
    if (!csvContent) {
      throw new ServiceError('CSV icerigi bos', {
        code: 'EMPTY_CSV',
        statusCode: 400,
        traceId,
      })
    }

    const lines = csvContent.split('\n').filter(l => l.trim())
    const errors: string[] = []
    let imported = 0

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i]!.split(/[,;]/).map(p => p.trim())
      if (parts.length < 3) {
        errors.push(`Satir ${i + 1}: Yetersiz kolon`)
        continue
      }

      const rate = parseFloat(parts[2]!.replace(',', '.'))
      if (isNaN(rate) || rate < 0 || rate > 100) {
        errors.push(`Satir ${i + 1}: Gecersiz oran (${parts[2]})`)
        continue
      }

      await this.commissionRepo.upsertRate(userId, parts[0]!, parts[1]!, rate)
      imported++
    }

    return { imported, errors }
  }

  /**
   * Marketplace + kategori icin tam varsayilan ayarlari dondurur.
   */
  getCategoryDefaults(marketplace: MarketplaceName, category?: string): CategoryDefaults {
    const marketDefaults = MARKETPLACE_DEFAULTS[marketplace]
    const ratesMap = DEFAULT_RATES[marketplace] ?? {}
    const defaultRate = DEFAULT_COMMISSION[marketplace]

    let commissionPct = defaultRate
    if (category && ratesMap[category] !== undefined) {
      commissionPct = ratesMap[category]!
    }

    let returnRatePct = DEFAULT_RETURN_RATE[marketplace]
    if (category && CATEGORY_RETURN_RATES[category] !== undefined) {
      returnRatePct = CATEGORY_RETURN_RATES[category]!
    }
    // Amazon TR: tum kategorilere +3% iade orani
    if (marketplace === 'amazon_tr') {
      returnRatePct += 3
    }

    return {
      commissionPct,
      returnRatePct,
      ...marketDefaults,
    }
  }

  /**
   * Tum marketplace'lerin kategori listesini dondurur.
   */
  async getCategories(
    _traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<string[]> {
    const { marketplace } = payload as { marketplace: MarketplaceName }
    const rates = DEFAULT_RATES[marketplace]
    return rates ? Object.keys(rates) : []
  }
}

// Instance olusturma registry.ts'de yapilir (repo DI)

/**
 * Standalone helper — instance gerektirmeden kategori varsayilanlarini dondurur.
 * Saf hesaplama, DB bagimliligi yok.
 */
export function getCategoryDefaults(marketplace: MarketplaceName, category?: string): CategoryDefaults {
  const marketDefaults = MARKETPLACE_DEFAULTS[marketplace]
  const ratesMap = DEFAULT_RATES[marketplace] ?? {}
  const defaultRate = DEFAULT_COMMISSION[marketplace]

  let commissionPct = defaultRate
  if (category && ratesMap[category] !== undefined) {
    commissionPct = ratesMap[category]!
  }

  let returnRatePct = DEFAULT_RETURN_RATE[marketplace]
  if (category && CATEGORY_RETURN_RATES[category] !== undefined) {
    returnRatePct = CATEGORY_RETURN_RATES[category]!
  }
  if (marketplace === 'amazon_tr') {
    returnRatePct += 3
  }

  return {
    commissionPct,
    returnRatePct,
    ...marketDefaults,
  }
}
