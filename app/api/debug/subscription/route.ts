import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    // ── SECURITY: Block in production ──
    if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Bu endpoint production ortamında devre dışıdır.' }, { status: 404 });
    }

    // ── SECURITY: Require authenticated admin user ──
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
        return NextResponse.json({ error: 'Missing env' }, { status: 500 });
    }

    const { createServerClient } = await import('@supabase/ssr');
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();

    const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet) {
                try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { }
            },
        },
    });

    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify admin role
    const adminClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile } = await adminClient
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single();

    if (callerProfile?.plan !== 'admin') {
        return NextResponse.json({ error: 'Admin yetkisi gerekli.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const email = url.searchParams.get('email');

    if (!userId && !email) {
        return NextResponse.json({ error: 'Pass ?userId=xxx or ?email=xxx' }, { status: 400 });
    }

    const supabase = adminClient;

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
