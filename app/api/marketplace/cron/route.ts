import { NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptCredentials } from '@/lib/marketplace/crypto'
import { fetchProducts, fetchOrders } from '@/lib/marketplace/trendyol.api'

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

        while (page < totalPages) {
          const result = await fetchProducts(apiCreds, page, 50)
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
          const result = await fetchOrders(apiCreds, startDate, endDate, orderPage, 50)
          orderTotalPages = result.totalPages

          for (const order of result.content) {
            const orderNumber = String(order.orderNumber || order.id || '')
            if (!orderNumber) continue

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

        // TODO: Normalize — callGatewayV1Format ile entegre edilecek
        const normProducts = { matched: 0, created: 0, manual: 0 }
        const normOrders = { metricsUpdated: 0 }

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
