import { getPlanDays } from '@/config/pricing';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shopier/callback
 * 
 * Shopier OSB (Otomatik Sipariş Bildirimi) webhook.
 * Incoming: res (base64 JSON) + hash
 * Verify: HMAC_SHA256(res + OSB_USERNAME, OSB_KEY)
 * 
 * With fixed product URLs, Shopier generates its own order IDs.
 * We match payments by finding the latest "created" payment for the buyer email,
 * or by matching provider_order_id if the OSB includes our platform_order_id.
 * 
 * Respond: "success"
 */
export async function POST(req: Request) {
    try {
        // 1. Parse form data
        const contentType = req.headers.get('content-type') || '';
        let resField = '';
        let hashField = '';

        if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await req.formData();
            resField = (formData.get('res') || '').toString();
            hashField = (formData.get('hash') || '').toString();
        } else {
            const text = await req.text();
            const params = new URLSearchParams(text);
            resField = params.get('res') || '';
            hashField = params.get('hash') || '';
        }

        if (!resField || !hashField) {
            console.error('[Shopier OSB] Missing res or hash fields');
            return new Response('MISSING_FIELDS', { status: 400 });
        }

        // 2. Verify HMAC signature
        const osbUsername = process.env.SHOPIER_OSB_USERNAME || '';
        const osbKey = process.env.SHOPIER_OSB_KEY || process.env.SHOPIER_OSB_PASSWORD || '';

        if (!osbKey) {
            console.error('[Shopier OSB] SHOPIER_OSB_KEY not configured!');
            return new Response('SERVER_CONFIG_ERROR', { status: 500 });
        }

        const dataToSign = resField + osbUsername;
        const expectedHash = crypto
            .createHmac('sha256', osbKey)
            .update(dataToSign)
            .digest('hex');

        if (expectedHash !== hashField) {
            console.error('[Shopier OSB] Hash mismatch!');
            return new Response('INVALID_HASH', { status: 403 });
        }

        // 3. Decode and parse
        const jsonStr = Buffer.from(resField, 'base64').toString('utf-8');
        const data = JSON.parse(jsonStr);

        console.log('[Shopier OSB] Verified callback data:', JSON.stringify(data, null, 2));

        const shopierOrderId = data.orderid || data.order_id || data.platform_order_id || '';
        const buyerEmail = data.buyer_email || data.email || '';
        const isTest = data.istest === 1 || data.istest === '1' || data.istest === true;
        const paymentTotal = parseFloat(data.total_order_value || data.payment_amount || '0');

        if (isTest) {
            console.log('[Shopier OSB] 🧪 Test order:', shopierOrderId);
        }

        // 4. Supabase env guard
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('[Shopier OSB] Missing Supabase env vars');
            return new Response('SERVER_CONFIG_ERROR', { status: 500 });
        }

        const { createServerClient } = await import('@supabase/ssr');
        const adminClient = createServerClient(supabaseUrl, supabaseServiceKey, {
            cookies: { getAll: () => [], setAll: () => { } },
        });

        // 5. Try to find matching payment:
        //    a) First try by provider_order_id (if our UUID was passed through)
        //    b) Then try by buyer email (latest "created" payment)
        let payment: any = null;

        if (shopierOrderId) {
            const { data: byOrder } = await adminClient
                .from('payments')
                .select('*')
                .eq('provider_order_id', shopierOrderId)
                .eq('status', 'created')
                .single();
            if (byOrder) payment = byOrder;
        }

        if (!payment && buyerEmail) {
            // Find user by email, then their latest created payment
            const { data: profile } = await adminClient
                .from('profiles')
                .select('id')
                .eq('email', buyerEmail)
                .single();

            if (profile) {
                const { data: byUser } = await adminClient
                    .from('payments')
                    .select('*')
                    .eq('user_id', profile.id)
                    .eq('status', 'created')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                if (byUser) payment = byUser;
            }
        }

        if (!payment) {
            console.warn('[Shopier OSB] No matching payment found. Order:', shopierOrderId, 'Email:', buyerEmail);
            // Still return success so Shopier doesn't keep retrying
            return new Response('success', { status: 200 });
        }

        // 6. Idempotency
        if (payment.status === 'paid') {
            console.log('[Shopier OSB] Already paid:', payment.id);
            return new Response('success', { status: 200 });
        }

        // 7. Mark paid
        const now = new Date().toISOString();
        await adminClient
            .from('payments')
            .update({
                status: 'paid',
                paid_at: now,
                provider_tx_id: shopierOrderId || payment.provider_order_id,
                raw_payload: data,
            })
            .eq('id', payment.id);

        // 8. Activate Pro
        const planDays = getPlanDays(payment.plan);
        const proUntil = new Date();
        proUntil.setDate(proUntil.getDate() + planDays);

        await adminClient
            .from('profiles')
            .update({
                plan: 'pro',
                plan_expires_at: proUntil.toISOString(),
            })
            .eq('id', payment.user_id);

        console.log(`[Shopier OSB] ✅ Pro activated for ${payment.user_id} until ${proUntil.toISOString()}${isTest ? ' (TEST)' : ''}`);

        return new Response('success', { status: 200 });

    } catch (error: any) {
        console.error('[Shopier OSB] Error:', error);
        return new Response('SERVER_ERROR', { status: 500 });
    }
}
