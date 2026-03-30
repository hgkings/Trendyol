import { callGatewayV1Format, errorResponse } from '@/lib/api/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const paymentId = searchParams.get('paymentId')

    if (!paymentId) {
      return Response.json({ error: 'paymentId gerekli' }, { status: 400 })
    }

    // Payment check does not require user auth — public polling endpoint
    return callGatewayV1Format('payment', 'checkPayment', { paymentId }, 'system')
  } catch (error) {
    return errorResponse(error)
  }
}
