import { requireAuth, callGatewayV1Format, resolveConnectionId, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const connectionId = await resolveConnectionId(user.id, 'trendyol')
    if (connectionId instanceof Response) return connectionId

    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch (_parseError) {
      // empty body is fine — days defaults to 30
    }

    return callGatewayV1Format('marketplace' as ServiceName, 'syncTrendyolOrders', {
      connectionId,
      days: body.days,
    }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
