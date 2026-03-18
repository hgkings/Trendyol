import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server-client';

async function isAdmin(supabase: ReturnType<typeof createClient>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
    return data?.plan === 'admin';
}

export async function GET() {
    const supabase = createClient();
    if (!(await isAdmin(supabase))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const admin = createAdminClient();

    const [
        { count: totalUsers },
        { count: proUsers },
        { count: totalAnalyses },
        { data: payments },
        { count: totalTickets },
        { count: openTickets },
        { data: recentUsers },
    ] = await Promise.all([
        admin.from('profiles').select('*', { count: 'exact', head: true }),
        admin.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
        admin.from('analyses').select('*', { count: 'exact', head: true }),
        admin.from('payments').select('amount_try, status').eq('status', 'paid'),
        admin.from('tickets').select('*', { count: 'exact', head: true }),
        admin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'acik'),
        admin.from('profiles').select('id, email, plan, created_at').order('created_at', { ascending: false }).limit(5),
    ]);

    const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount_try || 0), 0) ?? 0;

    return NextResponse.json({
        totalUsers: totalUsers ?? 0,
        proUsers: proUsers ?? 0,
        freeUsers: (totalUsers ?? 0) - (proUsers ?? 0),
        totalAnalyses: totalAnalyses ?? 0,
        totalRevenue,
        totalTickets: totalTickets ?? 0,
        openTickets: openTickets ?? 0,
        recentUsers: recentUsers ?? [],
    });
}
