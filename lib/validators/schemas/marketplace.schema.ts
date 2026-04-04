import { z } from 'zod'

export const ConnectMarketplaceSchema = z.object({
  marketplace: z.enum(['trendyol', 'hepsiburada']),
  apiKey: z.string().trim().min(1, 'API anahtarı zorunludur').max(500),
  apiSecret: z.string().trim().min(1, 'API secret zorunludur').max(500),
  sellerId: z.string().trim().min(1, 'Satıcı ID zorunludur').max(200),
  storeName: z.string().trim().max(200).optional(),
}).strict()

export const DisconnectMarketplaceSchema = z.object({
  connectionId: z.string().uuid(),
}).strict()

/** Sipariş durum güncelleme (Picking veya Invoiced) */
export const UpdatePackageStatusSchema = z.object({
  connectionId: z.string().uuid(),
  packageId: z.number().int().positive(),
  status: z.enum(['Picking', 'Invoiced']),
  lines: z.array(z.object({
    lineId: z.number().int(),
    quantity: z.number().int().positive(),
  })).min(1),
  invoiceNumber: z.string().regex(/^[A-Z]{3}\d{13}$/, 'Fatura numarası 3 harf + 13 rakam olmalıdır').optional(),
}).strict()

/** Tedarik edilemez (sipariş iptali) */
export const MarkUnsuppliedSchema = z.object({
  connectionId: z.string().uuid(),
  packageId: z.number().int().positive(),
  lines: z.array(z.object({
    lineId: z.number().int(),
    quantity: z.number().int().positive(),
  })).min(1),
  reasonId: z.number().int().refine(
    val => [500, 501, 502, 504, 505, 506].includes(val),
    'Geçersiz sebep kodu'
  ),
}).strict()

/** Stok ve fiyat güncelleme */
export const UpdateStockPriceSchema = z.object({
  connectionId: z.string().uuid(),
  items: z.array(z.object({
    barcode: z.string().min(1).max(40),
    quantity: z.number().int().min(0).max(20000).optional(),
    salePrice: z.number().positive().optional(),
    listPrice: z.number().positive().optional(),
  })).min(1).max(1000),
}).strict()

/** İade onay */
export const ApproveClaimSchema = z.object({
  connectionId: z.string().uuid(),
  claimId: z.string().min(1),
  claimLineItemIdList: z.array(z.string().min(1)).min(1),
}).strict()

/** İade red */
export const RejectClaimSchema = z.object({
  connectionId: z.string().uuid(),
  claimId: z.string().min(1),
  claimIssueReasonId: z.number().int().positive(),
  claimItemIdList: z.array(z.string().min(1)).min(1),
  description: z.string().min(1).max(500),
}).strict()

/** Soru yanıtlama */
export const AnswerQuestionSchema = z.object({
  connectionId: z.string().uuid(),
  questionId: z.number().int().positive(),
  text: z.string().min(10, 'Yanıt en az 10 karakter olmalıdır').max(2000, 'Yanıt en fazla 2000 karakter olabilir'),
}).strict()

/** Fatura link gönderme */
export const SendInvoiceLinkSchema = z.object({
  connectionId: z.string().uuid(),
  shipmentPackageId: z.number().int().positive(),
  invoiceLink: z.string().url(),
  invoiceNumber: z.string().regex(/^[A-Z]{3}\d{13}$/, 'Fatura numarası 3 harf + 13 rakam olmalıdır'),
  invoiceDateTime: z.number().int().positive(),
}).strict()
