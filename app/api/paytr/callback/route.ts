import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';
import { emailService } from '@/lib/email/emailService';

export async function POST(req: Request) {
    try {
        // PayTR sends callback as form-urlencoded
        const formData = await req.formData();
        const payload = Object.fromEntries(formData.entries());

        const merchant_oid = String(payload.merchant_oid || '');
        const status = String(payload.status || '');
        const total_amount = String(payload.total_amount || '');
        const hash = String(payload.hash || '');
        const callback_id = String(payload.callback_id || '');
        const link_id = String(payload.id || ''); // PayTR link ID (hash için kullanılır)

        // ── STEP 1: Hash Doğrulama ──────────────────────────────
        // Link API hash: HMAC-SHA256(id + merchant_oid + salt + status + total_amount, key)
        const merchantKey = process.env.PAYTR_MERCHANT_KEY;
        const merchantSalt = process.env.PAYTR_MERCHANT_SALT;

        if (!merchantKey || !merchantSalt) {
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        // PayTR Link API hash: callback_id + merchant_oid + salt + status + total_amount
        // (id/link_id field arrives empty for Link API — callback_id is the correct identifier)
        const hashStr = callback_id + merchant_oid + merchantSalt + status + total_amount;
        const expectedHash = crypto
            .createHmac('sha256', merchantKey)
            .update(hashStr)
            .digest('base64');

        if (hash !== expectedHash) {
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        // ── STEP 2: Supabase Bağlantısı ─────────────────────────
        const supabase = createAdminClient();

        // ── STEP 3: Payment kaydını bul (callback_id = payment.id hyphensiz)
        const { data: payment } = await supabase
            .from('payments')
            .select('*')
            .eq('provider_order_id', callback_id)
            .single();

        if (!payment) {
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        // ── STEP 4: Daha önce işlendiyse tekrar işleme ──────────
        if (payment.status === 'paid') {
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        // ── STEP 5: Status kontrolü ve güncelleme ───────────────
        if (status === 'success') {
            const { error: payUpdateErr } = await supabase
                .from('payments')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    provider_order_id: merchant_oid,
                    raw_payload: payload as any,
                })
                .eq('id', payment.id);

            if (payUpdateErr) {
                // payment update failed — continue to avoid retries
            }

            // ── STEP 6: Profili güncelle (plan tipine göre) ──────
            const planType = payment.plan || 'pro_monthly';
            const isStarterPlan = planType === 'starter_monthly' || planType === 'starter_yearly';
            const isYearlyPlan = planType === 'pro_yearly' || planType === 'starter_yearly';
            const daysToAdd = isYearlyPlan ? 365 : 30;
            const proUntil = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

            const activePlan = isStarterPlan ? 'starter' : 'pro';

            const { error: profileErr } = await supabase
                .from('profiles')
                .update({
                    plan: activePlan,
                    is_pro: !isStarterPlan,
                    plan_type: planType,
                    pro_until: proUntil,
                    pro_started_at: new Date().toISOString(),
                    pro_expires_at: proUntil,
                    pro_renewal: false,
                })
                .eq('id', payment.user_id);

            if (!profileErr) {
                // Pro aktivasyon emaili gönder (ödeme akışını etkilemez, hata olsa bile devam eder)
                try {
                    const { data: userProfile } = await supabase
                        .from('profiles')
                        .select('email, name')
                        .eq('id', payment.user_id)
                        .single();

                    if (userProfile?.email) {
                        await emailService.sendProActivated(
                            { email: userProfile.email, name: userProfile.name, id: payment.user_id },
                            { planType, expiresAt: new Date(proUntil).toLocaleDateString('tr-TR') }
                        );
                    }
                } catch {
                    // email failure does not affect payment outcome
                }
            }
        } else {
            await supabase
                .from('payments')
                .update({
                    status: 'failed',
                    raw_payload: payload as any,
                })
                .eq('id', payment.id);
        }

        return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });

    } catch {
        return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
}
