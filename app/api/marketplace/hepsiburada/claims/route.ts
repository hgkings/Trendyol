import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('gun') ?? '90')

    return callGatewayV1Format('marketplace' as ServiceName, 'getHepsiburadaClaims', { days }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
