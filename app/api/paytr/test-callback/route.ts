import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = createAdminClient();

        // 1. En son payment kaydını bul
        const { data: payment, error: fetchErr } = await supabase
            .from('payments')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (fetchErr || !payment) {
            return NextResponse.json({ success: false, message: 'Payment kaydı bulunamadı', error: fetchErr }, { status: 404 });
        }

        // 2. Payment kaydını güncelle
        const { error: payUpdateErr } = await supabase
            .from('payments')
            .update({
                paid_at: new Date().toISOString(),
                raw_payload: { status: 'success', test: true },
                status: 'paid',
            })
            .eq('id', payment.id);

        if (payUpdateErr) {
            return NextResponse.json({ success: false, message: 'Payment güncellenemedi', error: payUpdateErr }, { status: 500 });
        }

        // 3. Profili Pro yap (plan_type'ı payment kaydından al)
        const planType = payment.plan || 'pro_monthly';
        const daysToAdd = planType === 'pro_yearly' ? 365 : 30;
        const proUntil = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

        const { error: profileErr } = await supabase
            .from('profiles')
            .update({
                plan: 'pro',
                is_pro: true,
                plan_type: planType,
                pro_until: proUntil,
                pro_started_at: new Date().toISOString(),
                pro_expires_at: proUntil,
                pro_renewal: false,
            })
            .eq('id', payment.user_id);

        if (profileErr) {
            return NextResponse.json({ success: false, message: 'Profil güncellenemedi', error: profileErr }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Test callback çalıştı',
            payment_id: payment.id,
            user_id: payment.user_id,
            plan_type: planType,
            pro_until: proUntil,
            payment_plan_raw: payment.plan,
        });

    } catch {
        return NextResponse.json({ success: false, message: 'Hata' }, { status: 500 });
    }
}
