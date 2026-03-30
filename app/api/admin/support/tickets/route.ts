import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, callGatewayV1Format } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'
import { TicketFilterSchema } from '@/lib/validations/support'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  try {
    const { searchParams } = new URL(request.url)

    if (searchParams.get('stats') === '1') {
      return callGatewayV1Format('support' as ServiceName, 'getTicketStats', {}, auth.id)
    }

    const filterParsed = TicketFilterSchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      priority: searchParams.get('priority') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    })

    const filters = filterParsed.success ? filterParsed.data : {}
    return callGatewayV1Format('support' as ServiceName, 'listAllTickets', { ...filters }, auth.id)
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}
