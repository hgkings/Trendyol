import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const plan = searchParams.get('plan') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20
  const offset = (page - 1) * limit

  try {
    const supabase = createAdminClient()

    let countQuery = supabase.from('profiles').select('*', { count: 'exact', head: true })
    let dataQuery = supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      countQuery = countQuery.ilike('email', `%${search}%`)
      dataQuery = dataQuery.ilike('email', `%${search}%`)
    }
    if (plan) {
      countQuery = countQuery.eq('plan', plan)
      dataQuery = dataQuery.eq('plan', plan)
    }

    const { count } = await countQuery
    const { data } = await dataQuery

    return NextResponse.json({ users: data ?? [], total: count ?? 0, page, limit })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  try {
    const { userId, plan, pro_until } = await req.json()
    if (!userId || !plan) {
      return NextResponse.json({ success: false, error: 'userId ve plan zorunludur' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { plan }
    if (pro_until !== undefined) updates.pro_until = pro_until
    if (plan === 'pro' && !pro_until) {
      updates.pro_until = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      updates.pro_started_at = new Date().toISOString()
      updates.pro_expires_at = updates.pro_until
    }
    if (plan === 'free') {
      updates.pro_until = null
      updates.pro_expires_at = null
      updates.pro_started_at = null
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}
