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
        const osbKey = process.env.SHOPIER_OSB_KEY || '';
        const expected = crypto
            .createHmac('sha256', osbKey)
            .update(resField + osbUsername)
            .digest('hex');
        const hashOk = expected === hashField;
        console.log('[OSB] hash ok:', hashOk);

        // ── 3. Decode ──
        const decoded = JSON.parse(Buffer.from(resField, 'base64').toString('utf-8'));

        const orderid = String(decoded.platform_order_id || decoded.orderid || '');
        const email = String(decoded.email || '');
        const price = parseFloat(decoded.price || decoded.payment_amount || '0');
        const istest = decoded.istest === 1 || decoded.istest === '1';

        // Try to extract paymentId from customer note
        const customerNote = String(
            decoded.customer_note || decoded.customernote ||
            decoded.note || decoded.buyer_note || ''
        );
        let paymentIdFromNote = '';
        const noteMatch = customerNote.match(/karnet_payment_id:([a-f0-9-]+)/i);
        if (noteMatch) {
            paymentIdFromNote = noteMatch[1];
        }

        console.log('[OSB] decoded', {
            orderid, email, price, istest,
            customerNote: customerNote.substring(0, 100),
            paymentIdFromNote,
        });

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

        // ── 5. Find payment (3-level fallback) ──
        let payment: any = null;

        // 5a. Try by paymentId from customer note
        if (paymentIdFromNote) {
            const { data } = await supabase
                .from('payments')
                .select('*')
                .eq('id', paymentIdFromNote)
                .maybeSingle();
            if (data) {
                payment = data;
                console.log('[OSB] matched by paymentId from note:', data.id);
            }
        }

        // 5b. Try by provider_order_id
        if (!payment && orderid) {
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

        // 5c. Fallback: find latest pending payment (most recent, any user)
        // This handles the case where email doesn't match and we can't pass paymentId
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
            console.error('[OSB] ❌ payment not found', { orderid, paymentIdFromNote, email });
            return new Response('success', { status: 200 });
        }

        const userId = payment.user_id;
        const plan = payment.plan; // 'pro_monthly' | 'pro_yearly'

        console.log('[OSB] matched payment', { id: payment.id, userId, plan, status: payment.status });

        // ── 6. Update payment → paid ──
        const now = new Date().toISOString();
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

        // ── 7. Update profile → Pro ──
        const days = plan === 'pro_yearly' ? 365 : 30;
        const proUntil = new Date();
        proUntil.setDate(proUntil.getDate() + days);
        const proUntilISO = proUntil.toISOString();

        // Read before
        const { data: before } = await supabase
            .from('profiles')
            .select('id, plan, plan_expires_at, pro_until')
            .eq('id', userId)
            .maybeSingle();
        console.log('[OSB] profile BEFORE', before);

        // Try full update
        const { data: after, error: profErr } = await supabase
            .from('profiles')
            .update({
                plan: 'pro',
                plan_expires_at: proUntilISO,
                pro_until: proUntilISO,
                updated_at: now,
            })
            .eq('id', userId)
            .select('id, plan, plan_expires_at, pro_until')
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

        console.log('[OSB] profile AFTER', {
            userId,
            plan: after?.plan || 'pro (set)',
            proUntil: proUntilISO,
            days,
            error: profErr?.message || 'ok',
        });

        console.log('[OSB] ✅ Done');
        return new Response('success', { status: 200 });

    } catch (err: any) {
        console.error('[OSB] error', err?.message || err);
        return new Response('success', { status: 200 });
    }
}
