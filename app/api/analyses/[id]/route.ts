import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user
    return callGatewayV1Format('analysis' as ServiceName, 'getById', { id: params.id }, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user
    const body = await request.json()
    return callGatewayV1Format('analysis' as ServiceName, 'create', { input: { ...body, id: params.id } }, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user
    return callGatewayV1Format('analysis' as ServiceName, 'delete', { id: params.id }, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}
