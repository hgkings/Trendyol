import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* GET: Shopier connectivity check */
export async function GET() {
    return new Response('success', { status: 200 });
}

/* POST: Shopier OSB webhook */
export async function POST(req: Request) {
    console.log('[OSB] POST hit');

    try {
        // ── 1. Parse body ──
        const ct = req.headers.get('content-type') || '';
        console.log('[OSB] content-type', ct);

        let resField = '';
        let hashField = '';

        if (ct.includes('multipart/form-data')) {
            const fd = await req.formData();
            resField = fd.get('res')?.toString() ?? fd.get('RES')?.toString() ?? '';
            hashField = fd.get('hash')?.toString() ?? fd.get('HASH')?.toString() ?? '';
            console.log('[OSB] formData keys:', Array.from(fd.keys()));
        } else {
            const raw = await req.text();
            console.log('[OSB] raw len', raw.length);
            const params = new URLSearchParams(raw);
            console.log('[OSB] keys:', Array.from(params.keys()));
            resField = params.get('res') || params.get('RES') || '';
            hashField = params.get('hash') || params.get('HASH') || '';
        }

        if (!resField || !hashField) {
            console.error('[OSB] Missing res or hash');
            return new Response('success', { status: 200 });
        }

        // ── 2. Verify signature ──
        const osbUsername = process.env.SHOPIER_OSB_USERNAME || '';
        const osbKey = process.env.SHOPIER_OSB_KEY || ''; // Müşterinin OSB KEY'i (API Secret değil)

        const expected = crypto
            .createHmac('sha256', osbKey)
            .update(resField + osbUsername)
            .digest('hex');
        const hashOk = expected === hashField;
        console.log('[OSB] hash ok:', hashOk);

        if (!hashOk) {
            console.error('[OSB] Invalid signature');
            return new Response('success', { status: 200 });
        }

        // ── 3. Decode ──
        const decoded = JSON.parse(Buffer.from(resField, 'base64').toString('utf-8'));

        const orderid = String(decoded.platform_order_id || decoded.orderid || '');
        const email = String(decoded.email || '');
        const price = parseFloat(decoded.price || decoded.payment_amount || '0');
        const istest = decoded.istest === 1 || decoded.istest === '1';

        console.log('[OSB] decoded', { orderid, email, price, istest });

        // ── 4. Supabase SERVICE_ROLE ──
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        if (!supabaseUrl || !serviceKey) {
            console.error('[OSB] Missing Supabase env');
            return new Response('success', { status: 200 });
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ── 5. Find payment (Fallback logic) ──
        let payment: any = null;

        // Try by provider_order_id first (if any retry hits)
        if (orderid) {
            const { data } = await supabase
                .from('payments')
                .select('*')
                .eq('provider_order_id', orderid)
                .maybeSingle();
            if (data) {
                payment = data;
                console.log('[OSB] matched by provider_order_id:', orderid);
            }
        }

        // Fallback: find latest pending payment (most recent, any user)
        // This handles standard Product Link Checkouts where email doesn't match
        if (!payment) {
            const tenMinAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 60 min window
            const { data } = await supabase
                .from('payments')
                .select('*')
                .eq('status', 'pending')
                .eq('provider', 'shopier')
                .gte('created_at', tenMinAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (data) {
                payment = data;
                console.log('[OSB] matched by latest pending:', data.id, 'user:', data.user_id);
            }
        }

        if (!payment) {
            console.error('[OSB] ❌ payment not found', { orderid, email });
            return new Response('success', { status: 200 });
        }

        const userId = payment.user_id;
        const plan = payment.plan; // 'pro_monthly' | 'pro_yearly'

        console.log('[OSB] matched payment', { id: payment.id, userId, plan, status: payment.status });

        // ── 6. Update payment → paid ──
        const now = new Date().toISOString();
        if (payment.status !== 'paid') {
            const { error: updErr } = await supabase
                .from('payments')
                .update({
                    status: 'paid',
                    paid_at: now,
                    provider_order_id: orderid || payment.provider_order_id,
                    raw_payload: decoded,
                })
                .eq('id', payment.id);

            console.log('[OSB] payment → paid', { id: payment.id, error: updErr?.message || 'ok' });
        }

        // ── 7. Update profile → Pro ──
        const days = plan === 'pro_yearly' ? 365 : 30;
        const proUntil = new Date();
        proUntil.setDate(proUntil.getDate() + days);
        const proUntilISO = proUntil.toISOString();

        const proStartedAt = new Date().toISOString();
        const proRenewal = false; // Tek seferlik ödeme modeli olduğu için manuel yenileme

        // Try full update
        const { data: after, error: profErr } = await supabase
            .from('profiles')
            .update({
                plan: 'pro',
                plan_expires_at: proUntilISO,
                pro_until: proUntilISO,
                pro_expires_at: proUntilISO,
                pro_started_at: proStartedAt,
                pro_renewal: proRenewal,
                updated_at: now,
            })
            .eq('id', userId)
            .select('id, plan, plan_expires_at, pro_until, pro_expires_at, pro_started_at, pro_renewal')
            .maybeSingle();

        if (profErr) {
            console.log('[OSB] full update failed, trying without pro_until:', profErr.message);
            const { error: e2 } = await supabase
                .from('profiles')
                .update({ plan: 'pro', plan_expires_at: proUntilISO, updated_at: now })
                .eq('id', userId);

            if (e2) {
                console.log('[OSB] retry without plan_expires_at:', e2.message);
                await supabase
                    .from('profiles')
                    .update({ plan: 'pro' })
                    .eq('id', userId);
            }
        }

        console.log('[OSB] profile ✅ AFTER', {
            userId,
            plan: after?.plan || 'pro (set)',
            proUntil: proUntilISO,
            days,
            error: profErr?.message || 'ok',
        });

        // Always return exact string `success` to stop Shopier from retrying
        return new Response('success', { status: 200 });

    } catch (err: any) {
        console.error('[OSB] error', err?.message || err);
        return new Response('success', { status: 200 });
    }
}
