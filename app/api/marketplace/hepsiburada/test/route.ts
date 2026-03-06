import { NextResponse } from 'next/server';
import { prepareSyncContext, writeSyncLog } from '@/lib/marketplace-sync-helpers';
import { testConnection } from '@/lib/hepsiburada-api';

export const dynamic = 'force-dynamic';

export async function POST() {
    const startedAt = new Date().toISOString();

    try {
        const { ctx, error, status } = await prepareSyncContext(undefined, 'hepsiburada');
        if (!ctx) {
            return NextResponse.json({ error }, { status });
        }

        const result = await testConnection({
            apiKey: ctx.credentials.apiKey,
            apiSecret: ctx.credentials.apiSecret,
            merchantId: ctx.sellerId,
        });

        await ctx.admin
            .from('marketplace_connections')
            .update({
                status: result.success ? 'connected' : 'error',
                last_sync_at: result.success ? new Date().toISOString() : undefined,
            })
            .eq('id', ctx.connectionId);

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
        console.error('[marketplace/hepsiburada/test] Error:', err?.message);
        return NextResponse.json({ error: 'Bağlantı testi başarısız.' }, { status: 500 });
    }
}
