import { requireAuth, callGatewayV1Format, resolveConnectionId, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/marketplace/trendyol/enrich
 * Sipariş + iade verilerinden gerçek komisyon, iade oranı ve aylık satış
 * adedini çıkararak mevcut analizleri otomatik günceller.
 */
export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const connectionId = await resolveConnectionId(user.id, 'trendyol')
    if (connectionId instanceof Response) return connectionId

    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch (_) {
      // empty body — days defaults to 90
    }

    return callGatewayV1Format('marketplace' as ServiceName, 'enrichAnalysesWithRealData', {
      connectionId,
      marketplace: 'trendyol',
      days: body.days ?? 90,
    }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
