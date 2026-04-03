import { NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptCredentials } from '@/lib/marketplace/crypto'
import { fetchProducts, fetchOrders, fetchAllOrders } from '@/lib/marketplace/trendyol.api'
import { normalizeProducts, normalizeOrderMetrics, type RawProduct, type RawOrder, type ProductMapping } from '@/lib/marketplace/normalizer'

export const dynamic = 'force-dynamic'

/**
 * Cron endpoint — called by Vercel Cron or external scheduler.
 * Syncs all active Trendyol connections: products + orders + normalize.
 *
 * Auth: Secured by CRON_SECRET header (not user JWT).
 */
export async function GET(req: Request) {
  const cronCheck = requireCronSecret(req)
  if (cronCheck !== true) return cronCheck

  try {
    const admin = createAdminClient()

    const { data: connections } = await admin
      .from('marketplace_connections')
      .select('id, user_id, seller_id, status, marketplace_secrets(encrypted_blob)')
      .eq('marketplace', 'trendyol')
      .eq('status', 'connected')

    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: 'No active connections', synced: 0 })
    }

    const results = []

    for (const conn of connections) {
      try {
        const secrets = (conn as Record<string, unknown>).marketplace_secrets as { encrypted_blob: string }[] | null
        const encryptedBlob = secrets?.[0]?.encrypted_blob
        if (!encryptedBlob) continue

        const creds = decryptCredentials(encryptedBlob)
        const sellerId = creds.sellerId || conn.seller_id || ''
        if (!sellerId) continue

        const apiCreds = {
          apiKey: creds.apiKey,
          apiSecret: creds.apiSecret,
          sellerId,
        }

        // Sync products (all pages)
        let page = 0
        let totalPages = 1
        let productCount = 0

        const MAX_PAGES = 500
        while (page < totalPages && page < MAX_PAGES) {
          const result = await fetchProducts(apiCreds, page, 200, { approved: true })
          totalPages = result.totalPages

          for (const product of result.content) {
            const productId = String(product.id || product.productId || '')
            if (!productId) continue

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
            }, { onConflict: 'connection_id,external_product_id' })

            productCount++
          }
          page++
        }

        // Sync orders (last 3 days for incremental)
        const endDate = Date.now()
        const startDate = endDate - 3 * 24 * 60 * 60 * 1000
        let orderPage = 0
        let orderTotalPages = 1
        let orderCount = 0

        while (orderPage < orderTotalPages) {
          const result = await fetchOrders(apiCreds, startDate, endDate, orderPage, 200)
          orderTotalPages = result.totalPages

          for (const order of result.content) {
            const orderNumber = String(order.orderNumber || order.id || '')
            if (!orderNumber) continue

            // Awaiting siparişleri atla — henüz kesinleşmemiş (Trendyol resmi kuralı)
            const orderStatus = String(order.status || order.shipmentPackageStatus || '')
            if (orderStatus === 'Awaiting') continue

            await admin.from('trendyol_orders_raw').upsert({
              user_id: conn.user_id,
              connection_id: conn.id,
              order_number: orderNumber,
              order_date: order.orderDate ? new Date(order.orderDate as number).toISOString() : null,
              status: order.status || null,
              total_price: order.totalPrice ?? order.grossAmount ?? null,
              raw_json: order,
            }, { onConflict: 'connection_id,order_number' })

            orderCount++
          }
          orderPage++
        }

        // Normalize: ürünleri eşleştir
        let normProducts = { matched: 0, created: 0, manual: 0 }
        let normOrders = { metricsUpdated: 0 }

        try {
          // 1. Mevcut analizleri çek
          const { data: analyses } = await admin
            .from('analyses')
            .select('id, product_name, barcode, merchant_sku, inputs')
            .eq('user_id', conn.user_id)

          if (analyses && analyses.length > 0) {
            // 2. Tüm raw ürünleri çek
            const { data: rawRows } = await admin
              .from('trendyol_products_raw')
              .select('external_product_id, barcode, merchant_sku, title, sale_price')
              .eq('connection_id', conn.id)

            if (rawRows && rawRows.length > 0) {
              const rawProducts: RawProduct[] = rawRows.map(r => ({
                external_product_id: r.external_product_id,
                barcode: r.barcode ?? undefined,
                merchant_sku: r.merchant_sku ?? undefined,
                title: r.title ?? undefined,
                sale_price: r.sale_price ?? 0,
              }))

              const existingAnalyses = analyses.map(a => ({
                id: a.id,
                product_name: a.product_name ?? undefined,
                barcode: a.barcode ?? undefined,
                merchant_sku: a.merchant_sku ?? undefined,
                inputs: (a.inputs ?? undefined) as Record<string, unknown> | undefined,
              }))

              const normalized = normalizeProducts(rawProducts, existingAnalyses, 'trendyol')
              normProducts = { matched: normalized.matched, created: normalized.created, manual: normalized.manual }

              // Batch upsert map entries
              const mapRows = normalized.results
                .filter(r => r.mapEntry.external_product_id)
                .map(r => ({
                  user_id: conn.user_id,
                  marketplace: 'trendyol',
                  external_product_id: r.mapEntry.external_product_id,
                  merchant_sku: r.mapEntry.merchant_sku,
                  barcode: r.mapEntry.barcode,
                  external_title: r.mapEntry.external_title,
                  internal_product_id: r.internalId ?? null,
                  match_confidence: r.mapEntry.match_confidence,
                  connection_id: conn.id,
                }))

              if (mapRows.length > 0) {
                // Batch 500'lük parçalarda upsert
                for (let i = 0; i < mapRows.length; i += 500) {
                  const batch = mapRows.slice(i, i + 500)
                  await admin.from('product_marketplace_map').upsert(batch, {
                    onConflict: 'user_id,marketplace,external_product_id',
                  })
                }
              }
            }
          }

          // 3. Sipariş normalizasyonu
          const { data: rawOrders } = await admin
            .from('trendyol_orders_raw')
            .select('order_number, order_date, status, raw_json')
            .eq('connection_id', conn.id)

          const { data: mapData } = await admin
            .from('product_marketplace_map')
            .select('external_product_id, internal_product_id')
            .eq('user_id', conn.user_id)
            .eq('marketplace', 'trendyol')

          if (rawOrders && rawOrders.length > 0 && mapData) {
            const orderInputs: RawOrder[] = rawOrders.map(o => ({
              order_number: o.order_number,
              order_date: o.order_date,
              status: o.status,
              raw_json: o.raw_json as Record<string, unknown>,
            }))

            const mappings: ProductMapping[] = mapData.map(m => ({
              external_product_id: m.external_product_id,
              internal_product_id: m.internal_product_id,
            }))

            const orderResult = normalizeOrderMetrics(orderInputs, mappings, 'trendyol')
            normOrders = { metricsUpdated: orderResult.metricsUpdated }
          }
        } catch (_normError) {
          // Normalize hatası cron'u durdurmamalı
        }

        // Update last_sync_at
        await admin.from('marketplace_connections')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', conn.id)

        // Log
        await admin.from('marketplace_sync_logs').insert({
          connection_id: conn.id,
          sync_type: 'products',
          status: 'success',
          message: `Cron: ${productCount} ürün, ${orderCount} sipariş sync. ${normProducts.matched} eşleşti, ${normProducts.created} yeni, ${normOrders.metricsUpdated} metrik güncellendi.`,
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
        })

        results.push({
          connection_id: conn.id,
          products: productCount,
          orders: orderCount,
          normalized: normProducts,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bilinmeyen'
        await admin.from('marketplace_sync_logs').insert({
          connection_id: conn.id,
          sync_type: 'products',
          status: 'failed',
          message: `Cron hata: ${message}`,
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
        })
      }
    }

    return NextResponse.json({ success: true, synced: results.length, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
