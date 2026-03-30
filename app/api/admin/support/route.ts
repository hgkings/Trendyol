import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''

  try {
    const supabase = createAdminClient()

    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data: tickets, error } = await query
    if (error) throw error

    const userIds = Array.from(new Set((tickets ?? []).map((t: Record<string, unknown>) => t.user_id as string)))
    let emailMap: Record<string, string> = {}

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)

      emailMap = Object.fromEntries((profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p.email as string]))
    }

    const result = (tickets ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      profiles: { email: emailMap[t.user_id as string] ?? t.user_id },
    }))

    return NextResponse.json({ tickets: result })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  try {
    const { id, status, admin_note } = await req.json()
    if (!id) return NextResponse.json({ success: false, error: 'id zorunludur' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (status !== undefined) updates.status = status
    if (admin_note !== undefined) updates.admin_note = admin_note

    const supabase = createAdminClient()
    const { error } = await supabase.from('support_tickets').update(updates).eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}
