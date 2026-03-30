import { z } from 'zod'

export const AnalysisInputSchema = z.object({
  productName: z.string().min(1, 'Ürün adı zorunludur'),
  marketplace: z.enum(['trendyol', 'hepsiburada', 'n11', 'amazon_tr', 'custom']),
  category: z.string().optional(),
  salePrice: z.number().positive('Satış fiyatı 0\'dan büyük olmalıdır'),
  productCost: z.number().min(0),
  shippingCost: z.number().min(0),
  packagingCost: z.number().min(0),
  adCostPerSale: z.number().min(0),
  otherCost: z.number().min(0),
  commissionPct: z.number().min(0).max(100),
  returnRatePct: z.number().min(0).max(100),
  vatPct: z.number().min(0).max(100),
  monthlySalesVolume: z.number().int().min(0),
  payoutDelayDays: z.number().int().min(0),
  serviceFeeAmount: z.number().min(0),
  n11ExtraPct: z.number().min(0).max(100),
})

export const AnalysisUpdateSchema = AnalysisInputSchema.partial()

export const RequiredPricePayloadSchema = z.object({
  input: AnalysisInputSchema,
  targetMarginRate: z.number().optional(),
  targetProfitPerUnit: z.number().optional(),
})

export const AnalysisDefaultsSchema = z.object({
  marketplace: z.enum(['trendyol', 'hepsiburada', 'n11', 'amazon_tr', 'custom']),
  category: z.string().optional(),
})