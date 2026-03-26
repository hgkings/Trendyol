import { NextResponse } from 'next/server';
import { prepareSyncContext, writeSyncLog } from '@/lib/marketplace-sync-helpers';
import { fetchOrders } from '@/lib/trendyol-api';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 50;
const DEFAULT_DAYS_BACK = 30;

export async function POST(req: Request) {
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

        // Parse optional date range from body
        let startDate: number;
        let endDate: number;

        try {
            const body = await req.json();
            endDate = body.endDate ? new Date(body.endDate).getTime() : Date.now();
            startDate = body.startDate
                ? new Date(body.startDate).getTime()
                : endDate - DEFAULT_DAYS_BACK * 24 * 60 * 60 * 1000;
        } catch {
            endDate = Date.now();
            startDate = endDate - DEFAULT_DAYS_BACK * 24 * 60 * 60 * 1000;
        }

        // Write running log
        await writeSyncLog(ctx.admin, ctx.connectionId, 'orders', 'running', 'Sipariş senkronizasyonu başladı...', startedAt);

        let totalSynced = 0;
        let page = 0;
        let totalPages = 1;

        while (page < totalPages) {
            const result = await fetchOrders(ctx.credentials, startDate, endDate, page, PAGE_SIZE);
            totalPages = result.totalPages;

            for (const order of result.content) {
                const orderNumber = String(order.orderNumber || order.id || '');
                if (!orderNumber) continue;

                await ctx.admin
                    .from('trendyol_orders_raw')
                    .upsert(
                        {
                            user_id: ctx.userId,
                            connection_id: ctx.connectionId,
                            order_number: orderNumber,
                            order_date: order.orderDate ? new Date(order.orderDate).toISOString() : null,
                            status: order.status || null,
                            total_price: order.totalPrice ?? order.grossAmount ?? null,
                            raw_json: order,
                        },
                        { onConflict: 'connection_id,order_number' }
                    );

                totalSynced++;
            }

            page++;
        }

        // Update connection last_sync_at
        await ctx.admin
            .from('marketplace_connections')
            .update({ last_sync_at: new Date().toISOString(), status: 'connected' })
            .eq('id', ctx.connectionId);

        // Success log
        const message = `${totalSynced} sipariş senkronize edildi (son ${DEFAULT_DAYS_BACK} gün).`;
        await writeSyncLog(ctx.admin, ctx.connectionId, 'orders', 'success', message, startedAt, new Date().toISOString());

        return NextResponse.json({
            success: true,
            synced: totalSynced,
            message,
        });
    } catch (err: any) {
        console.error('[marketplace/trendyol/sync-orders] Error:', err?.message);

        try {
            const { ctx } = await prepareSyncContext();
            if (ctx) {
                await writeSyncLog(ctx.admin, ctx.connectionId, 'orders', 'failed', `Hata: ${err?.message || 'Bilinmeyen'}`, startedAt, new Date().toISOString());
                await ctx.admin.from('marketplace_connections').update({ status: 'error' }).eq('id', ctx.connectionId);
            }
        } catch { /* ignore logging errors */ }

        console.log('Trendyol URL:', `https://apigw.trendyol.com/integration/order/sellers/{sellerId}/orders`);
        return NextResponse.json({ error: 'Sipariş senkronizasyonu başarısız.', detail: err?.message }, { status: 500 });
    }
}
