import { NextResponse } from 'next/server';
import { getPlanAmount, PlanId } from '@/config/pricing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    return NextResponse.redirect(new URL('/pricing', process.env.NEXT_PUBLIC_APP_URL || 'https://xn--krnet-3qa.com'));
}

export async function POST(req: Request) {
    console.log('[create-order] POST hit');

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const shopierMonthlyUrl = process.env.SHOPIER_PRO_MONTHLY_URL;
        const shopierYearlyUrl = process.env.SHOPIER_PRO_YEARLY_URL;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;

        // Configuration verification logic
        const requiredEnvs: Record<string, string | undefined> = {
            'NEXT_PUBLIC_SUPABASE_URL': supabaseUrl,
            'NEXT_PUBLIC_SUPABASE_ANON_KEY': supabaseAnonKey,
            'SUPABASE_SERVICE_ROLE_KEY': serviceKey,
            'SHOPIER_PRO_MONTHLY_URL': shopierMonthlyUrl,
            'SHOPIER_PRO_YEARLY_URL': shopierYearlyUrl,
            'NEXT_PUBLIC_SITE_URL': siteUrl,
        };

        const missingKeys = Object.entries(requiredEnvs)
            .filter(([_, value]) => !value || value.trim() === '')
            .map(([key]) => key);

        if (missingKeys.length > 0) {
            console.error('[create-order] Missing configuration keys:', missingKeys);
            return NextResponse.json({
                ok: false,
                error: 'Sunucu yapılandırması eksik.',
                error_code: 'server_config_missing',
                missing_keys: missingKeys
            }, { status: 500 });
        }

        // Auth
        const { createServerClient } = await import('@supabase/ssr');
        const { cookies } = await import('next/headers');
        const cookieStore = cookies();
        const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { }
                },
            },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
        }

        // Parse body
        const body = await req.json();
        const plan = body.plan as PlanId;
        if (plan !== 'pro_monthly' && plan !== 'pro_yearly') {
            return NextResponse.json({ error: 'Geçersiz plan.' }, { status: 400 });
        }

        const amount = getPlanAmount(plan);

        // Insert payment with service role
        const admin = createServerClient(supabaseUrl!, serviceKey!, {
            cookies: { getAll: () => [], setAll: () => { } },
        });

        const { data: payment, error: insertErr } = await admin
            .from('payments')
            .insert({
                user_id: user.id,
                plan,
                amount_try: amount,
                status: 'pending',
                provider: 'shopier',
                provider_order_id: crypto.randomUUID(),
            })
            .select('id')
            .single();

        if (insertErr || !payment) {
            console.error('[create-order] insert error:', insertErr?.message);
            return NextResponse.json({ error: 'Sipariş oluşturulamadı.' }, { status: 500 });
        }

        const paymentId = payment.id;
        console.log('[create-order] db payment created:', paymentId);

        // API iptal edildiği için doğrudan Shopier Ürün Linklerine yönlendiriyoruz
        const redirectUrl = plan === 'pro_monthly' ? shopierMonthlyUrl : shopierYearlyUrl;

        return NextResponse.json({ redirectUrl, paymentId });

    } catch (error: any) {
        console.error('[create-order] error:', error?.message);
        return NextResponse.json({ error: 'Bir hata oluştu.' }, { status: 500 });
    }
}
