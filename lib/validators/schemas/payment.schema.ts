import { z } from 'zod'

// Minimal iskelet — FAZ8'de genisletilecek.

export const ActivatePaymentSchema = z.object({
  paymentId: z.string().uuid(),
})