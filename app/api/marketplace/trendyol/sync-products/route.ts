import { NextResponse } from 'next/server';
import { prepareSyncContext, writeSyncLog } from '@/lib/marketplace-sync-helpers';
import { fetchProducts } from '@/lib/trendyol-api';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 50;

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

        // Write running log
        await writeSyncLog(ctx.admin, ctx.connectionId, 'products', 'running', 'Ürün senkronizasyonu başladı...', startedAt);

        let totalSynced = 0;
        let page = 0;
        let totalPages = 1;

        while (page < totalPages) {
            const result = await fetchProducts(ctx.credentials, page, PAGE_SIZE);
            totalPages = result.totalPages;

            // Upsert each product into trendyol_products_raw
            for (const product of result.content) {
                const productId = String(product.id || product.productId || '');
                if (!productId) continue;

                await ctx.admin
                    .from('trendyol_products_raw')
                    .upsert(
                        {
                            user_id: ctx.userId,
                            connection_id: ctx.connectionId,
                            external_product_id: productId,
                            merchant_sku: product.stockCode || product.merchantSku || null,
                            barcode: product.barcode || null,
                            title: product.title || product.productName || 'İsimsiz',
                            brand: product.brand || null,
                            category_path: product.categoryName || product.ppiCategoryName || null,
                            sale_price: product.salePrice ?? null,
                            raw_json: product,
                        },
                        { onConflict: 'connection_id,external_product_id' }
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
        const message = `${totalSynced} ürün senkronize edildi.`;
        await writeSyncLog(ctx.admin, ctx.connectionId, 'products', 'success', message, startedAt, new Date().toISOString());

        return NextResponse.json({
            success: true,
            synced: totalSynced,
            message,
        });
    } catch (err: any) {
        console.error('[marketplace/trendyol/sync-products] Error:', err?.message);

        // Try to log the failure
        try {
            const { ctx } = await prepareSyncContext();
            if (ctx) {
                await writeSyncLog(ctx.admin, ctx.connectionId, 'products', 'failed', `Hata: ${err?.message || 'Bilinmeyen'}`, startedAt, new Date().toISOString());
                await ctx.admin.from('marketplace_connections').update({ status: 'error' }).eq('id', ctx.connectionId);
            }
        } catch { /* ignore logging errors */ }

        return NextResponse.json({ error: 'Ürün senkronizasyonu başarısız.', detail: err?.message }, { status: 500 });
    }
}
