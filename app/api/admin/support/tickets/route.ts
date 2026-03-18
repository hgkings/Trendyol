import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server-client'
import { getAllTickets, getTicketStats } from '@/lib/support-service'
import { TicketFilterSchema } from '@/lib/validations/support'

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

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    if (searchParams.get('stats') === '1') {
      const stats = await getTicketStats()
      return NextResponse.json({ success: true, data: stats }, { status: 200 })
    }

    const filterParsed = TicketFilterSchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      priority: searchParams.get('priority') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    })

    const filters = filterParsed.success ? filterParsed.data : {}
    const tickets = await getAllTickets(filters)
    return NextResponse.json({ success: true, data: tickets }, { status: 200 })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}
