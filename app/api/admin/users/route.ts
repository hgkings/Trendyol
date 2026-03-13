import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server-client';

async function isAdmin(supabase: ReturnType<typeof createClient>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
    return data?.plan === 'admin';
}

export async function GET(req: NextRequest) {
    const supabase = createClient();
    if (!(await isAdmin(supabase))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') ?? '';
    const plan = searchParams.get('plan') ?? '';
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = admin
        .from('profiles')
        .select('id, email, plan, pro_until, pro_expires_at, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (search) {
        query = query.ilike('email', `%${search}%`);
    }
    if (plan) {
        query = query.eq('plan', plan);
    }

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ users: data ?? [], total: count ?? 0, page, limit });
}

export async function PATCH(req: NextRequest) {
    const supabase = createClient();
    if (!(await isAdmin(supabase))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId, plan, pro_until } = await req.json();
    if (!userId || !plan) {
        return NextResponse.json({ error: 'userId and plan required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const updates: Record<string, unknown> = { plan };
    if (pro_until !== undefined) updates.pro_until = pro_until;
    if (plan === 'pro' && !pro_until) {
        // Default: 1 year from now
        updates.pro_until = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        updates.pro_started_at = new Date().toISOString();
        updates.pro_expires_at = updates.pro_until;
    }
    if (plan === 'free') {
        updates.pro_until = null;
        updates.pro_expires_at = null;
        updates.pro_started_at = null;
    }

    const { error } = await admin.from('profiles').update(updates).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
