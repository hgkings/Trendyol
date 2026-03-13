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
    const status = searchParams.get('status') ?? '';

    // Fetch tickets via service role (bypasses RLS)
    let ticketQuery = admin
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

    if (status) ticketQuery = ticketQuery.eq('status', status);

    const { data: tickets, error } = await ticketQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch emails separately to avoid FK join issues
    const userIds = [...new Set((tickets ?? []).map((t: any) => t.user_id))];
    let emailMap: Record<string, string> = {};

    if (userIds.length > 0) {
        const { data: profiles } = await admin
            .from('profiles')
            .select('id, email')
            .in('id', userIds);

        emailMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.email]));
    }

    const result = (tickets ?? []).map((t: any) => ({
        ...t,
        profiles: { email: emailMap[t.user_id] ?? t.user_id },
    }));

    return NextResponse.json({ tickets: result });
}

export async function PATCH(req: NextRequest) {
    const supabase = createClient();
    if (!(await isAdmin(supabase))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id, status, admin_note } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const admin = createAdminClient();
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (admin_note !== undefined) updates.admin_note = admin_note;

    const { error } = await admin.from('support_tickets').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
