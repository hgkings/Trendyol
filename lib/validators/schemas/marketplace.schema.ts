import { z } from 'zod'

export const ConnectMarketplaceSchema = z.object({
  marketplace: z.enum(['trendyol', 'hepsiburada']),
  apiKey: z.string().min(1, 'API anahtarı zorunludur'),
  apiSecret: z.string().min(1, 'API secret zorunludur'),
  sellerId: z.string().min(1, 'Satıcı ID zorunludur'),
  storeName: z.string().optional(),
})

export const DisconnectMarketplaceSchema = z.object({
  connectionId: z.string().uuid(),
})