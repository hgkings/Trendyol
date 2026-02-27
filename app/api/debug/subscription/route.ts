import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const email = url.searchParams.get('email');

    if (!userId && !email) {
        return NextResponse.json({ error: 'Pass ?userId=xxx or ?email=xxx' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: 'Missing env' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    let query = supabase.from('profiles').select('id, email, plan, plan_expires_at, pro_until, updated_at');
    if (userId) query = query.eq('id', userId);
    else if (email) query = query.eq('email', email);

    const { data: profile, error } = await query.maybeSingle();

    // Also get latest payment
    let payment = null;
    if (profile) {
        const { data: p } = await supabase
            .from('payments')
            .select('id, plan, status, paid_at, provider_order_id, created_at')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        payment = p;
    }

    return NextResponse.json({
        profile: profile || null,
        latestPayment: payment || null,
        error: error?.message || null,
    });
}
