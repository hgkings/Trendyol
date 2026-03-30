import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      // empty body is fine
    }

    return callGatewayV1Format('marketplace' as ServiceName, 'syncTrendyolOrders', body, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
