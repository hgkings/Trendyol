import { NextResponse } from 'next/server';
import { getPlanAmount, PlanId } from '@/config/pricing';

export const dynamic = 'force-dynamic';

// GET → redirect to pricing (prevent 405)
export async function GET() {
    return NextResponse.redirect(new URL('/pricing', process.env.NEXT_PUBLIC_APP_URL || 'https://xn--krnet-3qa.com'));
}

export async function POST(req: Request) {
    try {
        // 1. Env guards
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('[create-order] Missing Supabase env vars');
            return NextResponse.json({ error: 'Sunucu yapılandırması eksik (Supabase).' }, { status: 500 });
        }

        // 2. Read Shopier product URLs from env
        const shopierMonthlyUrl = process.env.SHOPIER_PRO_MONTHLY_URL;
        const shopierYearlyUrl = process.env.SHOPIER_PRO_YEARLY_URL;

        if (!shopierMonthlyUrl || !shopierYearlyUrl) {
            console.error('[create-order] Missing SHOPIER_PRO_MONTHLY_URL or SHOPIER_PRO_YEARLY_URL');
            return NextResponse.json({ error: 'Ödeme yapılandırması eksik.' }, { status: 500 });
        }

        // 3. Auth check (lazy import)
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

        if (authError || !user || !user.email) {
            return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
        }

        // 4. Parse body
        const body = await req.json();
        const plan = body.plan as PlanId;

        if (plan !== 'pro_monthly' && plan !== 'pro_yearly') {
            return NextResponse.json({ error: 'Geçersiz plan türü.' }, { status: 400 });
        }

        // 5. Create payment record
        const providerOrderId = crypto.randomUUID();
        const amount = getPlanAmount(plan);

        if (!supabaseServiceKey) {
            console.error('[create-order] Missing SUPABASE_SERVICE_ROLE_KEY');
            return NextResponse.json({ error: 'Sunucu yapılandırması eksik (Service Key).' }, { status: 500 });
        }

        const adminClient = createServerClient(supabaseUrl, supabaseServiceKey, {
            cookies: { getAll: () => [], setAll: () => { } },
        });

        const { error: insertError } = await adminClient
            .from('payments')
            .insert({
                user_id: user.id,
                plan,
                amount_try: amount,
                status: 'created',
                provider: 'shopier',
                provider_order_id: providerOrderId,
            });

        if (insertError) {
            console.error('[create-order] DB insert error:', insertError);
            return NextResponse.json({ error: 'Sipariş oluşturulamadı.' }, { status: 500 });
        }

        // 6. Return the fixed Shopier product URL
        const redirectUrl = plan === 'pro_monthly' ? shopierMonthlyUrl : shopierYearlyUrl;

        console.log(`[create-order] Created payment ${providerOrderId} for ${plan}, redirecting to Shopier product page`);

        return NextResponse.json({ redirectUrl });

    } catch (error: any) {
        console.error('[create-order] Error:', error);
        return NextResponse.json({ error: 'Bir hata oluştu.' }, { status: 500 });
    }
}
