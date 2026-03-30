import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user
    return callGatewayV1Format('analysis', 'list', {}, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user
    const body = await request.json()

    // V1 UI tam hesaplanmis Analysis objesi gonderir (id, input, result, risk)
    if (body.id && body.input && body.result && body.risk) {
      return callGatewayV1Format('analysis', 'upsertFull', body, user.id)
    }

    // Gateway uzerinden olustur (camelCase input beklenir)
    return callGatewayV1Format('analysis', 'create', { input: body }, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}
