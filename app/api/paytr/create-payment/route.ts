import { NextResponse } from 'next/server';
import { PRICING } from '@/config/pricing';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { plan } = await req.json();

        if (plan !== 'pro_monthly' && plan !== 'pro_yearly') {
            return NextResponse.json({ error: 'Geçersiz plan' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const merchantId = process.env.PAYTR_MERCHANT_ID;
        const merchantKey = process.env.PAYTR_MERCHANT_KEY;
        const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://trendyol-virid.vercel.app').trim().replace(/\/$/, '');

        if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
            return NextResponse.json({ error: 'Config missing' }, { status: 500 });
        }

        if (!merchantId || !merchantKey || !merchantSalt) {
            console.error('[PayTR] PAYTR env vars eksik');
            return NextResponse.json({ error: 'Payment config missing' }, { status: 500 });
        }

        // Get user from session
        const { createServerClient } = await import('@supabase/ssr');
        const { cookies } = await import('next/headers');

        const cookieStore = cookies();
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { }
                },
            },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
        }

        const { createClient } = await import('@supabase/supabase-js');
        const adminSupabase = createClient(supabaseUrl, serviceKey);

        const testPrice = process.env.PAYTR_TEST_PRICE ? parseFloat(process.env.PAYTR_TEST_PRICE) : null;
        const amount = testPrice ?? (plan === 'pro_yearly' ? PRICING.proYearly : PRICING.proMonthly);
        const amountKurus = Math.round(amount * 100);

        const planName = plan === 'pro_yearly' ? 'Karnet Pro Yillik' : 'Karnet Pro Aylik';

        // Create payment record — its ID becomes merchant_oid
        const { data: payment, error: insertError } = await adminSupabase
            .from('payments')
            .insert({
                user_id: user.id,
                email: user.email,
                plan: plan,
                amount_try: amount,
                currency: 'TRY',
                status: 'created',
                provider: 'paytr',
                provider_order_id: `PENDING_${Date.now()}`,
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('[PayTR] Payment insert error:', JSON.stringify(insertError));
            return NextResponse.json({ error: 'Ödeme kaydı oluşturulamadı' }, { status: 500 });
        }

        const merchantOid = payment.id.replace(/-/g, '');

        // Update provider_order_id to merchantOid
        await adminSupabase
            .from('payments')
            .update({ provider_order_id: merchantOid })
            .eq('id', payment.id);

        // User IP
        const userIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || '127.0.0.1';

        // Basket (base64 encoded JSON)
        const basket = JSON.stringify([[planName, amount.toFixed(2), 1]]);
        const userBasket = Buffer.from(basket).toString('base64');

        const noInstallment = '1';
        const maxInstallment = '0';
        const currency = 'TL';
        const testMode = process.env.PAYTR_TEST_MODE === '1' ? '1' : '0';

        // iFrame API hash: merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode + merchant_salt
        const hashStr = merchantId + userIp + merchantOid + (user.email || '') + String(amountKurus) + userBasket + noInstallment + maxInstallment + currency + testMode;
        const paytrToken = crypto
            .createHmac('sha256', merchantKey)
            .update(hashStr + merchantSalt)
            .digest('base64');

        const merchantOkUrl = `${appUrl}/pricing?payment=success&paymentId=${payment.id}`;
        const merchantFailUrl = `${appUrl}/pricing?payment=fail`;

        const formParams = new URLSearchParams({
            merchant_id: merchantId,
            merchant_key: merchantKey,
            merchant_salt: merchantSalt,
            email: user.email || '',
            payment_amount: String(amountKurus),
            merchant_oid: merchantOid,
            user_name: user.email?.split('@')[0] || '',
            user_address: 'Türkiye',
            user_phone: '05000000000',
            merchant_ok_url: merchantOkUrl,
            merchant_fail_url: merchantFailUrl,
            user_basket: userBasket,
            user_ip: userIp,
            timeout_limit: '30',
            debug_on: '1',
            test_mode: testMode,
            lang: 'tr',
            no_installment: noInstallment,
            max_installment: maxInstallment,
            currency: currency,
            paytr_token: paytrToken,
        });

        console.log('[PayTR] iFrame token isteniyor, merchant_oid:', merchantOid, 'amount:', amountKurus);

        const paytrRes = await fetch('https://www.paytr.com/odeme/api/get-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formParams.toString(),
        });

        const rawText = await paytrRes.text();
        console.log('[PayTR] Ham yanıt:', rawText);

        let paytrData: any;
        try {
            paytrData = JSON.parse(rawText);
        } catch {
            console.error('[PayTR] JSON parse hatası:', rawText);
            return NextResponse.json({ error: 'PayTR geçersiz yanıt döndü' }, { status: 500 });
        }

        if (paytrData.status !== 'success') {
            console.error('[PayTR] Token alınamadı:', paytrData.reason || JSON.stringify(paytrData));
            return NextResponse.json({ error: paytrData.reason || 'PayTR token alınamadı' }, { status: 500 });
        }

        const iframeToken = paytrData.token;
        console.log(`[PayTR] ✅ iFrame token alındı, merchant_oid=${merchantOid}`);

        // Test modunda callback gelmez — otomatik pro aktif et
        const isTestMode = process.env.PAYTR_TEST_MODE === '1';
        if (isTestMode) {
            const daysToAdd = plan === 'pro_yearly' ? 365 : 30;
            const proUntil = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
            await adminSupabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', payment.id);
            await adminSupabase.from('profiles').update({
                plan: 'pro', is_pro: true, plan_type: plan,
                pro_until: proUntil, pro_started_at: new Date().toISOString(), pro_expires_at: proUntil,
            }).eq('id', user.id);
            console.log(`[PayTR] 🧪 Test modu: Pro otomatik aktif edildi, user=${user.id}`);
        }

        return NextResponse.json({ success: true, paymentId: payment.id, iframeToken });

    } catch (error: any) {
        console.error('[PayTR] Create payment error:', error?.message || error);
        return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
    }
}
