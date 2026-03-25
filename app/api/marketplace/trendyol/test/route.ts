import { NextResponse } from 'next/server';
import { prepareSyncContext, writeSyncLog } from '@/lib/marketplace-sync-helpers';
import { testConnection } from '@/lib/trendyol-api';

export const dynamic = 'force-dynamic';

export async function POST() {
    const startedAt = new Date().toISOString();

    try {
        const { ctx, error, status } = await prepareSyncContext();
        if (!ctx) {
            const isSellerIdMissing = status === 400 && error?.toLowerCase().includes('seller');
            return NextResponse.json(
                {
                    success: false,
                    error: isSellerIdMissing
                        ? 'Satıcı ID eksik. Pazaryeri ayarlarından Satıcı ID bilgisini güncelleyin.'
                        : error,
                    ...(isSellerIdMissing && { code: 'MISSING_SUPPLIER_ID' }),
                },
                { status }
            );
        }

        // Call Trendyol API to test connection
        const result = await testConnection(ctx.credentials);

        // Update connection status
        await ctx.admin
            .from('marketplace_connections')
            .update({
                status: result.success ? 'connected' : 'error',
                last_sync_at: result.success ? new Date().toISOString() : undefined,
            })
            .eq('id', ctx.connectionId);

        // Write log (no secrets!)
        await writeSyncLog(
            ctx.admin,
            ctx.connectionId,
            'test',
            result.success ? 'success' : 'failed',
            result.message,
            startedAt,
            new Date().toISOString()
        );

        return NextResponse.json({
            success: result.success,
            message: result.message,
            status: result.success ? 'connected' : 'error',
        });
    } catch (err: any) {
        console.error('[marketplace/trendyol/test] Error:', err?.message);
        return NextResponse.json({ error: 'Bağlantı testi başarısız.' }, { status: 500 });
    }
}
