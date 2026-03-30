import { requireAuth, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const { initializeServices } = await import('@/services/registry')
    initializeServices()

    const { gateway } = await import('@/lib/gateway/gateway.adapter')
    const result = await gateway.handle('analysis' as ServiceName, 'list', {}, user.id)

    if (!result.success) {
      return Response.json({ error: result.error ?? 'İşlem başarısız' }, { status: 400 })
    }

    const analyses = Array.isArray(result.data) ? result.data : []
    return Response.json({ count: analyses.length })
  } catch (error) {
    return errorResponse(error)
  }
}
