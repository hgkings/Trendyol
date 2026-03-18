import { z } from 'zod'

const TICKET_CATEGORIES = ['teknik', 'odeme', 'hesap', 'oneri', 'diger'] as const
const TICKET_PRIORITIES = ['dusuk', 'normal', 'yuksek', 'acil'] as const
const TICKET_STATUSES = ['acik', 'inceleniyor', 'cevaplandi', 'kapali'] as const

const MIN_MESSAGE_LENGTH = 20
const MAX_MESSAGE_LENGTH = 5000
const MAX_SUBJECT_LENGTH = 200

export const CreateTicketSchema = z.object({
  subject: z.string()
    .min(1, 'Konu zorunludur')
    .max(MAX_SUBJECT_LENGTH, `Konu en fazla ${MAX_SUBJECT_LENGTH} karakter olabilir`),
  category: z.enum(TICKET_CATEGORIES, {
    errorMap: () => ({ message: 'Geçersiz kategori' })
  }),
  priority: z.enum(TICKET_PRIORITIES, {
    errorMap: () => ({ message: 'Geçersiz öncelik' })
  }),
  message: z.string()
    .min(MIN_MESSAGE_LENGTH, `Mesaj en az ${MIN_MESSAGE_LENGTH} karakter olmalıdır`)
    .max(MAX_MESSAGE_LENGTH, `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir`)
})

export const UpdateTicketSchema = z.object({
  admin_reply: z.string().min(1, 'Cevap boş olamaz').optional(),
  status: z.enum(TICKET_STATUSES).optional()
}).refine(data => data.admin_reply || data.status, {
  message: 'En az bir alan güncellenmelidir'
})

export const TicketFilterSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  search: z.string().max(200).optional()
})
