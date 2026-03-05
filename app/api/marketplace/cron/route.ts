import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server-client';
import { decryptCredentials } from '@/lib/marketplace-crypto';
import { fetchProducts, fetchOrders } from '@/lib/trendyol-api';
import { normalizeProducts, normalizeOrderMetrics } from '@/lib/marketplace-normalizer';

export const dynamic = 'force-dynamic';

/**
 * Cron endpoint — called by Vercel Cron or external scheduler.
 * Syncs all active Trendyol connections: products + orders + normalize.
 * 
 * Auth: Secured by CRON_SECRET header (not user JWT).
 */
export async function GET(req: Request) {
    try {
        // Verify cron secret
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = getSupabaseAdmin();

        // Get all active connections
        const { data: connections } = await admin
            .from('marketplace_connections')
            .select('id, user_id, seller_id, status')
            .eq('marketplace', 'trendyol')
            .eq('status', 'connected');

        if (!connections || connections.length === 0) {
            return NextResponse.json({ message: 'No active connections', synced: 0 });
        }

        const results = [];

        for (const conn of connections) {
            try {
                // Decrypt credentials
                const { data: secret } = await admin
                    .from('marketplace_secrets')
                    .select('encrypted_blob')
                    .eq('connection_id', conn.id)
                    .single();

                if (!secret?.encrypted_blob) continue;

                const creds = decryptCredentials(secret.encrypted_blob);
                const sellerId = creds.sellerId || conn.seller_id || '';
                if (!sellerId) continue;

                const apiCreds = {
                    apiKey: creds.apiKey,
                    apiSecret: creds.apiSecret,
                    sellerId,
                };

                // Sync products (all pages)
                let page = 0;
                let totalPages = 1;
                let productCount = 0;

                while (page < totalPages) {
                    const result = await fetchProducts(apiCreds, page, 50);
                    totalPages = result.totalPages;

                    for (const product of result.content) {
                        const productId = String(product.id || product.productId || '');
                        if (!productId) continue;

                        await admin.from('trendyol_products_raw').upsert({
                            user_id: conn.user_id,
                            connection_id: conn.id,
                            external_product_id: productId,
                            merchant_sku: product.stockCode || product.merchantSku || null,
                            barcode: product.barcode || null,
                            title: product.title || product.productName || 'İsimsiz',
                            brand: product.brand || null,
                            category_path: product.categoryName || null,
                            sale_price: product.salePrice ?? null,
                            raw_json: product,
                        }, { onConflict: 'connection_id,external_product_id' });

                        productCount++;
                    }
                    page++;
                }

                // Sync orders (last 3 days for incremental)
                const endDate = Date.now();
                const startDate = endDate - 3 * 24 * 60 * 60 * 1000;
                let orderPage = 0;
                let orderTotalPages = 1;
                let orderCount = 0;

                while (orderPage < orderTotalPages) {
                    const result = await fetchOrders(apiCreds, startDate, endDate, orderPage, 50);
                    orderTotalPages = result.totalPages;

                    for (const order of result.content) {
                        const orderNumber = String(order.orderNumber || order.id || '');
                        if (!orderNumber) continue;

                        await admin.from('trendyol_orders_raw').upsert({
                            user_id: conn.user_id,
                            connection_id: conn.id,
                            order_number: orderNumber,
                            order_date: order.orderDate ? new Date(order.orderDate).toISOString() : null,
                            status: order.status || null,
                            total_price: order.totalPrice ?? order.grossAmount ?? null,
                            raw_json: order,
                        }, { onConflict: 'connection_id,order_number' });

                        orderCount++;
                    }
                    orderPage++;
                }

                // Normalize
                const normProducts = await normalizeProducts(conn.user_id, conn.id);
                const normOrders = await normalizeOrderMetrics(conn.user_id, conn.id);

                // Update last_sync_at
                await admin.from('marketplace_connections')
                    .update({ last_sync_at: new Date().toISOString() })
                    .eq('id', conn.id);

                // Log
                await admin.from('marketplace_sync_logs').insert({
                    connection_id: conn.id,
                    sync_type: 'products',
                    status: 'success',
                    message: `Cron: ${productCount} ürün, ${orderCount} sipariş sync. ${normProducts.matched} eşleşti, ${normProducts.created} yeni, ${normOrders.metricsUpdated} metrik güncellendi.`,
                    started_at: new Date().toISOString(),
                    finished_at: new Date().toISOString(),
                });

                results.push({
                    connection_id: conn.id,
                    products: productCount,
                    orders: orderCount,
                    normalized: normProducts,
                });
            } catch (err: any) {
                console.error(`[cron] Connection ${conn.id} error:`, err?.message);
                await admin.from('marketplace_sync_logs').insert({
                    connection_id: conn.id,
                    sync_type: 'products',
                    status: 'failed',
                    message: `Cron hata: ${err?.message || 'Bilinmeyen'}`,
                    started_at: new Date().toISOString(),
                    finished_at: new Date().toISOString(),
                });
            }
        }

        return NextResponse.json({ success: true, synced: results.length, results });
    } catch (err: any) {
        console.error('[marketplace/cron] Error:', err?.message);
        return NextResponse.json({ error: 'Cron job başarısız.' }, { status: 500 });
    }
}
