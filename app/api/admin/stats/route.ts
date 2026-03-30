import { requireAdmin, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    return callGatewayV1Format('user', 'getAdminStats', {}, auth.id)
  } catch (error) {
    return errorResponse(error)
  }
}
