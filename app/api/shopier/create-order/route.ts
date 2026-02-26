import { NextResponse } from 'next/server';
import { getPlanAmount, PlanId } from '@/config/pricing';

export const dynamic = 'force-dynamic';

// GET → redirect to pricing (prevent 405)
export async function GET() {
    return NextResponse.redirect(new URL('/pricing', process.env.NEXT_PUBLIC_APP_URL || 'https://xn--krnet-3qa.com'));
}

export async function POST(req: Request) {
    try {
        // 0. Log Shopier env keys (just names) as requested by the user
        console.log('[create-order] Checking Shopier env:', {
            has_SHOPIER_ACCESS_TOKEN: !!process.env.SHOPIER_ACCESS_TOKEN,
            has_SHOPIER_API_KEY: !!process.env.SHOPIER_API_KEY
        });

        // 1. Safe env guard — return 500, never throw
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('[create-order] Missing Supabase env vars');
            return NextResponse.json({ error: 'Sunucu yapılandırması eksik (Supabase).' }, { status: 500 });
        }

        // 2. Lazy import — create clients inside handler, not at module level
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

        // 3. Auth check
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

        // 5. Generate unique order ID
        const providerOrderId = crypto.randomUUID();
        const amount = getPlanAmount(plan);

        // 6. Insert payment record via admin client
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

        // 7. Get buyer info
        const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', user.id)
            .single();

        const buyerEmail = profile?.email || user.email;
        const nameParts = buyerEmail.split('@')[0].split('.');
        const firstName = nameParts[0] || 'Müşteri';
        const lastName = nameParts[1] || 'Karnet';

        const productName = plan === 'pro_monthly'
            ? 'Kârnet Pro - Aylık Abonelik'
            : 'Kârnet Pro - Yıllık Abonelik';

        // 8. Return JSON with redirectUrl
        const redirectUrl = `/api/shopier/checkout?orderId=${providerOrderId}&plan=${plan}&amount=${amount}&product=${encodeURIComponent(productName)}&name=${encodeURIComponent(firstName)}&surname=${encodeURIComponent(lastName)}&email=${encodeURIComponent(buyerEmail)}`;

        return NextResponse.json({ redirectUrl });

    } catch (error: any) {
        console.error('[create-order] Error:', error);
        return NextResponse.json({ error: 'Bir hata oluştu.' }, { status: 500 });
    }
}
