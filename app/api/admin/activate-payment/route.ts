import { requireAdmin, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ActivatePaymentSchema = z.object({
  paymentId: z.string().uuid('Geçerli bir ödeme ID\'si gerekli'),
})

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    const body = await req.json()
    const parsed = ActivatePaymentSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { success: false, error: 'Doğrulama hatası', details: parsed.error.errors },
        { status: 422 }
      )
    }

    return callGatewayV1Format('payment', 'activatePaymentManually', parsed.data, auth.id)
  } catch (error) {
    return errorResponse(error)
  }
}
