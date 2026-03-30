import { requireAuth, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const { initializeServices } = await import('@/services/registry')
    initializeServices()

    const { gateway } = await import('@/lib/gateway/gateway.adapter')
    const result = await gateway.handle('support' as ServiceName, 'getTicket', { ticketId: params.id }, user.id)

    if (!result.success) {
      return Response.json({ success: false, error: result.error ?? 'Talep bulunamadı' }, { status: 404 })
    }

    return Response.json({ success: true, data: result.data }, { status: 200 })
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
    const method = body.action === 'close' ? 'closeTicket' : 'replyToTicket'

    const { initializeServices } = await import('@/services/registry')
    initializeServices()

    const { gateway } = await import('@/lib/gateway/gateway.adapter')
    const result = await gateway.handle('support' as ServiceName, method, { ...body, ticketId: params.id }, user.id)

    if (!result.success) {
      return Response.json({ success: false, error: result.error ?? 'Bir hata oluştu' }, { status: 400 })
    }

    return Response.json({ success: true, data: result.data }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
