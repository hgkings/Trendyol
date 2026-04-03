import { requireAuth, callGatewayV1Format, resolveConnectionId, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const connectionId = await resolveConnectionId(user.id, 'trendyol')
    if (connectionId instanceof Response) return connectionId

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('gun') ?? '30')
    const startDate = searchParams.get('startDate') ?? undefined
    const endDate = searchParams.get('endDate') ?? undefined

    return callGatewayV1Format('marketplace' as ServiceName, 'getTrendyolFinance', {
      connectionId, days, startDate, endDate,
    }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
