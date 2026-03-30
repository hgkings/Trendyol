import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, callGatewayV1Format } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'
import { UpdateTicketSchema } from '@/lib/validations/support'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  try {
    const body = await request.json()
    const parsed = UpdateTicketSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Doğrulama hatası', details: parsed.error.errors },
        { status: 422 }
      )
    }

    return callGatewayV1Format('support' as ServiceName, 'replyToTicket', {
      ticketId: params.id,
      ...parsed.data,
    }, auth.id)
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  try {
    await callGatewayV1Format('support' as ServiceName, 'deleteTicket', { ticketId: params.id }, auth.id)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}
