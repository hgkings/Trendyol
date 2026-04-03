import { requireAuth, callGatewayV1Format, resolveConnectionId, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const connectionId = await resolveConnectionId(user.id, 'hepsiburada')
    if (connectionId instanceof Response) return connectionId

    return callGatewayV1Format('marketplace' as ServiceName, 'syncHepsiburadaProducts', { connectionId }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
