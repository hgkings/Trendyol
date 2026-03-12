import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(req: Request) {
    try {
        // PayTR sends callback as form-urlencoded
        const formData = await req.formData();
        const payload = Object.fromEntries(formData.entries());

        // Log all incoming fields for debugging
        console.log('[PayTR Callback] === Incoming POST ===');
        for (const [key, value] of Object.entries(payload)) {
            console.log(`[PayTR Callback]   ${key}:`, value);
        }

        const {
            merchant_oid,
            status,
            total_amount,
            hash,
        } = payload as Record<string, string>;

        // ── Hash Validation ──────────────────────────────────────
        const merchantKey = process.env.PAYTR_MERCHANT_KEY;
        const merchantSalt = process.env.PAYTR_MERCHANT_SALT;

        if (!merchantKey || !merchantSalt) {
            console.error('[PayTR Callback] PAYTR_MERCHANT_KEY or PAYTR_MERCHANT_SALT env vars missing!');
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        // PayTR Link API hash: HMAC-SHA256(merchant_oid + merchant_salt + status + total_amount, merchant_key) → base64
        const hashStr = `${merchant_oid}${merchantSalt}${status}${total_amount}`;
        const expectedHash = crypto
            .createHmac('sha256', merchantKey)
            .update(hashStr)
            .digest('base64');

        if (hash !== expectedHash) {
            console.error('[PayTR Callback] ❌ Hash mismatch!', {
                received: hash,
                expected: expectedHash,
                merchant_oid,
            });
            // Hash doğrulanamayan istekleri reddet
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        console.log('[PayTR Callback] ✅ Hash validated successfully');

        // ── Database Update ──────────────────────────────────────
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            console.error('[PayTR Callback] Supabase env vars missing!');
            return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        // PayTR Link API only sends callbacks for successful payments
        if (status === 'success') {
            // Find the oldest pending payment record (created by pricing page button click)
            const { data: payment, error: fetchError } = await supabase
                .from('payments')
                .select('*')
                .eq('status', 'created')
                .eq('provider', 'paytr')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (fetchError || !payment) {
                console.error('[PayTR Callback] ⚠️ No pending payment record found!');
                console.log('[PayTR Callback] merchant_oid:', merchant_oid);
                console.log('[PayTR Callback] total_amount:', total_amount);
                console.log('[PayTR Callback] Payment successful but no matching pending record.');
                return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
            }

            // Already paid check (idempotency)
            if (payment.status === 'paid') {
                console.log('[PayTR Callback] Payment already marked as paid');
                return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
            }

            // Update payment record with PayTR data
            await supabase
                .from('payments')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    provider_order_id: merchant_oid,
                    raw_payload: payload as any,
                })
                .eq('id', payment.id);

            // Upgrade user to Pro
            const plan = payment.plan; // 'pro_monthly' or 'pro_yearly'
            const daysToAdd = plan === 'pro_yearly' ? 365 : 30;
            const proUntil = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

            await supabase
                .from('profiles')
                .update({
                    plan: 'pro',
                    pro_until: proUntil,
                })
                .eq('id', payment.user_id);

            console.log(`[PayTR Callback] ✅ User ${payment.user_id} (${payment.email}) upgraded to Pro (${plan}) until ${proUntil}`);
        } else {
            console.log(`[PayTR Callback] ⚠️ Non-success status: ${status}, merchant_oid: ${merchant_oid}`);
        }

        return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });

    } catch (error: any) {
        console.error('[PayTR Callback] Error:', error);
        return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
}
