import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    return callGatewayV1Format('marketplace' as ServiceName, 'testHepsiburada', {}, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
