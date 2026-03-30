import { NextRequest } from 'next/server'
import { requireAdmin, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? undefined
    const page = parseInt(searchParams.get('page') ?? '1')

    return callGatewayV1Format('payment', 'listPayments', { status, page, limit: 20 }, auth.id)
  } catch (error) {
    return errorResponse(error)
  }
}
