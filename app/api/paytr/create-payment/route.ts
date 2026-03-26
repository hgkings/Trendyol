import { NextResponse } from 'next/server';
import { PRICING } from '@/config/pricing';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { plan } = await req.json();

        if (!['pro_monthly', 'pro_yearly', 'starter_monthly', 'starter_yearly'].includes(plan)) {
            return NextResponse.json({ error: 'Geçersiz plan' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const merchantId = process.env.PAYTR_MERCHANT_ID;
        const merchantKey = process.env.PAYTR_MERCHANT_KEY;
        const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
        // PAYTR_CALLBACK_URL allows overriding the callback domain independently.
        // Use this to set the exact URL PayTR is allowed to POST to (e.g. https://www.xn--krnet-3qa.com)
        // without affecting NEXT_PUBLIC_APP_URL used elsewhere.
        const callbackBase = (
            process.env.PAYTR_CALLBACK_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
            'https://trendyol-p73m.vercel.app'
        ).trim().replace(/\/$/, '');


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
        const planAmountMap: Record<string, number> = {
            pro_monthly: PRICING.pro.monthly,
            pro_yearly: PRICING.pro.annual,
            starter_monthly: PRICING.starter.monthly,
            starter_yearly: PRICING.starter.annual,
        };
        const amount = testPrice ?? planAmountMap[plan];
        const amountKurus = Math.round(amount * 100);

        // Generate secure one-time token (96 hex chars = 48 random bytes)
        const secureToken = crypto.randomBytes(48).toString('hex');
        const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        // Create payment record first — its ID becomes callback_id
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
                token: secureToken,
                token_expires_at: tokenExpiresAt,
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('[PayTR] Payment insert error:', JSON.stringify(insertError));
            return NextResponse.json({ error: 'Ödeme kaydı oluşturulamadı' }, { status: 500 });
        }

        const callbackId = payment.id.replace(/-/g, '');
        const planNameMap: Record<string, string> = {
            pro_monthly: 'Karnet Pro Aylik',
            pro_yearly: 'Karnet Pro Yillik',
            starter_monthly: 'Karnet Baslangic Aylik',
            starter_yearly: 'Karnet Baslangic Yillik',
        };
        const planName = planNameMap[plan];
        const currency = 'TL';
        const maxInstallment = '1';
        const linkType = 'product';
        const lang = 'tr';
        const minCount = '1';
        const callbackLink = `${callbackBase}/api/paytr/callback`;

        // Link API hash: base64(HMAC-SHA256(name+price+currency+max_installment+link_type+lang+min_count+salt, key))
        const required = planName + String(amountKurus) + currency + maxInstallment + linkType + lang + minCount;
        const paytrToken = crypto
            .createHmac('sha256', merchantKey)
            .update(required + merchantSalt)
            .digest('base64');

        const formParams = new URLSearchParams({
            merchant_id: merchantId,
            name: planName,
            price: String(amountKurus),
            currency: currency,
            max_installment: maxInstallment,
            link_type: linkType,
            lang: lang,
            min_count: minCount,
            callback_link: callbackLink,
            callback_id: callbackId,
            debug_on: '0',
            get_qr: '0',
            paytr_token: paytrToken,
        });

        console.log('[PayTR] Link oluşturuluyor, callback_id:', callbackId, 'amount:', amountKurus, 'callback_link:', callbackLink);

        const paytrRes = await fetch('https://www.paytr.com/odeme/api/link/create', {
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

        if (paytrData.status === 'error' || paytrData.status === 'failed') {
            console.error('[PayTR] Link oluşturulamadı:', paytrData.err_msg || JSON.stringify(paytrData));
            return NextResponse.json({ error: paytrData.err_msg || 'PayTR link oluşturulamadı' }, { status: 500 });
        }

        const paymentUrl = paytrData.link;

        // Update provider_order_id to callbackId so callback can find it
        await adminSupabase
            .from('payments')
            .update({ provider_order_id: callbackId })
            .eq('id', payment.id);

        console.log(`[PayTR] ✅ Link oluşturuldu: ${paymentUrl}, callback_id=${callbackId}`);

        // Test modunda callback gelmez — otomatik plan aktif et
        const isTestMode = process.env.PAYTR_TEST_MODE === '1';
        if (isTestMode) {
            const daysToAdd = (plan === 'pro_yearly' || plan === 'starter_yearly') ? 365 : 30;
            const planUntil = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
            const activePlan = plan.startsWith('starter') ? 'starter' : 'pro';
            const { error: payErr } = await adminSupabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', payment.id);
            if (payErr) console.error('[PayTR] 🧪 Test modu payments update hatası:', JSON.stringify(payErr));
            const { error: profErr } = await adminSupabase.from('profiles').update({
                plan: activePlan, is_pro: activePlan === 'pro', plan_type: plan,
                pro_until: planUntil, pro_started_at: new Date().toISOString(), pro_expires_at: planUntil,
            }).eq('id', user.id);
            if (profErr) console.error('[PayTR] 🧪 Test modu profiles update hatası:', JSON.stringify(profErr));
            else console.log(`[PayTR] 🧪 Test modu: ${activePlan} otomatik aktif edildi, user=${user.id}`);
        }

        return NextResponse.json({ success: true, paymentId: payment.id, paymentUrl, token: secureToken });

    } catch (error: any) {
        console.error('[PayTR] Create payment error:', error?.message || error);
        return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
    }
}
