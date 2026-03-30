import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const UpdateUserPlanSchema = z.object({
  userId: z.string().uuid('Geçerli bir kullanıcı ID\'si gerekli'),
  plan: z.enum(['free', 'starter', 'starter_monthly', 'starter_yearly', 'pro', 'pro_monthly', 'pro_yearly', 'admin']),
  pro_until: z.string().optional(),
})

const PRO_PLANS = ['pro', 'pro_monthly', 'pro_yearly']
const STARTER_PLANS = ['starter', 'starter_monthly', 'starter_yearly']

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

    // Plan filtresi: pro/starter grubu veya tekil plan
    if (plan === 'pro') {
      countQuery = countQuery.in('plan', PRO_PLANS)
      dataQuery = dataQuery.in('plan', PRO_PLANS)
    } else if (plan === 'starter') {
      countQuery = countQuery.in('plan', STARTER_PLANS)
      dataQuery = dataQuery.in('plan', STARTER_PLANS)
    } else if (plan) {
      countQuery = countQuery.eq('plan', plan)
      dataQuery = dataQuery.eq('plan', plan)
    }

    const { count } = await countQuery
    const { data } = await dataQuery

    return NextResponse.json({ users: data ?? [], total: count ?? 0, page, limit })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json({ success: false, error: 'Bir hata oluştu', message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  try {
    const body = await req.json()
    const parsed = UpdateUserPlanSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Doğrulama hatası', details: parsed.error.errors },
        { status: 422 }
      )
    }

    const { userId, plan, pro_until } = parsed.data
    const updates: Record<string, unknown> = { plan }

    if (PRO_PLANS.includes(plan)) {
      updates.is_pro = true
      if (!pro_until) {
        updates.pro_until = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        updates.pro_started_at = new Date().toISOString()
        updates.pro_expires_at = updates.pro_until
      } else {
        updates.pro_until = pro_until
        updates.pro_expires_at = pro_until
      }
    } else if (STARTER_PLANS.includes(plan)) {
      updates.is_pro = false
      if (!pro_until) {
        updates.pro_until = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        updates.pro_started_at = new Date().toISOString()
        updates.pro_expires_at = updates.pro_until
      } else {
        updates.pro_until = pro_until
        updates.pro_expires_at = pro_until
      }
    } else if (plan === 'admin') {
      updates.is_pro = true
    } else {
      // free plan
      updates.is_pro = false
      updates.pro_until = null
      updates.pro_expires_at = null
      updates.pro_started_at = null
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json({ success: false, error: 'Bir hata oluştu', message }, { status: 500 })
  }
}
