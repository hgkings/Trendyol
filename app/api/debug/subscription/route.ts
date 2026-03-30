import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// TODO: callGatewayV1Format ile değiştirilecek
export async function GET(req: Request) {
  // Block in production
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Bu endpoint production ortamında devre dışıdır.' }, { status: 404 })
  }

  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  const email = url.searchParams.get('email')

  if (!userId && !email) {
    return NextResponse.json({ error: 'Pass ?userId=xxx or ?email=xxx' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  let query = adminClient.from('profiles').select('id, email, plan, plan_expires_at, pro_until, updated_at')
  if (userId) query = query.eq('id', userId)
  else if (email) query = query.eq('email', email as string)

  const { data: profile, error } = await query.maybeSingle()

  let payment = null
  if (profile) {
    const { data: p } = await adminClient
      .from('payments')
      .select('id, plan, status, paid_at, provider_order_id, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    payment = p
  }

  return NextResponse.json({
    profile: profile || null,
    latestPayment: payment || null,
    error: error?.message || null,
  })
}
