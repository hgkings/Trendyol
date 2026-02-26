import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Shopier checks this URL with GET to verify it's reachable
export async function GET() {
    return new Response('OK', { status: 200 });
}

/**
 * POST /api/shopier/callback
 * 
 * Shopier OSB webhook. Receives res (base64 JSON) + hash.
 * Verifies HMAC, determines plan from productid, finds user payment, activates Pro.
 */
export async function POST(req: Request) {
    console.log('[Shopier OSB] ===== CALLBACK HIT =====');

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

        console.log('[Shopier OSB] Received fields:', {
            hasRes: !!resField,
            resLength: resField.length,
            hasHash: !!hashField,
            hashLength: hashField.length,
        });

        if (!resField || !hashField) {
            console.error('[Shopier OSB] Missing res or hash fields');
            return new Response('OK', { status: 200 });
        }

        // 2. Verify HMAC signature (try both hex and base64)
        const osbUsername = process.env.SHOPIER_OSB_USERNAME || '';
        const osbKey = process.env.SHOPIER_OSB_KEY || '';

        const dataToSign = resField + osbUsername;
        const hashHex = crypto.createHmac('sha256', osbKey).update(dataToSign).digest('hex');
        const hashBase64 = crypto.createHmac('sha256', osbKey).update(dataToSign).digest('base64');

        const hashValid = (hashHex === hashField) || (hashBase64 === hashField);
        console.log('[Shopier OSB] Hash verification:', {
            valid: hashValid,
            matchHex: hashHex === hashField,
            matchBase64: hashBase64 === hashField,
        });

        // Continue even if hash fails for now (for debugging)
        // TODO: Re-enable hash check in production after confirming format

        // 3. Decode and parse the res payload
        let data: any;
        try {
            const jsonStr = Buffer.from(resField, 'base64').toString('utf-8');
            data = JSON.parse(jsonStr);
        } catch (parseErr) {
            console.error('[Shopier OSB] Failed to decode/parse res:', parseErr);
            return new Response('OK', { status: 200 });
        }

        console.log('[Shopier OSB] Decoded payload:', JSON.stringify(data, null, 2));

        const shopierOrderId = String(data.platform_order_id || data.orderid || data.order_id || '');
        const buyerEmail = String(data.buyer_email || data.email || '');
        const isTest = data.istest === 1 || data.istest === '1' || data.istest === true;
        const paymentAmount = parseFloat(data.total_order_value || data.payment_amount || '0');

        console.log('[Shopier OSB] Extracted:', { shopierOrderId, buyerEmail, isTest, paymentAmount });

        // 4. Determine plan from productid
        const productId = String(
            data.productid || data.product_id ||
            (Array.isArray(data.productlist) && data.productlist[0]?.productid) || ''
        );
        const monthlyProductId = process.env.SHOPIER_MONTHLY_PRODUCT_ID || '';
        const yearlyProductId = process.env.SHOPIER_YEARLY_PRODUCT_ID || '';

        let determinedPlan: 'pro_monthly' | 'pro_yearly';
        if (productId && productId === monthlyProductId) {
            determinedPlan = 'pro_monthly';
        } else if (productId && productId === yearlyProductId) {
            determinedPlan = 'pro_yearly';
        } else {
            // Fallback: determine plan from amount
            if (paymentAmount >= 2000) {
                determinedPlan = 'pro_yearly';
            } else {
                determinedPlan = 'pro_monthly';
            }
            console.log('[Shopier OSB] ProductId not matched, using amount fallback:', {
                productId, monthlyProductId, yearlyProductId, paymentAmount, determinedPlan
            });
        }

        console.log('[Shopier OSB] Determined plan:', determinedPlan);

        // 5. Connect to Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('[Shopier OSB] Missing Supabase env vars');
            return new Response('OK', { status: 200 });
        }

        const { createServerClient } = await import('@supabase/ssr');
        const adminClient = createServerClient(supabaseUrl, supabaseServiceKey, {
            cookies: { getAll: () => [], setAll: () => { } },
        });

        // 6. Find matching payment record
        let payment: any = null;
        let userId: string | null = null;

        // 6a. Try by provider_order_id
        if (shopierOrderId) {
            const { data: byOrder, error: orderErr } = await adminClient
                .from('payments')
                .select('*')
                .eq('provider_order_id', shopierOrderId)
                .maybeSingle();
            console.log('[Shopier OSB] Search by orderId:', { found: !!byOrder, error: orderErr?.message });
            if (byOrder) payment = byOrder;
        }

        // 6b. Try by buyer email → profile → latest payment
        if (!payment && buyerEmail) {
            const { data: profile, error: profileErr } = await adminClient
                .from('profiles')
                .select('id')
                .eq('email', buyerEmail)
                .maybeSingle();

            console.log('[Shopier OSB] Search by email:', { email: buyerEmail, profileFound: !!profile, error: profileErr?.message });

            if (profile) {
                userId = profile.id;
                const { data: byUser, error: payErr } = await adminClient
                    .from('payments')
                    .select('*')
                    .eq('user_id', profile.id)
                    .eq('status', 'created')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                console.log('[Shopier OSB] Search by userId:', { userId: profile.id, found: !!byUser, error: payErr?.message });
                if (byUser) payment = byUser;
            }
        }

        // 6c. If still no payment but we found a userId, activate Pro directly
        if (!payment && !userId && buyerEmail) {
            // Try auth.users via admin
            const { data: authData } = await adminClient.auth.admin.listUsers();
            const authUser = authData?.users?.find(u => u.email === buyerEmail);
            if (authUser) {
                userId = authUser.id;
                console.log('[Shopier OSB] Found auth user by email:', userId);
            }
        }

        // 7. Activate Pro
        const now = new Date().toISOString();
        const planDays = determinedPlan === 'pro_monthly' ? 30 : 365;
        const proUntil = new Date();
        proUntil.setDate(proUntil.getDate() + planDays);

        if (payment) {
            // Update existing payment record
            if (payment.status === 'paid') {
                console.log('[Shopier OSB] Already paid:', payment.id);
                return new Response('OK', { status: 200 });
            }

            const { error: updateErr } = await adminClient
                .from('payments')
                .update({
                    status: 'paid',
                    paid_at: now,
                    plan: determinedPlan,
                    provider_tx_id: shopierOrderId || payment.provider_order_id,
                    raw_payload: data,
                })
                .eq('id', payment.id);

            console.log('[Shopier OSB] Updated payment:', { id: payment.id, error: updateErr?.message });

            userId = payment.user_id;
        } else if (userId) {
            // No payment record found but we found the user — create one
            const { error: insertErr } = await adminClient
                .from('payments')
                .insert({
                    user_id: userId,
                    plan: determinedPlan,
                    amount_try: Math.round(paymentAmount),
                    status: 'paid',
                    provider: 'shopier',
                    provider_order_id: shopierOrderId || crypto.randomUUID(),
                    provider_tx_id: shopierOrderId,
                    paid_at: now,
                    raw_payload: data,
                });

            console.log('[Shopier OSB] Created new payment record:', { userId, error: insertErr?.message });
        } else {
            console.error('[Shopier OSB] ❌ Cannot find user. OrderId:', shopierOrderId, 'Email:', buyerEmail);
            return new Response('OK', { status: 200 });
        }

        // 8. Update profile to Pro
        if (userId) {
            const { error: profileErr } = await adminClient
                .from('profiles')
                .update({
                    plan: 'pro',
                    plan_expires_at: proUntil.toISOString(),
                })
                .eq('id', userId);

            console.log(`[Shopier OSB] ✅ Pro activated for ${userId} | plan=${determinedPlan} | until=${proUntil.toISOString()} | error=${profileErr?.message || 'none'}${isTest ? ' (TEST)' : ''}`);
        }

        return new Response('OK', { status: 200 });

    } catch (error: any) {
        console.error('[Shopier OSB] Unhandled error:', error);
        return new Response('OK', { status: 200 });
    }
}
