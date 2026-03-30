import { requireAuth, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? undefined
    const filters = status ? { status } : {}

    const { initializeServices } = await import('@/services/registry')
    initializeServices()

    const { gateway } = await import('@/lib/gateway/gateway.adapter')
    const result = await gateway.handle('support' as ServiceName, 'listTickets', filters, user.id)

    if (!result.success) {
      return Response.json({ success: false, error: result.error ?? 'Bir hata oluştu' }, { status: 400 })
    }

    return Response.json({ success: true, data: result.data }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const body = await request.json()

    const { initializeServices } = await import('@/services/registry')
    initializeServices()

    const { gateway } = await import('@/lib/gateway/gateway.adapter')
    const result = await gateway.handle('support' as ServiceName, 'createTicket', body, user.id)

    if (!result.success) {
      return Response.json({ success: false, error: result.error ?? 'Bir hata oluştu' }, { status: 400 })
    }

    return Response.json({ success: true, data: result.data }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
