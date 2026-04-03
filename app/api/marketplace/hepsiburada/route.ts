import { requireAuth, callGatewayV1Format, resolveConnectionId, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'
import { ConnectMarketplaceSchema } from '@/lib/validators/schemas/marketplace.schema'

export const dynamic = 'force-dynamic'

// ─── GET: Fetch Hepsiburada connection status ───
export async function GET() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    return callGatewayV1Format('marketplace' as ServiceName, 'getStatus', { marketplace: 'hepsiburada' }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}

// ─── POST: Save Hepsiburada credentials ───
export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const body = await req.json()

    const parsed = ConnectMarketplaceSchema.safeParse({ ...body, marketplace: 'hepsiburada' })
    if (!parsed.success) {
      return Response.json(
        { success: false, error: 'Doğrulama hatası', details: parsed.error.errors },
        { status: 422 }
      )
    }

    return callGatewayV1Format('marketplace' as ServiceName, 'connect', parsed.data, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}

// ─── DELETE: Disconnect Hepsiburada ───
export async function DELETE() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const connectionId = await resolveConnectionId(user.id, 'hepsiburada')
    if (connectionId instanceof Response) {
      return Response.json({ success: true })
    }

    return callGatewayV1Format('marketplace' as ServiceName, 'disconnect', { connectionId }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
