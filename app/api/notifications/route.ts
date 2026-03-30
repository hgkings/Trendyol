import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user
    return callGatewayV1Format('notification' as ServiceName, 'list', {}, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user
    const body = await request.json()
    const notifications = Array.isArray(body) ? body : [body]
    return callGatewayV1Format('notification' as ServiceName, 'create', { notifications }, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}
