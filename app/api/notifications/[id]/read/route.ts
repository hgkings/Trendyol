import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user
    return callGatewayV1Format('notification' as ServiceName, 'markAsRead', { notificationId: params.id }, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}
