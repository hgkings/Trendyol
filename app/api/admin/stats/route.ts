import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  try {
    const adminClient = createAdminClient()

    const [
      { count: totalUsers },
      { count: proUsers },
      { count: starterUsers },
      { count: totalAnalyses },
      { data: payments },
      { count: totalTickets },
      { count: openTickets },
      { data: recentUsers },
    ] = await Promise.all([
      adminClient.from('profiles').select('*', { count: 'exact', head: true }),
      adminClient.from('profiles').select('*', { count: 'exact', head: true }).in('plan', ['pro', 'pro_monthly', 'pro_yearly']),
      adminClient.from('profiles').select('*', { count: 'exact', head: true }).in('plan', ['starter', 'starter_monthly', 'starter_yearly']),
      adminClient.from('analyses').select('*', { count: 'exact', head: true }),
      adminClient.from('payments').select('amount_try, status').eq('status', 'paid'),
      adminClient.from('support_tickets').select('*', { count: 'exact', head: true }),
      adminClient.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'acik'),
      adminClient.from('profiles').select('id, email, plan, created_at').order('created_at', { ascending: false }).limit(5),
    ])

    const totalRevenue = payments?.reduce((sum, p) => sum + ((p.amount_try as number) || 0), 0) ?? 0
    const paidCount = (proUsers ?? 0) + (starterUsers ?? 0)
    const freeCount = (totalUsers ?? 0) - paidCount

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      proUsers: proUsers ?? 0,
      starterUsers: starterUsers ?? 0,
      freeUsers: freeCount,
      totalAnalyses: totalAnalyses ?? 0,
      totalRevenue,
      totalTickets: totalTickets ?? 0,
      openTickets: openTickets ?? 0,
      recentUsers: recentUsers ?? [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json({ success: false, error: 'Bir hata oluştu', message }, { status: 500 })
  }
}
