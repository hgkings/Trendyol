import { NextResponse } from 'next/server';
import { PRICING } from '@/config/pricing';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { plan } = await req.json();

        if (plan !== 'pro_monthly' && plan !== 'pro_yearly') {
            return NextResponse.json({ error: 'Geçersiz plan' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            return NextResponse.json({ error: 'Config missing' }, { status: 500 });
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

        // Service role for insert (bypasses RLS)
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            return NextResponse.json({ error: 'Server config missing' }, { status: 500 });
        }

        const { createClient } = await import('@supabase/supabase-js');
        const adminSupabase = createClient(supabaseUrl, serviceKey);

        const amount = plan === 'pro_yearly' ? PRICING.proYearly : PRICING.proMonthly;

        // Generate merchant_oid — this is stored in provider_order_id column
        // PayTR static link assigns its own merchant_oid, so this is a temporary placeholder
        const merchantOid = `KARNET_${user.id.substring(0, 8)}_${Date.now()}`;

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

        console.log(`[PayTR] ✅ Payment oluşturuldu: id=${payment.id}, user=${user.id}, email=${user.email}, plan=${plan}, merchant_oid=${merchantOid}`);

        return NextResponse.json({ success: true, paymentId: payment.id });

    } catch (error: any) {
        console.error('[PayTR] Create payment error:', error?.message || error);
        return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
    }
}
