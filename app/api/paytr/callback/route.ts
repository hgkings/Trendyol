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
        const payment_type = String(payload.payment_type || '');

        // ── STEP 1: Hash Doğrulama ──────────────────────────────
        const merchantKey = process.env.PAYTR_MERCHANT_KEY;
        const merchantSalt = process.env.PAYTR_MERCHANT_SALT;

        if (!merchantKey || !merchantSalt) {
            console.error('[PayTR Callback] ❌ PAYTR_MERCHANT_KEY veya PAYTR_MERCHANT_SALT eksik!');
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        // Hash: HMAC-SHA256(merchant_oid + merchant_salt + status + total_amount, merchant_key) → base64
        const hashStr = merchant_oid + merchantSalt + status + total_amount;
        const expectedHash = crypto
            .createHmac('sha256', merchantKey)
            .update(hashStr)
            .digest('base64');

        if (hash !== expectedHash) {
            console.error('[PayTR Callback] ❌ Hash doğrulama başarısız!');
            console.error(`  Gelen hash: ${hash}`);
            console.error(`  Beklenen hash: ${expectedHash}`);
            console.error(`  merchant_oid: ${merchant_oid}`);
            console.error(`  status: ${status}`);
            console.error(`  total_amount: ${total_amount}`);
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        console.log('[PayTR Callback] ✅ Hash doğrulandı');

        // ── STEP 2: Supabase Bağlantısı ─────────────────────────
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            console.error('[PayTR Callback] ❌ Supabase env vars eksik!');
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        // ── STEP 3: Payment kaydını bul ─────────────────────────
        // Önce merchant_oid ile ara (create-payment'ta kaydedilmiş olabilir)
        let payment: any = null;

        const { data: byOid } = await supabase
            .from('payments')
            .select('*')
            .eq('provider_order_id', merchant_oid)
            .single();

        if (byOid) {
            payment = byOid;
            console.log(`[PayTR Callback] ✅ Payment bulundu (merchant_oid ile): id=${payment.id}, user=${payment.user_id}`);
        } else {
            // Fallback: en eski 'created' status'lu paytr kaydını bul
            const { data: oldest, error: oldestErr } = await supabase
                .from('payments')
                .select('*')
                .eq('status', 'created')
                .eq('provider', 'paytr')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (oldest) {
                payment = oldest;
                console.log(`[PayTR Callback] ✅ Payment bulundu (pending fallback): id=${payment.id}, user=${payment.user_id}`);
            } else {
                console.error(`[PayTR Callback] ❌ Kayıt bulunamadı: ${merchant_oid}`);
                console.error(`[PayTR Callback]   oldestErr: ${JSON.stringify(oldestErr)}`);
                return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
            }
        }

        // ── STEP 4: Status kontrolü ve güncelleme ───────────────
        if (status === 'success') {
            // Payment kaydını güncelle
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
                console.log('[PayTR Callback] ✅ Payment güncellendi (paid_at + raw_payload yazıldı)');
            }

            // ── STEP 5: Profili Pro yap ─────────────────────────
            const planType = payment.plan || 'pro_monthly'; // 'pro_monthly' or 'pro_yearly'
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
                console.log(`[PayTR Callback] ✅ Profil Pro yapıldı: user_id=${payment.user_id}, is_pro=true, plan_type=${planType}, pro_until=${proUntil}`);
            }
        } else {
            console.log(`[PayTR Callback] ⚠️ Status success değil: "${status}"`);

            // Başarısız durumda da payment kaydını güncelle
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
        console.error('[PayTR Callback] Stack:', error?.stack);
        return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
}
