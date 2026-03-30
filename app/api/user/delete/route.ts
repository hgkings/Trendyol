import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import { auditLog, generateTraceId } from '@/lib/security/audit'

export async function DELETE() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    void auditLog({
      action: 'user.delete_account',
      userId: user.id,
      traceId: generateTraceId(),
    })

    return callGatewayV1Format('user', 'deleteAccount', {}, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}
