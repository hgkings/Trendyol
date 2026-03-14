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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.xn--krnet-3qa.com';

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

        const amount = plan === 'pro_yearly' ? PRICING.proYearly : PRICING.proMonthly;
        const amountKurus = Math.round(amount * 100); // TRY → kuruş

        const merchantOid = `KARNET${user.id.replace(/-/g, '').substring(0, 12)}${Date.now()}`;

        // Create payment record
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
                provider_order_id: merchantOid,
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('[PayTR] Payment insert error:', JSON.stringify(insertError));
            return NextResponse.json({ error: 'Ödeme kaydı oluşturulamadı' }, { status: 500 });
        }

        // Get user IP
        const forwarded = req.headers.get('x-forwarded-for');
        const userIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

        // User basket: [[name, unit_price_in_kurus_as_string, quantity]]
        const planName = plan === 'pro_yearly' ? 'Kârnet Pro Yıllık' : 'Kârnet Pro Aylık';
        const userBasket = JSON.stringify([[planName, String(amountKurus), 1]]);

        const userEmail = user.email || '';
        const noInstallment = '1';
        const maxInstallment = '0';
        const currencyCode = 'TRY';
        const testMode = process.env.PAYTR_TEST_MODE === 'false' ? '0' : '1';
        const debugOn = '0';
        const lang = 'tr';
        const timeoutLimit = '30';

        const merchantOkUrl = `${appUrl}/basari`;
        const merchantFailUrl = `${appUrl}/pricing?error=payment_failed`;
        const callbackLink = `${appUrl}/api/paytr/callback`;

        // Hash: merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency_code + test_mode
        const hashInput = merchantId + userIp + merchantOid + userEmail + String(amountKurus) + userBasket + noInstallment + maxInstallment + currencyCode + testMode;
        const paytrToken = crypto
            .createHmac('sha256', merchantKey + merchantSalt)
            .update(hashInput)
            .digest('base64');

        // Call PayTR iFrame API
        const formParams = new URLSearchParams({
            merchant_id: merchantId,
            user_ip: userIp,
            merchant_oid: merchantOid,
            email: userEmail,
            payment_amount: String(amountKurus),
            paytr_token: paytrToken,
            user_basket: userBasket,
            debug_on: debugOn,
            no_installment: noInstallment,
            max_installment: maxInstallment,
            user_name: userEmail,
            user_address: 'Türkiye',
            user_phone: '05000000000',
            merchant_ok_url: merchantOkUrl,
            merchant_fail_url: merchantFailUrl,
            currency_code: currencyCode,
            test_mode: testMode,
            lang: lang,
            timeout_limit: timeoutLimit,
            callback_link: callbackLink,
        });

        const paytrRes = await fetch('https://www.paytr.com/odeme/api/get-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formParams.toString(),
        });

        const paytrData = await paytrRes.json();
        console.log('[PayTR] API yanıtı:', JSON.stringify(paytrData));

        if (paytrData.status !== 'success') {
            console.error('[PayTR] Token alınamadı:', paytrData.reason);
            return NextResponse.json({ error: paytrData.reason || 'PayTR token alınamadı' }, { status: 500 });
        }

        const iframeToken = paytrData.token;
        const paymentUrl = `https://www.paytr.com/odeme/guvenli/${iframeToken}`;

        console.log(`[PayTR] ✅ Token alındı: merchant_oid=${merchantOid}, user=${user.id}, payment_id=${payment.id}`);

        return NextResponse.json({ success: true, paymentId: payment.id, paymentUrl });

    } catch (error: any) {
        console.error('[PayTR] Create payment error:', error?.message || error);
        return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
    }
}
