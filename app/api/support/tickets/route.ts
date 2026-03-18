import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server-client'
import { createTicket, getUserTickets } from '@/lib/support-service'
import { CreateTicketSchema, TicketFilterSchema } from '@/lib/validations/support'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateTicketSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Doğrulama hatası', details: parsed.error.errors },
        { status: 422 }
      )
    }

    const ticket = await createTicket(user.id, user.email ?? '', parsed.data)
    return NextResponse.json({ success: true, data: ticket }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filterParsed = TicketFilterSchema.safeParse({
      status: searchParams.get('status') ?? undefined,
    })

    const filters = filterParsed.success ? filterParsed.data : {}
    const tickets = await getUserTickets(user.id, filters)
    return NextResponse.json({ success: true, data: tickets }, { status: 200 })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}
