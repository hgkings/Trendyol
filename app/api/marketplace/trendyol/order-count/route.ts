import { requireAuth, callGatewayWithSuccess, resolveConnectionId, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/marketplace/trendyol/order-count?gun=30
 * Trendyol'dan toplam sipariş sayısını döner (hafif — DB'ye yazmaz).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const connectionId = await resolveConnectionId(user.id, 'trendyol')
    if (connectionId instanceof Response) return connectionId

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('gun') ?? '30')

    return callGatewayWithSuccess('marketplace' as ServiceName, 'getOrderCount', { connectionId, days }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
