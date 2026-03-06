import { NextResponse } from 'next/server';
import { prepareNormalizeContext, writeSyncLog } from '@/lib/marketplace-sync-helpers';
import { normalizeOrderMetrics } from '@/lib/marketplace-normalizer';

export const dynamic = 'force-dynamic';

export async function POST() {
    const startedAt = new Date().toISOString();

    try {
        const { ctx, error, status } = await prepareNormalizeContext('hepsiburada');
        if (!ctx) {
            return NextResponse.json({ error }, { status });
        }

        const result = await normalizeOrderMetrics(ctx.userId, ctx.connectionId, 'hepsiburada');

        const message = `Sipariş metrikleri: ${result.metricsUpdated} kayıt güncellendi, ${result.monthsCovered} ay kapsandı, ${result.unmatchedOrders} eşleşmeyen satır. Bu ay net satış: ${result.currentMonthSales}`;

        await writeSyncLog(ctx.admin, ctx.connectionId, 'orders', 'success', message, startedAt, new Date().toISOString());

        return NextResponse.json({
            success: true,
            ...result,
            message,
        });
    } catch (err: any) {
        console.error('[marketplace/hepsiburada/normalize-orders] Error:', err?.message);
        return NextResponse.json({ error: 'Sipariş normalizasyonu başarısız.' }, { status: 500 });
    }
}
