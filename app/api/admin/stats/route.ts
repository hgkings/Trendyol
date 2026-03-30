import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

// TODO: callGatewayV1Format ile değiştirilecek
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  try {
    const adminClient = createAdminClient()

    const [
      { count: totalUsers },
      { count: proUsers },
      { count: totalAnalyses },
      { data: payments },
      { count: totalTickets },
      { count: openTickets },
      { data: recentUsers },
    ] = await Promise.all([
      adminClient.from('profiles').select('*', { count: 'exact', head: true }),
      adminClient.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
      adminClient.from('analyses').select('*', { count: 'exact', head: true }),
      adminClient.from('payments').select('amount_try, status').eq('status', 'paid'),
      adminClient.from('tickets').select('*', { count: 'exact', head: true }),
      adminClient.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'acik'),
      adminClient.from('profiles').select('id, email, plan, created_at').order('created_at', { ascending: false }).limit(5),
    ])

    const totalRevenue = payments?.reduce((sum, p) => sum + ((p.amount_try as number) || 0), 0) ?? 0

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      proUsers: proUsers ?? 0,
      freeUsers: (totalUsers ?? 0) - (proUsers ?? 0),
      totalAnalyses: totalAnalyses ?? 0,
      totalRevenue,
      totalTickets: totalTickets ?? 0,
      openTickets: openTickets ?? 0,
      recentUsers: recentUsers ?? [],
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Bir hata oluştu' }, { status: 500 })
  }
}
