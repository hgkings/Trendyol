import { NextRequest } from 'next/server'
import { requireCronSecret, callGatewayV1Format } from '@/lib/api/helpers'
import { auditLog, generateTraceId } from '@/lib/security/audit'

export async function GET(request: NextRequest) {
  const cronCheck = requireCronSecret(request)
  if (cronCheck !== true) return cronCheck

  void auditLog({
    action: 'user.checkProExpiry',
    userId: null,
    traceId: generateTraceId(),
    metadata: { trigger: 'cron' },
  })

  return callGatewayV1Format('user', 'checkProExpiry', {}, 'system')
}
