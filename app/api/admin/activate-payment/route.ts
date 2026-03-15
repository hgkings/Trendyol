import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        // Verify caller is admin
        const cookieStore = cookies();
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { }
                },
            },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

        const adminSupabase = createClient(supabaseUrl, serviceKey);
        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('plan')
            .eq('id', user.id)
            .single();

        if (profile?.plan !== 'admin') {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
        }

        const { paymentId } = await req.json();
        if (!paymentId) return NextResponse.json({ error: 'paymentId gerekli' }, { status: 400 });

        const { data: payment, error: payErr } = await adminSupabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single();

        if (payErr || !payment) {
            return NextResponse.json({ error: 'Ödeme bulunamadı' }, { status: 404 });
        }

        const planType = payment.plan || 'pro_monthly';
        const daysToAdd = planType === 'pro_yearly' ? 365 : 30;
        const proUntil = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

        await adminSupabase
            .from('payments')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', paymentId);

        const { error: profileErr } = await adminSupabase
            .from('profiles')
            .update({
                plan: 'pro',
                is_pro: true,
                plan_type: planType,
                pro_until: proUntil,
                pro_started_at: new Date().toISOString(),
                pro_expires_at: proUntil,
                pro_renewal: false,
            })
            .eq('id', payment.user_id);

        if (profileErr) {
            return NextResponse.json({ error: 'Profil güncellenemedi: ' + profileErr.message }, { status: 500 });
        }

        console.log(`[Admin] ✅ Manuel pro aktivasyon: payment=${paymentId}, user=${payment.user_id}`);
        return NextResponse.json({ success: true, user_id: payment.user_id, pro_until: proUntil });

    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Hata' }, { status: 500 });
    }
}
