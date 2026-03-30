import { NextRequest } from 'next/server'
import { requireAdmin, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? undefined

    return callGatewayV1Format('support', 'listAllTickets', { status }, auth.id)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    const body = await req.json()
    const { id, status, admin_note } = body as { id?: string; status?: string; admin_note?: string }

    if (!id) {
      return Response.json({ success: false, error: 'id zorunludur' }, { status: 400 })
    }

    return callGatewayV1Format('support', 'replyToTicket', {
      ticketId: id,
      status,
      admin_reply: admin_note,
    }, auth.id)
  } catch (error) {
    return errorResponse(error)
  }
}
