import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

        // 1. JWT / user verification
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
        }

        // 2. Fetch the latest successful payment
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .select('plan, created_at, paid_at')
            .eq('user_id', user.id)
            .eq('status', 'paid')
            .order('paid_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (paymentError || !payment) {
            return NextResponse.json({ ok: false, reason: 'no_payment_found' });
        }

        // 3. Determine dates and renewal setting
        const startedAt = payment.paid_at || payment.created_at;
        const d = new Date(startedAt);
        const isYearly = payment.plan === 'pro_yearly';
        d.setDate(d.getDate() + (isYearly ? 365 : 30));
        const expiresAt = d.toISOString();

        // 4. Update the profile with the backfilled fields
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                pro_started_at: startedAt,
                pro_expires_at: expiresAt,
                pro_renewal: false // It's a one-time payment
            })
            .eq('id', user.id);

        if (updateError) {
            console.error('[Backfill Pro Dates] Update Error:', updateError);
            return NextResponse.json({ ok: false, reason: 'update_failed', error: updateError.message });
        }

        return NextResponse.json({
            ok: true,
            pro_expires_at: expiresAt,
            pro_started_at: startedAt,
            pro_renewal: false
        });

    } catch (e: any) {
        console.error('[Backfill Pro Dates] Unexpected Error:', e);
        return NextResponse.json({ ok: false, reason: 'server_error', error: e.message }, { status: 500 });
    }
}
