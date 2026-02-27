import { NextResponse } from 'next/server';
import { getPlanAmount, PlanId } from '@/config/pricing';

export const dynamic = 'force-dynamic';

// GET → redirect to pricing (prevent 405)
export async function GET() {
    return NextResponse.redirect(new URL('/pricing', process.env.NEXT_PUBLIC_APP_URL || 'https://xn--krnet-3qa.com'));
}

export async function POST(req: Request) {
    console.log('[create-order] POST hit');

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const shopierMonthlyUrl = process.env.SHOPIER_PRO_MONTHLY_URL;
        const shopierYearlyUrl = process.env.SHOPIER_PRO_YEARLY_URL;

        if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
            return NextResponse.json({ error: 'Sunucu yapılandırması eksik.' }, { status: 500 });
        }
        if (!shopierMonthlyUrl || !shopierYearlyUrl) {
            return NextResponse.json({ error: 'Ödeme yapılandırması eksik.' }, { status: 500 });
        }

        // Auth
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
        const admin = createServerClient(supabaseUrl, serviceKey, {
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

        console.log('[create-order]', {
            paymentId,
            userId: user.id,
            plan,
            amount,
        });

        // Build redirect URL
        // Shopier fixed product URL — we can't pass custom fields through it
        // But we store paymentId in success/fail return URLs for the client
        const baseUrl = plan === 'pro_monthly' ? shopierMonthlyUrl : shopierYearlyUrl;
        const redirectUrl = baseUrl;

        console.log('[create-order] redirectUrl:', redirectUrl);

        return NextResponse.json({ redirectUrl, paymentId });

    } catch (error: any) {
        console.error('[create-order] error:', error?.message);
        return NextResponse.json({ error: 'Bir hata oluştu.' }, { status: 500 });
    }
}
