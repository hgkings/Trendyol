import { NextResponse } from 'next/server';
import { prepareSyncContext, writeSyncLog } from '@/lib/marketplace-sync-helpers';
import { fetchProducts } from '@/lib/hepsiburada-api';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 50;

export async function POST() {
    const startedAt = new Date().toISOString();

    try {
        const { ctx, error, status } = await prepareSyncContext(undefined, 'hepsiburada');
        if (!ctx) {
            return NextResponse.json({ error }, { status });
        }

        await writeSyncLog(ctx.admin, ctx.connectionId, 'products', 'running', 'Hepsiburada ürün senkronizasyonu başladı...', startedAt);

        let totalSynced = 0;
        let page = 0;
        let totalPages = 1;

        while (page < totalPages) {
            const result = await fetchProducts(
                { apiKey: ctx.credentials.apiKey, apiSecret: ctx.credentials.apiSecret, merchantId: ctx.sellerId },
                page,
                PAGE_SIZE
            );
            totalPages = result.totalPages;

            for (const product of result.content) {
                const productId = String(product.hepsiburadaSku || product.merchantSku || product.id || '');
                if (!productId) continue;

                await ctx.admin
                    .from('hepsiburada_products_raw')
                    .upsert(
                        {
                            user_id: ctx.userId,
                            connection_id: ctx.connectionId,
                            external_product_id: productId,
                            merchant_sku: product.merchantSku || product.stockCode || null,
                            barcode: product.barcode || product.gtin || null,
                            title: product.productName || product.title || 'İsimsiz',
                            brand: product.brand || null,
                            category_path: product.categoryName || null,
                            sale_price: product.price ?? product.salePrice ?? null,
                            raw_json: product,
                        },
                        { onConflict: 'connection_id,external_product_id' }
                    );

                totalSynced++;
            }

            page++;
        }

        await ctx.admin
            .from('marketplace_connections')
            .update({ last_sync_at: new Date().toISOString(), status: 'connected' })
            .eq('id', ctx.connectionId);

        const message = `${totalSynced} ürün senkronize edildi.`;
        await writeSyncLog(ctx.admin, ctx.connectionId, 'products', 'success', message, startedAt, new Date().toISOString());

        return NextResponse.json({ success: true, synced: totalSynced, message });
    } catch (err: any) {
        console.error('[marketplace/hepsiburada/sync-products] Error:', err?.message);

        try {
            const { ctx } = await prepareSyncContext(undefined, 'hepsiburada');
            if (ctx) {
                await writeSyncLog(ctx.admin, ctx.connectionId, 'products', 'failed', `Hata: ${err?.message || 'Bilinmeyen'}`, startedAt, new Date().toISOString());
                await ctx.admin.from('marketplace_connections').update({ status: 'error' }).eq('id', ctx.connectionId);
            }
        } catch { /* ignore */ }

        return NextResponse.json({ error: 'Ürün senkronizasyonu başarısız.' }, { status: 500 });
    }
}
