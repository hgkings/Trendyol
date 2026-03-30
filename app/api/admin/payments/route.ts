import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20
  const offset = (page - 1) * limit

  try {
    const supabase = createAdminClient()

    let query = supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: payments, count } = await query

    const userIds = Array.from(new Set((payments ?? []).map((p: Record<string, unknown>) => p.user_id as string)))

    let profiles: Record<string, unknown>[] = []
    if (userIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)
      profiles = (data ?? []) as Record<string, unknown>[]
    }

    const emailMap: Record<string, string> = Object.fromEntries(
      profiles.map((p) => [p.id as string, p.email as string])
    )

    const result = (payments ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      profiles: { email: emailMap[p.user_id as string] ?? null },
    }))

    return NextResponse.json({ payments: result, total: count, page, limit })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}
