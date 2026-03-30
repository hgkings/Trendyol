import { NextRequest } from 'next/server'
import { requireCronSecret, callGatewayV1Format } from '@/lib/api/helpers'

export async function GET(request: NextRequest) {
  const cronCheck = requireCronSecret(request)
  if (cronCheck !== true) return cronCheck

  return callGatewayV1Format('user', 'checkProExpiry', {}, 'system')
}
