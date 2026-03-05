import { NextResponse } from 'next/server';
import { prepareSyncContext, writeSyncLog } from '@/lib/marketplace-sync-helpers';
import { normalizeProducts, normalizeOrderMetrics } from '@/lib/marketplace-normalizer';

export const dynamic = 'force-dynamic';

export async function POST() {
    const startedAt = new Date().toISOString();

    try {
        const { ctx, error, status } = await prepareSyncContext();
        if (!ctx) {
            return NextResponse.json({ error }, { status });
        }

        // Normalize products
        const productResult = await normalizeProducts(ctx.userId, ctx.connectionId);

        // Normalize orders → metrics
        const orderResult = await normalizeOrderMetrics(ctx.userId, ctx.connectionId);

        const message = `Eşleştirme: ${productResult.matched} eşleşti, ${productResult.created} yeni oluşturuldu, ${productResult.manual} manuel gerekli. Sipariş metrikleri: ${orderResult.metricsUpdated} güncellendi, bu ay: ${orderResult.currentMonthSales} adet.`;

        await writeSyncLog(
            ctx.admin,
            ctx.connectionId,
            'products',
            'success',
            message,
            startedAt,
            new Date().toISOString()
        );

        return NextResponse.json({
            success: true,
            products: productResult,
            orders: orderResult,
            message,
        });
    } catch (err: any) {
        console.error('[marketplace/trendyol/normalize] Error:', err?.message);
        return NextResponse.json({ error: 'Normalizasyon başarısız.' }, { status: 500 });
    }
}
