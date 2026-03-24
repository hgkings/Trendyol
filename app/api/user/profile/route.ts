import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server-client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            return NextResponse.json({ error: 'Config missing' }, { status: 500 });
        }

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

        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Use service role to read profile (bypasses RLS)
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
            const admin = createServerClient(supabaseUrl, serviceKey, {
                cookies: { getAll: () => [], setAll: () => { } },
            });

            const { data: profile } = await admin
                .from('profiles')
                .select('id, email, plan, plan_expires_at')
                .eq('id', user.id)
                .single();

            return NextResponse.json({
                plan: profile?.plan || 'free',
                plan_expires_at: profile?.plan_expires_at || null,
                email: profile?.email || user.email,
            });
        }

        // Fallback: use anon key (may hit RLS)
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, email, plan, plan_expires_at')
            .eq('id', user.id)
            .single();

        return NextResponse.json({
            plan: profile?.plan || 'free',
            plan_expires_at: profile?.plan_expires_at || null,
            email: profile?.email || user.email,
        });

    } catch (err: any) {
        console.error('[user/profile] Error:', err?.message);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await req.json();
        const allowed = ['full_name'];
        const updates: Record<string, unknown> = {};
        for (const key of allowed) {
            if (key in body) updates[key] = body[key];
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
        }

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[user/profile PATCH] Error:', err?.message);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
