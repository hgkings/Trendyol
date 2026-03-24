import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server-client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (id) {
            const { data, error } = await supabase
                .from('analyses')
                .select('*')
                .eq('id', id)
                .eq('user_id', user.id)
                .single();

            if (error) return NextResponse.json({ error: error.message }, { status: 404 });
            return NextResponse.json(data);
        }

        const { data, error } = await supabase
            .from('analyses')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
