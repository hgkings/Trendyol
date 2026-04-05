import { requireAuth, resolveConnectionId, errorResponse } from '@/lib/api/helpers'
import { decrypt } from '@/lib/db/db.helper'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchProducts, fetchOrders } from '@/lib/marketplace/trendyol.api'

export const dynamic = 'force-dynamic'

/**
 * GET /api/marketplace/trendyol/stock
 * Trendyol'dan güncel stok + fiyat + fotoğraf çeker — DB'ye yazmadan direkt döner.
 */
export async function GET() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const connectionId = await resolveConnectionId(user.id, 'trendyol')
    if (connectionId instanceof Response) return connectionId

    // Credentials çöz
    const admin = createAdminClient()
    const { data: secretRow } = await admin
      .from('marketplace_secrets')
      .select('encrypted_blob')
      .eq('connection_id', connectionId)
      .single()

    if (!secretRow?.encrypted_blob) {
      return Response.json({ success: false, error: 'Bağlantı bilgileri bulunamadı' }, { status: 404 })
    }

    const creds = JSON.parse(decrypt(secretRow.encrypted_blob)) as {
      apiKey: string; apiSecret: string; sellerId: string
    }

    // Trendyol'dan tüm ürünleri çek
    const products: Array<{
      id: string; title: string; barcode: string; stockCode: string;
      salePrice: number; listPrice: number; quantity: number;
      imageUrl: string | null; categoryName: string; brand: string;
      productUrl: string | null;
      monthlySales: number;
    }> = []

    let page = 0
    let totalPages = 1
    while (page < totalPages && page < 50) {
      const result = await fetchProducts(creds, page, 200, { approved: true })
      for (const p of result.content) {
        const images = (p.images as Array<{ url: string }>) ?? []
        products.push({
          id: String(p.id ?? ''),
          title: (p.title as string) ?? '',
          barcode: (p.barcode as string) ?? '',
          stockCode: (p.stockCode as string) ?? '',
          salePrice: (p.salePrice as number) ?? 0,
          listPrice: (p.listPrice as number) ?? 0,
          quantity: (p.quantity as number) ?? 0,
          imageUrl: images[0]?.url ?? null,
          categoryName: (p.categoryName as string) ?? '',
          brand: (p.brand as string) ?? '',
          productUrl: p.productUrl
            ? String(p.productUrl)
            : (p.productContentId ? `https://www.trendyol.com/-p-${p.productContentId}` : null),
          monthlySales: 0,
        })
      }
      totalPages = result.totalPages
      page++
    }

    // Son 30 günün sipariş verisi — barcode bazlı satış adedi
    let orderStats: { totalOrders: number; matchedProducts: number; allBarcodes: string[] } = { totalOrders: 0, matchedProducts: 0, allBarcodes: [] }
    try {
      // Tüm aktif siparişler sayılır — sadece iptal/iade hariç
      const EXCLUDED_STATUSES = ['Cancelled', 'Returned', 'ReturnAccepted', 'ReturnedAndRefunded', 'UnSupplied']
      const salesByBarcode = new Map<string, number>()
      const endTs = Date.now()
      const startTs = endTs - 30 * 24 * 60 * 60 * 1000
      const WINDOW_MS = 13 * 24 * 60 * 60 * 1000

      let windowStart = startTs
      while (windowStart < endTs) {
        const windowEnd = Math.min(windowStart + WINDOW_MS, endTs)
        let orderPage = 0
        let orderTotalPages = 1
        while (orderPage < orderTotalPages && orderPage < 10) {
          const orderResult = await fetchOrders(creds, windowStart, windowEnd, orderPage, 200)
          for (const order of orderResult.content) {
            const status = String(order.status ?? order.shipmentPackageStatus ?? '')
            if (EXCLUDED_STATUSES.includes(status)) continue
            const lines = (order.lines ?? order.orderItems ?? []) as Array<Record<string, unknown>>
            for (const line of lines) {
              const lineStatus = String(line.orderLineItemStatusName ?? status)
              if (EXCLUDED_STATUSES.includes(lineStatus)) continue
              const barcode = String(line.barcode ?? '').trim().toLowerCase()
              const stockCode = String(line.stockCode ?? '').trim().toLowerCase()
              const qty = Number(line.quantity ?? 1)
              if (barcode) salesByBarcode.set(barcode, (salesByBarcode.get(barcode) ?? 0) + qty)
              if (stockCode && stockCode !== barcode) salesByBarcode.set(stockCode, (salesByBarcode.get(stockCode) ?? 0) + qty)
            }
          }
          orderTotalPages = orderResult.totalPages
          orderPage++
        }
        windowStart = windowEnd
      }

      // Satış adedini ürünlere yaz — barcode + stockCode ile eşleştir
      let matchedProducts = 0
      for (const p of products) {
        const byBarcode = p.barcode ? salesByBarcode.get(p.barcode.toLowerCase()) : undefined
        const byStockCode = p.stockCode ? salesByBarcode.get(p.stockCode.toLowerCase()) : undefined
        const sales = byBarcode ?? byStockCode ?? 0
        if (sales > 0) {
          p.monthlySales = sales
          matchedProducts++
        }
      }

      orderStats = {
        totalOrders: salesByBarcode.size,
        matchedProducts,
        allBarcodes: Array.from(salesByBarcode.keys()).slice(0, 10),
      }
    } catch {
      // Sipariş verisi opsiyonel — hata olursa satış 0 kalır
    }

    // Stok özeti
    const outOfStock = products.filter(p => p.quantity === 0).length
    const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= 5).length
    const totalStock = products.reduce((sum, p) => sum + p.quantity, 0)

    return Response.json({
      success: true,
      totalProducts: products.length,
      totalStock,
      outOfStock,
      lowStock,
      products,
      orderStats,
    })
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
