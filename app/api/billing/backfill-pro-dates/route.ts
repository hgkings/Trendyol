import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// TODO: callGatewayV1Format ile değiştirilecek
export async function POST() {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('plan, created_at, paid_at')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (paymentError || !payment) {
      return NextResponse.json({ ok: false, reason: 'no_payment_found' })
    }

    const startedAt = payment.paid_at || payment.created_at
    const d = new Date(startedAt)
    const isYearly = payment.plan === 'pro_yearly'
    d.setDate(d.getDate() + (isYearly ? 365 : 30))
    const expiresAt = d.toISOString()

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        pro_started_at: startedAt,
        pro_expires_at: expiresAt,
        pro_renewal: false,
      })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ ok: false, reason: 'update_failed', error: updateError.message })
    }

    return NextResponse.json({
      ok: true,
      pro_expires_at: expiresAt,
      pro_started_at: startedAt,
      pro_renewal: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sunucu hatası'
    return NextResponse.json({ ok: false, reason: 'server_error', error: message }, { status: 500 })
  }
}
