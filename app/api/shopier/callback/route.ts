import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ─── GET: Shopier connectivity check ─── */
export async function GET() {
    return new Response('success', { status: 200 });
}

/* ─── POST: Shopier OSB webhook ─── */
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
            console.log('[OSB] urlencoded keys:', Array.from(params.keys()));
            resField = params.get('res') || params.get('RES') || '';
            hashField = params.get('hash') || params.get('HASH') || '';
        }

        console.log('[OSB] parsed', { hasRes: !!resField, hasHash: !!hashField });

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
        console.log('[OSB] hash ok:', expected === hashField);

        // ── 3. Decode ──
        const decoded = JSON.parse(Buffer.from(resField, 'base64').toString('utf-8'));
        const orderid = String(decoded.platform_order_id || decoded.orderid || '');
        const email = String(decoded.email || '');
        const price = parseFloat(decoded.price || '0');
        const productid = String(decoded.productid || '');
        const istest = decoded.istest === 1 || decoded.istest === '1';

        console.log('[OSB] decoded', { orderid, email, price, productid, istest });

        // ── 4. Supabase with SERVICE_ROLE_KEY ──
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        if (!supabaseUrl || !serviceKey) {
            console.error('[OSB] Missing Supabase env');
            return new Response('success', { status: 200 });
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ── 5. Find payment by provider_order_id ──
        let payment: any = null;

        if (orderid) {
            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .eq('provider_order_id', orderid)
                .limit(1)
                .maybeSingle();
            console.log('[OSB] payment lookup by orderid', { orderid, found: !!data, error: error?.message });
            if (data) payment = data;
        }

        // Fallback: find by email → latest created payment
        if (!payment && email) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email)
                .maybeSingle();

            if (profile) {
                const { data } = await supabase
                    .from('payments')
                    .select('*')
                    .eq('user_id', profile.id)
                    .eq('status', 'created')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (data) {
                    payment = data;
                    console.log('[OSB] fallback: found payment by email', { userId: profile.id, paymentId: data.id });
                }
            }
        }

        if (!payment) {
            console.error('[OSB] ❌ No payment found for orderid:', orderid, 'email:', email);
            return new Response('success', { status: 200 });
        }

        const userId = payment.user_id;
        const plan = payment.plan; // 'pro_monthly' | 'pro_yearly'

        console.log('[OSB] matched payment', { id: payment.id, userId, plan, status: payment.status });

        // ── 6. Mark payment as paid ──
        const now = new Date().toISOString();
        if (payment.status !== 'paid') {
            const { error: updErr } = await supabase
                .from('payments')
                .update({
                    status: 'paid',
                    paid_at: now,
                    raw_payload: decoded,
                })
                .eq('id', payment.id);
            console.log('[OSB] payment → paid', { id: payment.id, error: updErr?.message || 'ok' });
        } else {
            console.log('[OSB] payment already paid, still upgrading profile');
        }

        // ── 7. ALWAYS upgrade profile (even if payment was already paid) ──
        const days = plan === 'pro_yearly' ? 365 : 30;
        const proUntil = new Date();
        proUntil.setDate(proUntil.getDate() + days);
        const proUntilISO = proUntil.toISOString();

        // Read current profile
        const { data: currentProfile, error: readErr } = await supabase
            .from('profiles')
            .select('id, plan, plan_expires_at, pro_until')
            .eq('id', userId)
            .maybeSingle();

        console.log('[OSB] profile BEFORE update', {
            userId,
            currentPlan: currentProfile?.plan,
            currentExpires: currentProfile?.plan_expires_at,
            currentProUntil: currentProfile?.pro_until,
            readError: readErr?.message,
        });

        // Update profile — set BOTH plan_expires_at and pro_until to cover both schemas
        const updatePayload: Record<string, any> = {
            plan: 'pro',
            plan_expires_at: proUntilISO,
            pro_until: proUntilISO,
            updated_at: now,
        };

        const { data: updatedProfile, error: profErr } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', userId)
            .select('id, plan, plan_expires_at, pro_until')
            .maybeSingle();

        console.log('[OSB] profile AFTER update', {
            userId,
            updatedPlan: updatedProfile?.plan,
            updatedExpires: updatedProfile?.plan_expires_at,
            updatedProUntil: updatedProfile?.pro_until,
            days,
            until: proUntilISO,
            error: profErr?.message || 'ok',
        });

        if (profErr) {
            // Maybe pro_until column doesn't exist; try without it
            console.log('[OSB] retrying without pro_until column...');
            const { data: retry, error: retryErr } = await supabase
                .from('profiles')
                .update({ plan: 'pro', plan_expires_at: proUntilISO, updated_at: now })
                .eq('id', userId)
                .select('id, plan, plan_expires_at')
                .maybeSingle();

            console.log('[OSB] retry result', {
                plan: retry?.plan,
                expires: retry?.plan_expires_at,
                error: retryErr?.message || 'ok',
            });

            if (retryErr) {
                // Maybe plan_expires_at doesn't exist either; try just plan
                console.log('[OSB] retrying with just plan column...');
                const { error: lastErr } = await supabase
                    .from('profiles')
                    .update({ plan: 'pro' })
                    .eq('id', userId);

                console.log('[OSB] final retry', { error: lastErr?.message || 'ok' });
            }
        }

        console.log('[OSB] ✅ Done', { userId, plan, istest });
        return new Response('success', { status: 200 });

    } catch (err: any) {
        console.error('[OSB] error', err?.message || err);
        return new Response('success', { status: 200 });
    }
}
