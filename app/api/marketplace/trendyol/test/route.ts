import { NextResponse } from 'next/server'
import { requireAuth, callGatewayV1Format, resolveConnectionId, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function POST() {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL === '1') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const connectionId = await resolveConnectionId(user.id, 'trendyol')
    if (connectionId instanceof Response) return connectionId

    return callGatewayV1Format('marketplace' as ServiceName, 'testTrendyol', { connectionId }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
