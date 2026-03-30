import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user
    return callGatewayV1Format('user' as ServiceName, 'getProfile', {}, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user
    const body = await request.json()
    return callGatewayV1Format('user' as ServiceName, 'updateProfile', body, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}
