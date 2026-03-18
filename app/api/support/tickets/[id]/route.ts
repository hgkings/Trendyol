import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server-client'
import { getTicketById } from '@/lib/support-service'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const ticket = await getTicketById(params.id, user.id)

    if (!ticket) {
      return NextResponse.json({ success: false, error: 'Talep bulunamadı' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: ticket }, { status: 200 })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}
