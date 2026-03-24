import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server-client';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('cash_plan')
            .select('*')
            .eq('user_id', user.id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data ?? []);
    } catch (err: any) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await req.json();
        const { error } = await supabase
            .from('cash_plan')
            .upsert({ ...body, user_id: user.id });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
