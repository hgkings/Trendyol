/**
 * Trendyol Webhook Kayıt Endpoint
 *
 * Kullanıcı "Webhook Kur" butonuna bastığında çağrılır.
 * Trendyol API'sine webhook URL'ini kaydeder,
 * ardından marketplace_connections.webhook_active = true yapar.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prepareSyncContext } from '@/lib/marketplace-sync-helpers';
import { registerWebhook } from '@/lib/trendyol-api';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
    const { ctx, error, status } = await prepareSyncContext();
    if (!ctx) return NextResponse.json({ error }, { status });

    const webhookUrl =
        `${process.env.NEXT_PUBLIC_APP_URL}/api/marketplace/trendyol/webhook`;

    try {
        const result = await registerWebhook(ctx.credentials, webhookUrl);

        // Webhook başarıyla kaydedildi — bağlantıyı güncelle
        await ctx.admin
            .from('marketplace_connections')
            .update({ webhook_active: true })
            .eq('id', ctx.connectionId);

        return NextResponse.json({
            success: true,
            message: 'Webhook başarıyla kuruldu. Artık siparişler otomatik gelecek.',
            webhookUrl,
            webhookId: result.webhookId,
        });
    } catch (err: any) {
        console.error('[trendyol/webhook-register] Hata:', err?.message);
        return NextResponse.json(
            { error: err?.message || 'Webhook kurulumu başarısız.' },
            { status: 500 }
        );
    }
}
