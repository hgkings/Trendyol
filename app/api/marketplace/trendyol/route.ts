import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

// ─── GET: Fetch connection status ───
export async function GET() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    return callGatewayV1Format('marketplace' as ServiceName, 'getStatus', { marketplace: 'trendyol' }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}

// ─── POST: Save credentials (encrypt & store) ───
export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const body = await req.json()
    return callGatewayV1Format('marketplace' as ServiceName, 'connect', { ...body, marketplace: 'trendyol' }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}

// ─── DELETE: Disconnect ───
export async function DELETE() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    return callGatewayV1Format('marketplace' as ServiceName, 'disconnect', { marketplace: 'trendyol' }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
