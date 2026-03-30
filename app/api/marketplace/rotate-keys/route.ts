import { requireAdmin, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

/**
 * Key rotation endpoint — Admin only.
 * Re-encrypts all marketplace_secrets with the current MARKETPLACE_SECRET_KEY.
 */
export async function POST() {
  try {
    const admin = await requireAdmin()
    if (admin instanceof Response) return admin

    return callGatewayV1Format('marketplace' as ServiceName, 'rotateKeys', {}, admin.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
