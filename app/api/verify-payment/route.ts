import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');
        const paymentId = searchParams.get('paymentId');

        const admin = createAdminClient();

        // ── Token-based polling (new flow) ───────────────────────────────────
        if (token) {
            // 1. Authenticate the caller
            const supabase = createServerSupabase();

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                return NextResponse.json({ success: false, error: 'Giriş yapmalısınız' }, { status: 401 });
            }

            // 2. Find payment by token
            const { data: payment, error: paymentErr } = await admin
                .from('payments')
                .select('id, user_id, plan, status, token_expires_at')
                .eq('token', token)
                .single();

            if (paymentErr || !payment) {
                return NextResponse.json({ success: false, error: 'Geçersiz token' }, { status: 400 });
            }

            // 3. Token must belong to the logged-in user
            if (payment.user_id !== user.id) {
                return NextResponse.json({ success: false, error: 'Bu token size ait değil' }, { status: 403 });
            }

            // 4. Check expiry
            if (payment.token_expires_at) {
                const expiresAt = new Date(payment.token_expires_at).getTime();
                if (Date.now() > expiresAt) {
                    await admin.from('payments').update({ status: 'expired' }).eq('id', payment.id);
                    return NextResponse.json({ success: false, error: 'Oturum süresi doldu. Lütfen tekrar ödeme yapın.' }, { status: 410 });
                }
            }

            // 5. ONLY report success if PayTR callback already marked payment as paid.
            //    This endpoint does NOT activate Pro itself — the callback does.
            if (payment.status === 'paid') {
                return NextResponse.json({ success: true });
            }

            // Payment session exists and token is valid, but callback hasn't arrived yet.
            return NextResponse.json({ success: false, pending: true });
        }

        // ── Legacy fallback: paymentId-based read-only check ─────────────────
        if (paymentId) {
            const { data: payment } = await admin
                .from('payments')
                .select('status')
                .eq('id', paymentId)
                .single();

            if (payment?.status === 'paid') {
                return NextResponse.json({ success: true });
            }
            return NextResponse.json({ success: false });
        }

        return NextResponse.json({ success: false, error: 'token veya paymentId gerekli' }, { status: 400 });

    } catch {
        return NextResponse.json({ success: false, error: 'Sunucu hatası' }, { status: 500 });
    }
}
