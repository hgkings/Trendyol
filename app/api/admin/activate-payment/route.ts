import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ActivatePaymentSchema = z.object({
  paymentId: z.string().uuid('Geçerli bir ödeme ID\'si gerekli'),
})

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  try {
    const body = await req.json()
    const parsed = ActivatePaymentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Doğrulama hatası', details: parsed.error.errors },
        { status: 422 }
      )
    }

    const { paymentId } = parsed.data
    const adminClient = createAdminClient()

    const { data: payment, error: payErr } = await adminClient
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (payErr || !payment) {
      return NextResponse.json({ error: 'Ödeme bulunamadı' }, { status: 404 })
    }

    const planType = (payment.plan as string) || 'pro_monthly'
    const daysToAdd = planType === 'pro_yearly' || planType === 'starter_yearly' ? 365 : 30
    const proUntil = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString()

    const isPro = ['pro', 'pro_monthly', 'pro_yearly'].includes(planType)

    await adminClient
      .from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', paymentId)

    const { error: profileErr } = await adminClient
      .from('profiles')
      .update({
        plan: isPro ? 'pro' : 'starter',
        is_pro: isPro,
        plan_type: planType,
        pro_until: proUntil,
        pro_started_at: new Date().toISOString(),
        pro_expires_at: proUntil,
        pro_renewal: false,
      })
      .eq('id', payment.user_id)

    if (profileErr) {
      return NextResponse.json({ error: 'Profil güncellenemedi: ' + profileErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user_id: payment.user_id, pro_until: proUntil })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
