/**
 * Trendyol Webhook Receiver
 *
 * Trendyol bu endpoint'e sipariş/iade olaylarını POST atar.
 * Kullanıcı oturumu yoktur — sellerId ile kullanıcı bulunur.
 * Her durumda 200 döner (Trendyol 200 almazsa tekrar gönderir).
 *
 * TRENDYOL_WEBHOOK_SECRET env var ayarlıysa HMAC-SHA256 imzası doğrulanır.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createDirectClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdmin() {
    return createDirectClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function POST(request: NextRequest) {
    try {
        const webhookSecret = process.env.TRENDYOL_WEBHOOK_SECRET;
        const signature = request.headers.get('x-signature');

        const body = await request.text();

        // İmza doğrulama (secret tanımlıysa)
        if (webhookSecret) {
            const expectedSig = crypto
                .createHmac('sha256', webhookSecret)
                .update(body)
                .digest('hex');

            if (!signature || signature !== expectedSig) {
                console.warn('[trendyol/webhook] Geçersiz imza — istek reddedildi.');
                return NextResponse.json({ error: 'Geçersiz imza' }, { status: 401 });
            }
        }

        let payload: any;
        try {
            payload = JSON.parse(body);
        } catch {
            console.warn('[trendyol/webhook] Geçersiz JSON payload.');
            return NextResponse.json({ success: true }, { status: 200 });
        }

        await webhookIsle(payload);
    } catch (err: any) {
        console.error('[trendyol/webhook] İşlem hatası:', err?.message);
    }

    // Trendyol 200 almazsa tekrar gönderir — her durumda 200
    return NextResponse.json({ success: true }, { status: 200 });
}

async function webhookIsle(payload: any) {
    const { sellerId, eventType, event } = payload ?? {};
    if (!sellerId || !event) return;

    const admin = getAdmin();

    // sellerId ile kullanıcı bağlantısını bul
    const { data: connection } = await admin
        .from('marketplace_connections')
        .select('id, user_id')
        .eq('seller_id', String(sellerId))
        .eq('marketplace', 'trendyol')
        .maybeSingle();

    if (!connection) {
        console.log('[trendyol/webhook] sellerId için bağlantı bulunamadı:', sellerId);
        return;
    }

    const { user_id: userId, id: connectionId } = connection;

    // Olayı kaydet
    await admin.from('trendyol_webhook_events').insert({
        user_id: userId,
        connection_id: connectionId,
        event_type: eventType ?? null,
        seller_id: String(sellerId),
        shipment_package_id: event.shipmentPackageId ?? null,
        order_number: event.orderNumber ?? null,
        status: event.status ?? null,
        payload,
        received_at: new Date().toISOString(),
    });

    // Sipariş olaylarına göre bildirim
    if (eventType === 'OrderStatus' && event.orderNumber) {
        const orderNo = event.orderNumber;
        const status: string = event.status ?? '';

        if (status === 'Created') {
            await admin.from('notifications').insert({
                user_id: userId,
                title: 'Yeni Trendyol Siparişi',
                message: `Sipariş #${orderNo} oluşturuldu.`,
                type: 'order',
                is_read: false,
                dedupe_key: `trendyol_order_created_${orderNo}`,
            });
        } else if (status === 'Returned') {
            await admin.from('notifications').insert({
                user_id: userId,
                title: 'Trendyol İadesi',
                message: `Sipariş #${orderNo} iade edildi.`,
                type: 'return',
                is_read: false,
                dedupe_key: `trendyol_order_returned_${orderNo}`,
            });
        }
    }
}
