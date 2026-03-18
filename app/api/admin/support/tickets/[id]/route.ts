import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server-client'
import { replyToTicket, deleteTicket } from '@/lib/support-service'
import { UpdateTicketSchema } from '@/lib/validations/support'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  if (profile?.plan !== 'admin') return null
  return user
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = UpdateTicketSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Doğrulama hatası', details: parsed.error.errors },
        { status: 422 }
      )
    }

    const ticket = await replyToTicket(params.id, parsed.data)
    return NextResponse.json({ success: true, data: ticket }, { status: 200 })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkiniz yok' }, { status: 403 })
    }

    await deleteTicket(params.id)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}
