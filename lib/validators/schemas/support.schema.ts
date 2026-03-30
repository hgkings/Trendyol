import { z } from 'zod'

export const CreateTicketSchema = z.object({
  subject: z.string().min(1).max(200, 'Konu en fazla 200 karakter olabilir'),
  category: z.enum(['teknik', 'odeme', 'hesap', 'oneri', 'diger']),
  priority: z.enum(['dusuk', 'normal', 'yuksek', 'acil']).default('normal'),
  message: z.string()
    .min(20, 'Mesaj en az 20 karakter olmalıdır')
    .max(5000, 'Mesaj en fazla 5000 karakter olabilir'),
})

export const TicketFilterSchema = z.object({
  status: z.enum(['acik', 'inceleniyor', 'cevaplandi', 'kapali']).optional(),
  priority: z.enum(['dusuk', 'normal', 'yuksek', 'acil']).optional(),
  category: z.enum(['teknik', 'odeme', 'hesap', 'oneri', 'diger']).optional(),
  search: z.string().max(200).optional(),
})

export const AdminReplySchema = z.object({
  admin_reply: z.string().min(1, 'Cevap boş olamaz'),
  status: z.enum(['acik', 'inceleniyor', 'cevaplandi', 'kapali']).optional(),
})