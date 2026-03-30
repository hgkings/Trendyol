import { callGatewayV1Format, errorResponse } from '@/lib/api/helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return callGatewayV1Format('payment', 'testCallback', {}, 'system')
  } catch (error) {
    return errorResponse(error)
  }
}
