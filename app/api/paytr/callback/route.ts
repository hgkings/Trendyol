import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(req: Request) {
    console.log('[PayTR Callback] ========== Callback alındı ==========');

    try {
        // PayTR sends callback as form-urlencoded
        const formData = await req.formData();
        const payload = Object.fromEntries(formData.entries());

        // Log ALL incoming fields
        console.log('[PayTR Callback] Gelen alanlar:');
        for (const [key, value] of Object.entries(payload)) {
            console.log(`  ${key}: ${value}`);
        }

        const merchant_oid = String(payload.merchant_oid || '');
        const status = String(payload.status || '');
        const total_amount = String(payload.total_amount || '');
        const hash = String(payload.hash || '');
        const callback_id = String(payload.callback_id || '');

        // ── STEP 1: Hash Doğrulama ──────────────────────────────
        // Link API hash: HMAC-SHA256(callback_id + merchant_oid + salt + status + total_amount, key)
        const merchantKey = process.env.PAYTR_MERCHANT_KEY;
        const merchantSalt = process.env.PAYTR_MERCHANT_SALT;

        if (!merchantKey || !merchantSalt) {
            console.error('[PayTR Callback] ❌ PAYTR_MERCHANT_KEY veya PAYTR_MERCHANT_SALT eksik!');
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        const hashStr = callback_id + merchant_oid + merchantSalt + status + total_amount;
        const expectedHash = crypto
            .createHmac('sha256', merchantKey)
            .update(hashStr)
            .digest('base64');

        if (hash !== expectedHash) {
            console.error('[PayTR Callback] ❌ Hash doğrulama başarısız!');
            console.error(`  callback_id: ${callback_id}, merchant_oid: ${merchant_oid}, status: ${status}, total_amount: ${total_amount}`);
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        console.log('[PayTR Callback] ✅ Hash doğrulandı, callback_id:', callback_id);

        // ── STEP 2: Supabase Bağlantısı ─────────────────────────
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            console.error('[PayTR Callback] ❌ Supabase env vars eksik!');
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        // ── STEP 3: Payment kaydını bul (callback_id = provider_order_id) ──
        const { data: payment } = await supabase
            .from('payments')
            .select('*')
            .eq('provider_order_id', callback_id)
            .single();

        if (!payment) {
            console.error(`[PayTR Callback] ❌ Payment bulunamadı: callback_id=${callback_id}`);
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        console.log(`[PayTR Callback] ✅ Payment bulundu: id=${payment.id}, user=${payment.user_id}`);

        // ── STEP 4: Daha önce işlendiyse tekrar işleme ──────────
        if (payment.status === 'paid') {
            console.log('[PayTR Callback] ⚠️ Bu ödeme zaten işlendi, tekrar işlenmiyor.');
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
                console.error('[PayTR Callback] ❌ Payment güncelleme hatası:', JSON.stringify(payUpdateErr));
            } else {
                console.log('[PayTR Callback] ✅ Payment güncellendi');
            }

            // ── STEP 6: Profili Pro yap ─────────────────────────
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
                console.error('[PayTR Callback] ❌ Profil güncelleme hatası:', JSON.stringify(profileErr));
            } else {
                console.log(`[PayTR Callback] ✅ Profil Pro yapıldı: user_id=${payment.user_id}, plan_type=${planType}, pro_until=${proUntil}`);
            }
        } else {
            console.log(`[PayTR Callback] ⚠️ Status success değil: "${status}"`);

            await supabase
                .from('payments')
                .update({
                    status: 'failed',
                    raw_payload: payload as any,
                })
                .eq('id', payment.id);
        }

        console.log('[PayTR Callback] ========== İşlem tamamlandı ==========');
        return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });

    } catch (error: any) {
        console.error('[PayTR Callback] ❌ EXCEPTION:', error?.message || error);
        return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
}
