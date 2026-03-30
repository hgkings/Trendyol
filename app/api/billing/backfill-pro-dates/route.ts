import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    return callGatewayV1Format('payment', 'backfillProDates', {}, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}
