// ----------------------------------------------------------------
// MarketplaceLogic — Katman 6
// Trendyol / Hepsiburada baglanti yonetimi ve sync.
// KNOWLEDGE-BASE.md Section 3.
// ----------------------------------------------------------------

import { ServiceError } from '@/lib/gateway/types'
import { encrypt, decrypt } from '@/lib/db/db.helper'
// crypto.ts kullanılmıyor — db.helper.ts encrypt/decrypt ile uyumlu (aynı MARKETPLACE_SECRET_KEY, base64 format)
import * as trendyolApi from '@/lib/marketplace/trendyol.api'
import * as hepsiburadaApi from '@/lib/marketplace/hepsiburada.api'
import type { MarketplaceRepository } from '@/repositories/marketplace.repository'
import type { ProductRepository } from '@/repositories/product.repository'
import type { AnalysisRepository } from '@/repositories/analysis.repository'
import {
  normalizeProducts,
  normalizeOrderMetrics,
  type RawProduct,
  type RawOrder,
  type ProductMapping,
} from '@/lib/marketplace/normalizer'

// ----------------------------------------------------------------
// Tipler
// ----------------------------------------------------------------

export type MarketplaceType = 'trendyol' | 'hepsiburada'
export type ConnectionStatus = 'disconnected' | 'pending_test' | 'connected' | 'error'

export interface MarketplaceConnection {
  id: string
  userId: string
  marketplace: MarketplaceType
  status: ConnectionStatus
  storeName: string | null
  sellerId: string | null
  lastSyncAt: string | null
  webhookActive: boolean
}

export interface ConnectPayload {
  marketplace: MarketplaceType
  apiKey: string
  apiSecret: string
  sellerId: string
  storeName?: string
}

export interface SyncResult {
  productsCount: number
  ordersCount: number
  syncedAt: string
}

// ----------------------------------------------------------------
// Servis
// ----------------------------------------------------------------

export class MarketplaceLogic {
  constructor(
    private readonly marketplaceRepo: MarketplaceRepository,
    private readonly productRepo: ProductRepository,
    private readonly analysisRepo: AnalysisRepository,
  ) {}

  /**
   * Marketplace baglantisi kurar.
   * Credentials AES-256-GCM ile sifrelenir (DBHelper).
   */
  async connect(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ connectionId: string; status: ConnectionStatus; message?: string; storeName?: string | null }> {
    const input = payload as ConnectPayload

    if (!input.apiKey || !input.apiSecret || !input.sellerId) {
      throw new ServiceError('API anahtarları ve satıcı ID\'si zorunludur', {
        code: 'MISSING_CREDENTIALS',
        statusCode: 400,
        traceId,
      })
    }

    if (!['trendyol', 'hepsiburada'].includes(input.marketplace)) {
      throw new ServiceError('Desteklenmeyen pazaryeri', {
        code: 'UNSUPPORTED_MARKETPLACE',
        statusCode: 400,
        traceId,
      })
    }

    // Credentials sifrele (hata durumunda anlamlı mesaj ver)
    let encryptedBlob: string
    try {
      encryptedBlob = encrypt(JSON.stringify({
        apiKey: input.apiKey,
        apiSecret: input.apiSecret,
        sellerId: input.sellerId,
      }))
    } catch (encErr) {
      const msg = encErr instanceof Error ? encErr.message : ''
      if (msg.includes('MARKETPLACE_SECRET_KEY')) {
        throw new ServiceError('Sunucu şifreleme anahtarı ayarlanmamış. Yöneticinize başvurun.', {
          code: 'ENCRYPTION_KEY_MISSING',
          statusCode: 500,
          traceId,
        })
      }
      throw new ServiceError('Şifreleme hatası oluştu', {
        code: 'ENCRYPTION_FAILED',
        statusCode: 500,
        traceId,
      })
    }

    // Mevcut baglanti var mi kontrol et (UNIQUE constraint korunmasi)
    const existing = await this.marketplaceRepo.getConnectionsByUserId(userId)
    const existingConn = existing.find(c => c.marketplace === input.marketplace)

    let connectionId: string

    if (existingConn) {
      // Mevcut baglanti var — durumu, bilgileri ve secrets'i guncelle
      connectionId = existingConn.id
      await this.marketplaceRepo.updateConnectionStatus(connectionId, 'pending_test')

      // store_name ve seller_id güncelle (kullanıcı değiştirmiş olabilir)
      await this.marketplaceRepo.updateConnectionDetails(connectionId, {
        store_name: input.storeName,
        seller_id: input.sellerId,
      })

      // Secrets upsert (connection_id üzerinde unique constraint var)
      await this.marketplaceRepo.storeSecrets(connectionId, encryptedBlob)
    } else {
      // Yeni baglanti olustur
      const connection = await this.marketplaceRepo.createConnection({
        user_id: userId,
        marketplace: input.marketplace,
        store_name: input.storeName,
        seller_id: input.sellerId,
        status: 'pending_test',
      })
      connectionId = connection.id
      await this.marketplaceRepo.storeSecrets(connectionId, encryptedBlob)
    }

    // Doğrudan connected yap — doğrulama sync sırasında yapılır
    // (Vercel 10sn timeout nedeniyle connect içinde API çağrısı riskli)
    await this.marketplaceRepo.updateConnectionStatus(connectionId, 'connected')

    return {
      connectionId,
      status: 'connected' as ConnectionStatus,
      message: 'Bağlantı kaydedildi. Ürünleri senkronize etmek için "Ürünleri Senkronla" butonuna basın.',
    }
  }

  /**
   * Marketplace baglantisini keser.
   * Cascade delete: marketplace_secrets da silinir.
   */
  async disconnect(
    _traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ success: boolean }> {
    const { connectionId } = payload as { connectionId: string }
    await this.marketplaceRepo.deleteConnection(connectionId, userId)
    return { success: true }
  }

  /**
   * Marketplace urunlerini ceker.
   */
  async syncProducts(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ count: number; message: string }> {
    const { connectionId } = payload as { connectionId: string }

    if (!connectionId) {
      throw new ServiceError('Bağlantı ID\'si zorunludur', {
        code: 'MISSING_CONNECTION_ID',
        statusCode: 400,
        traceId,
      })
    }

    // Sync log baslat
    const syncLog = await this.marketplaceRepo.createSyncLog({
      connection_id: connectionId,
      sync_type: 'products',
      status: 'running',
    })

    try {
      // Credentials coz
      const secretRow = await this.marketplaceRepo.getSecrets(connectionId)
      if (!secretRow) {
        throw new ServiceError('Bağlantı bilgileri bulunamadı', {
          code: 'SECRETS_NOT_FOUND',
          statusCode: 404,
          traceId,
        })
      }

      const credentials = JSON.parse(decrypt(secretRow.encrypted_blob)) as {
        apiKey: string; apiSecret: string; sellerId: string
      }

      // Bağlantı tipini bul
      const connection = await this.marketplaceRepo.getConnectionById(connectionId)
      let productsCount = 0

      if (connection?.marketplace === 'trendyol') {
        const page = await trendyolApi.fetchProducts(credentials)
        productsCount = page.totalElements
      } else if (connection?.marketplace === 'hepsiburada') {
        const hbCreds = { apiKey: credentials.apiKey, apiSecret: credentials.apiSecret, merchantId: credentials.sellerId }
        const result = await hepsiburadaApi.fetchAllProducts(hbCreds)
        productsCount = result.totalCount
      }

      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'success', `${productsCount} ürün senkronize edildi`)
      return { count: productsCount, message: `${productsCount} ürün senkronize edildi` }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'failed', msg)
      throw error
    }
  }

  /**
   * Marketplace siparislerini ceker.
   */
  async syncOrders(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ count: number; message: string }> {
    const { connectionId } = payload as { connectionId: string }

    if (!connectionId) {
      throw new ServiceError('Bağlantı ID\'si zorunludur', {
        code: 'MISSING_CONNECTION_ID',
        statusCode: 400,
        traceId,
      })
    }

    // Sync log baslat
    const syncLog = await this.marketplaceRepo.createSyncLog({
      connection_id: connectionId,
      sync_type: 'orders',
      status: 'running',
    })

    try {
      const secretRow = await this.marketplaceRepo.getSecrets(connectionId)
      if (!secretRow) {
        throw new ServiceError('Bağlantı bilgileri bulunamadı', {
          code: 'SECRETS_NOT_FOUND',
          statusCode: 404,
          traceId,
        })
      }

      const credentials = JSON.parse(decrypt(secretRow.encrypted_blob)) as {
        apiKey: string; apiSecret: string; sellerId: string
      }

      // Bağlantı tipini bul
      const connection = await this.marketplaceRepo.getConnectionById(connectionId)
      let ordersCount = 0
      const endMs = Date.now()
      const startMs = endMs - 30 * 24 * 60 * 60 * 1000

      if (connection?.marketplace === 'trendyol') {
        const orders = await trendyolApi.fetchAllOrders(credentials, startMs, endMs)
        ordersCount = orders.length
      } else if (connection?.marketplace === 'hepsiburada') {
        const hbCreds = { apiKey: credentials.apiKey, apiSecret: credentials.apiSecret, merchantId: credentials.sellerId }
        const orders = await hepsiburadaApi.fetchAllOrders(hbCreds, new Date(startMs), new Date(endMs))
        ordersCount = orders.length
      }

      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'success', `${ordersCount} sipariş senkronize edildi`)
      await this.marketplaceRepo.updateLastSyncAt(connectionId)
      return { count: ordersCount, message: `${ordersCount} sipariş senkronize edildi` }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'failed', msg)
      throw error
    }
  }

  /**
   * Belirli marketplace baglanti durumunu UI formatinda dondurur.
   * UI ConnectionState bekler: { connected, connection_id, status, store_name, seller_id, last_sync_at, webhook_active }
   */
  async getStatus(
    _traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{
    connected: boolean
    connection_id?: string
    status: string
    store_name?: string
    seller_id?: string
    last_sync_at?: string
    webhook_active?: boolean
  }> {
    const { marketplace } = (payload ?? {}) as { marketplace?: string }
    const connections = await this.marketplaceRepo.getConnectionsByUserId(userId)

    // Marketplace filtresi varsa o marketplace'in bağlantısını bul
    const conn = marketplace
      ? connections.find(c => c.marketplace === marketplace)
      : connections[0]

    if (!conn) {
      return { connected: false, status: 'disconnected' }
    }

    const status = (conn.status as string) ?? 'disconnected'
    return {
      connected: status === 'connected',
      connection_id: conn.id as string,
      status,
      store_name: (conn.store_name as string) ?? undefined,
      seller_id: (conn.seller_id as string) ?? undefined,
      last_sync_at: (conn.last_sync_at as string) ?? undefined,
      webhook_active: (conn.webhook_active as boolean) ?? false,
    }
  }

  // ----------------------------------------------------------------
  // Trendyol-specific metodlar
  // ----------------------------------------------------------------

  async syncTrendyolProducts(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ count: number; message: string }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveCredentials(connectionId, traceId)

    const syncLog = await this.marketplaceRepo.createSyncLog({
      connection_id: connectionId,
      sync_type: 'products',
      status: 'running',
    })

    try {
      // Tüm ürünleri sayfalama ile çek
      const allProducts: Record<string, unknown>[] = []
      let page = 0
      let totalPages = 1
      while (page < totalPages && page < 500) {
        const result = await trendyolApi.fetchProducts(creds, page, 200, { approved: true })
        allProducts.push(...result.content)
        totalPages = result.totalPages
        page++
      }

      // Normalizer ile eşleştir ve analizlere yaz
      const analyses = await this.analysisRepo.findByUserId(userId)
      const rawProducts: RawProduct[] = allProducts.map(p => ({
        external_product_id: String(p.id ?? ''),
        barcode: (p.barcode as string) ?? undefined,
        merchant_sku: (p.stockCode as string) ?? undefined,
        title: (p.title as string) ?? undefined,
        sale_price: (p.salePrice as number) ?? 0,
        quantity: (p.quantity as number) ?? 0,
        image_url: ((p.images as Array<{ url: string }>) ?? [])[0]?.url ?? undefined,
      }))

      const existingAnalyses = analyses.map(a => ({
        id: a.id,
        product_name: a.product_name ?? undefined,
        barcode: a.barcode ?? undefined,
        merchant_sku: a.merchant_sku ?? undefined,
        inputs: (a.inputs ?? undefined) as Record<string, unknown> | undefined,
      }))
      const normalized = normalizeProducts(rawProducts, existingAnalyses, 'trendyol')

      // Sonuçları DB'ye yaz
      const mapBatchRows: Array<{
        user_id: string; marketplace: string; external_product_id: string;
        merchant_sku?: string; barcode?: string; external_title?: string;
        internal_product_id?: string; match_confidence: string; connection_id?: string;
      }> = []
      let dbWritten = 0
      let dbErrors = 0
      for (const r of normalized.results) {
        try {
          if (r.internalId && r.analysisUpdate) {
            // barcode/sku'yu inputs JSONB'ye de yaz (frontend stockMap eşleşmesi için)
            const existingA = analyses.find(a => a.id === r.internalId)
            const mergedInputs = { ...(existingA?.inputs ?? {}), ...(r.analysisUpdate.inputs ?? {}) } as Record<string, unknown>
            if (r.analysisUpdate.barcode) mergedInputs.barcode = r.analysisUpdate.barcode
            if (r.analysisUpdate.merchant_sku) mergedInputs.merchant_sku = r.analysisUpdate.merchant_sku

            const updateData: Record<string, unknown> = {
              barcode: r.analysisUpdate.barcode,
              merchant_sku: r.analysisUpdate.merchant_sku,
              marketplace_source: r.analysisUpdate.marketplace_source,
              auto_synced: true,
              inputs: mergedInputs,
            }
            if (r.analysisUpdate.outputs) updateData.outputs = r.analysisUpdate.outputs
            await this.analysisRepo.update(r.internalId, updateData)
            dbWritten++
          } else if (r.newAnalysis) {
            // Yeni analiz — barcode/sku'yu inputs'a da yaz
            const newInputs = { ...(r.newAnalysis.inputs ?? {}) } as Record<string, unknown>
            if (r.newAnalysis.barcode) newInputs.barcode = r.newAnalysis.barcode
            if (r.newAnalysis.merchant_sku) newInputs.merchant_sku = r.newAnalysis.merchant_sku
            const newRow = await this.analysisRepo.create({
              user_id: userId,
              marketplace: r.newAnalysis.marketplace,
              product_name: r.newAnalysis.product_name,
              barcode: r.newAnalysis.barcode,
              merchant_sku: r.newAnalysis.merchant_sku,
              marketplace_source: r.newAnalysis.marketplace_source,
              auto_synced: true,
              inputs: newInputs,
              outputs: r.newAnalysis.outputs,
              risk_score: r.newAnalysis.risk_score,
              risk_level: r.newAnalysis.risk_level,
            })
            r.mapEntry.internal_product_id = newRow.id
            dbWritten++
          }
        } catch (_dbErr) {
          dbErrors++
          continue // Bu ürün başarısız — diğerlerine devam
        }

        mapBatchRows.push({
          user_id: userId,
          marketplace: r.mapEntry.marketplace,
          external_product_id: r.mapEntry.external_product_id,
          merchant_sku: r.mapEntry.merchant_sku ?? undefined,
          barcode: r.mapEntry.barcode ?? undefined,
          external_title: r.mapEntry.external_title,
          internal_product_id: r.mapEntry.internal_product_id ?? undefined,
          match_confidence: r.mapEntry.match_confidence,
          connection_id: connectionId,
        })
      }

      if (mapBatchRows.length > 0) {
        await this.productRepo.upsertMapBatch(mapBatchRows)
      }

      const count = allProducts.length
      const errInfo = dbErrors > 0 ? `, ${dbErrors} hata` : ''
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'success',
        `${count} çekildi, ${dbWritten} DB'ye yazıldı${errInfo}`)
      await this.marketplaceRepo.updateLastSyncAt(connectionId)
      return { count: dbWritten, message: `${dbWritten}/${count} ürün kaydedildi${errInfo}` }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'failed', msg)
      throw error
    }
  }

  async syncTrendyolOrders(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ count: number; message: string }> {
    const { connectionId, days } = payload as { connectionId: string; days?: number }
    const creds = await this.resolveCredentials(connectionId, traceId)

    const syncLog = await this.marketplaceRepo.createSyncLog({
      connection_id: connectionId,
      sync_type: 'orders',
      status: 'running',
    })

    try {
      const end = new Date()
      const start = new Date(end.getTime() - (days ?? 30) * 24 * 60 * 60 * 1000)
      const orders = await trendyolApi.fetchAllOrders(creds, start.getTime(), end.getTime())

      // Sipariş metriklerini hesapla ve kaydet
      const mapRows = await this.productRepo.getMapByUserId(userId, 'trendyol')
      const productMappings: ProductMapping[] = mapRows.map(m => ({
        external_product_id: m.external_product_id,
        internal_product_id: m.internal_product_id,
      }))

      const rawOrders: RawOrder[] = orders.map(o => ({
        order_number: String(o.orderNumber ?? o.id ?? ''),
        order_date: o.orderDate ? new Date(o.orderDate as number).toISOString() : new Date().toISOString(),
        status: (o.status ?? o.shipmentPackageStatus ?? 'Unknown') as string,
        raw_json: o as Record<string, unknown>,
      }))

      const result = normalizeOrderMetrics(rawOrders, productMappings, 'trendyol')

      // Satış metriklerini kaydet
      for (const metric of result.metrics) {
        await this.productRepo.upsertSalesMetrics({
          user_id: userId,
          internal_product_id: metric.internal_product_id,
          marketplace: metric.marketplace,
          period_month: metric.period_month,
          sold_qty: metric.sold_qty,
          returned_qty: metric.returned_qty,
          gross_revenue: metric.gross_revenue,
          net_revenue: metric.net_revenue,
        })
      }

      // Otomatik satış adedini güncelle + monthly_sales_volume'a yaz
      for (const update of result.autoSalesUpdates) {
        const analysis = await this.analysisRepo.findByIdAndUserId(update.productId, userId)
        if (analysis && update.netQty > 0) {
          const inputs = (analysis.inputs ?? {}) as Record<string, unknown>
          inputs.monthly_sales_volume = update.netQty
          await this.analysisRepo.update(update.productId, {
            auto_sales_qty: update.netQty,
            inputs,
          })
        } else {
          await this.analysisRepo.update(update.productId, { auto_sales_qty: update.netQty })
        }
      }

      // Fallback: sipariş satırlarındaki barcode/productName ile analiz eşleştir
      // Trendyol sipariş satırlarında barcode, productName, stockCode mevcut (docs doğruladı)
      const allAnalyses = await this.analysisRepo.findByUserId(userId)
      if (allAnalyses.length > 0 && orders.length > 0) {
        const SOLD_STATUSES = ['Created', 'Picking', 'Invoiced', 'Shipped', 'Delivered', 'AtCollectionPoint']
        const salesByBarcode = new Map<string, number>()
        const salesByTitle = new Map<string, number>()
        const salesBySku = new Map<string, number>()

        for (const order of orders) {
          const status = String(order.status ?? order.shipmentPackageStatus ?? '')
          if (!SOLD_STATUSES.includes(status)) continue
          const lines = (order.lines ?? order.orderItems ?? []) as Array<Record<string, unknown>>
          for (const line of lines) {
            const qty = Number(line.quantity ?? 1)
            // Trendyol sipariş satırında barcode, productName, stockCode direkt var
            const barcode = String(line.barcode ?? '').trim()
            const title = String(line.productName ?? '').trim().toLowerCase()
            const sku = String(line.stockCode ?? line.merchantSku ?? '').trim()
            // Satır bazlı durum kontrolü (varsa)
            const lineStatus = String(line.orderLineItemStatusName ?? status)
            if (lineStatus === 'Cancelled' || lineStatus === 'Returned') continue

            if (barcode) salesByBarcode.set(barcode, (salesByBarcode.get(barcode) ?? 0) + qty)
            if (title) salesByTitle.set(title, (salesByTitle.get(title) ?? 0) + qty)
            if (sku) salesBySku.set(sku, (salesBySku.get(sku) ?? 0) + qty)
          }
        }

        for (const a of allAnalyses) {
          if (a.auto_sales_qty && a.auto_sales_qty > 0) continue
          const inputs = (a.inputs ?? {}) as Record<string, unknown>
          const aBarcode = String(inputs.barcode ?? '').trim()
          const aSku = String(inputs.merchant_sku ?? '').trim()
          const aName = String(a.product_name ?? '').trim().toLowerCase()
          const normName = aName.replace(/[\s\-_./]+/g, '')

          let matched = 0
          if (aBarcode && salesByBarcode.has(aBarcode)) {
            matched = salesByBarcode.get(aBarcode)!
          } else if (aSku && salesBySku.has(aSku)) {
            matched = salesBySku.get(aSku)!
          } else if (aName && salesByTitle.has(aName)) {
            matched = salesByTitle.get(aName)!
          } else if (normName) {
            for (const [title, qty] of salesByTitle) {
              if (title.replace(/[\s\-_./]+/g, '') === normName) {
                matched = qty
                break
              }
            }
          }

          if (matched > 0) {
            inputs.monthly_sales_volume = matched
            await this.analysisRepo.update(a.id, {
              auto_sales_qty: matched,
              inputs,
            })
          }
        }
      }

      const count = orders.length
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'success', `${count} sipariş çekildi, ${result.metricsUpdated} metrik güncellendi`)
      await this.marketplaceRepo.updateLastSyncAt(connectionId)
      return { count, message: `${count} sipariş senkronize edildi` }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'failed', msg)
      throw error
    }
  }

  async updateTrendyolStockPrice(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ batchRequestId: string; updatedCount: number }> {
    const { connectionId, items } = payload as {
      connectionId: string
      items: Array<{ barcode: string; quantity?: number; salePrice?: number; listPrice?: number }>
    }
    const creds = await this.resolveCredentials(connectionId, traceId)
    const result = await trendyolApi.updateStockAndPrice(creds, items)
    return { batchRequestId: result.batchRequestId, updatedCount: items.length }
  }

  // ── Sipariş Aksiyonları ──────────────────────────────────────

  async getPendingOrders(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ orders: Array<Record<string, unknown>> }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveCredentials(connectionId, traceId)
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const result = await trendyolApi.fetchOrders(creds, weekAgo, now, 0, 200)
    const pending = result.content.filter(o => {
      const status = String(o.shipmentPackageStatus ?? o.status ?? '')
      return ['Created', 'Picking', 'Awaiting', 'Invoiced'].includes(status)
    })
    return { orders: pending }
  }

  async updateOrderStatus(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { connectionId, shipmentPackageId, status, trackingNumber, invoiceNumber } = payload as {
      connectionId: string; shipmentPackageId: number; status: string;
      trackingNumber?: string; invoiceNumber?: string
    }
    const creds = await this.resolveCredentials(connectionId, traceId)
    const lines = [{ lineId: 0, quantity: 1 }]
    await trendyolApi.updatePackageStatus(creds, shipmentPackageId, status as 'Picking' | 'Invoiced', lines, invoiceNumber)
    return { success: true }
  }

  async markOrderUnsupplied(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { connectionId, shipmentPackageId, lineItems } = payload as {
      connectionId: string; shipmentPackageId: number; lineItems: Array<{ lineId: number; quantity: number }>
    }
    const creds = await this.resolveCredentials(connectionId, traceId)
    await trendyolApi.markUnsupplied(creds, shipmentPackageId, lineItems, 1) // reasonId 1 = default
    return { success: true }
  }

  async splitOrderPackage(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { connectionId, shipmentPackageId, splitGroups } = payload as {
      connectionId: string; shipmentPackageId: number; splitGroups: Array<{ lineId: number; quantity: number }[]>
    }
    const creds = await this.resolveCredentials(connectionId, traceId)
    // splitGroups: [[{lineId, qty}], [{lineId, qty}]] → flat [{orderLineId, qty}]
    const flatItems = splitGroups.flat().map(g => ({ orderLineId: g.lineId, quantity: g.quantity }))
    await trendyolApi.splitPackage(creds, shipmentPackageId, flatItems)
    return { success: true }
  }

  async updateOrderBoxInfo(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { connectionId, shipmentPackageId, boxQuantity, deci } = payload as {
      connectionId: string; shipmentPackageId: number; boxQuantity: number; deci: number
    }
    const creds = await this.resolveCredentials(connectionId, traceId)
    await trendyolApi.updateBoxInfo(creds, shipmentPackageId, boxQuantity, deci)
    return { success: true }
  }

  async changeOrderCargo(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { connectionId, shipmentPackageId, cargoProviderCode } = payload as {
      connectionId: string; shipmentPackageId: number; cargoProviderCode: string
    }
    const creds = await this.resolveCredentials(connectionId, traceId)
    await trendyolApi.changeCargoProvider(creds, shipmentPackageId, cargoProviderCode)
    return { success: true }
  }

  async sendTrendyolInvoiceLink(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { connectionId, shipmentPackageId, invoiceLink, invoiceNumber, invoiceDate } = payload as {
      connectionId: string; shipmentPackageId: number; invoiceLink: string;
      invoiceNumber?: string; invoiceDate?: string
    }
    const creds = await this.resolveCredentials(connectionId, traceId)
    const dateTs = invoiceDate ? new Date(invoiceDate).getTime() : Date.now()
    await trendyolApi.sendInvoiceLink(creds, shipmentPackageId, invoiceLink, invoiceNumber ?? '', dateTs)
    return { success: true }
  }

  // ── İade Aksiyonları ──────────────────────────────────────

  async approveTrendyolClaim(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { connectionId, claimId, claimLineItemIds } = payload as {
      connectionId: string; claimId: string; claimLineItemIds: string[]
    }
    const creds = await this.resolveCredentials(connectionId, traceId)
    await trendyolApi.approveClaim(creds, claimId, claimLineItemIds)
    return { success: true }
  }

  async rejectTrendyolClaim(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { connectionId, claimId, claimLineItemIds, reasonId, description } = payload as {
      connectionId: string; claimId: string; claimLineItemIds: string[];
      reasonId: number; description?: string
    }
    const creds = await this.resolveCredentials(connectionId, traceId)
    await trendyolApi.rejectClaim(creds, claimId, reasonId, claimLineItemIds, description ?? '')
    return { success: true }
  }

  async getTrendyolClaimReasons(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ reasons: Array<{ id: number; name: string }> }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveCredentials(connectionId, traceId)
    const reasons = await trendyolApi.getClaimIssueReasons(creds)
    return { reasons }
  }

  // ── Müşteri Soruları ──────────────────────────────────────

  async getTrendyolQuestions(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ questions: trendyolApi.QuestionItem[]; totalElements: number }> {
    const { connectionId, status, page } = payload as {
      connectionId: string; status?: string; page?: number
    }
    const creds = await this.resolveCredentials(connectionId, traceId)
    const validStatuses = ['WAITING_FOR_ANSWER', 'ANSWERED', 'REPORTED', 'REJECTED', 'UNANSWERED'] as const
    type QStatus = typeof validStatuses[number]
    const qStatus = validStatuses.includes(status as QStatus) ? (status as QStatus) : 'WAITING_FOR_ANSWER'
    const result = await trendyolApi.getQuestions(creds, {
      status: qStatus,
      page: page ?? 0,
      size: 50,
    })
    return { questions: result.content, totalElements: result.totalElements }
  }

  async answerTrendyolQuestion(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { connectionId, questionId, answer } = payload as {
      connectionId: string; questionId: number; answer: string
    }
    const creds = await this.resolveCredentials(connectionId, traceId)
    await trendyolApi.answerQuestion(creds, questionId, answer)
    return { success: true }
  }

  // ── Satıcı Bilgileri ──────────────────────────────────────

  async getTrendyolSellerAddresses(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ addresses: trendyolApi.SellerAddress[] }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveCredentials(connectionId, traceId)
    const addresses = await trendyolApi.getSellerAddresses(creds)
    return { addresses }
  }

  async getOrderCount(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ totalOrders: number }> {
    const { connectionId, days } = payload as { connectionId: string; days?: number }
    const creds = await this.resolveCredentials(connectionId, traceId)

    const endTs = Date.now()
    const startTs = endTs - (days ?? 30) * 24 * 60 * 60 * 1000
    const WINDOW_MS = 13 * 24 * 60 * 60 * 1000 // Trendyol max 2 hafta — 13 gün güvenli

    let totalOrders = 0
    let windowStart = startTs
    while (windowStart < endTs) {
      const windowEnd = Math.min(windowStart + WINDOW_MS, endTs)
      const result = await trendyolApi.fetchOrders(creds, windowStart, windowEnd, 0, 1)
      totalOrders += result.totalElements
      windowStart = windowEnd
    }

    return { totalOrders }
  }

  async getDailyProfit(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{
    days: Array<{ date: string; label: string; profit: number }>;
    totalRevenue: number; revenueChange: number; revenueGoal: number; goalPercent: number;
  }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveCredentials(connectionId, traceId)

    // Son 7 gün siparişlerini çek
    const now = new Date()
    const labels = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt']
    const days: Array<{ date: string; label: string; profit: number; revenue: number }> = []

    // Analizlerden maliyet bilgisi: barcode/title → { cost, commission_pct }
    const allAnalyses = await this.analysisRepo.findByUserId(userId)
    const costByName = new Map<string, { cost: number; commPct: number }>()
    for (const a of allAnalyses) {
      const inp = (a.inputs ?? {}) as Record<string, unknown>
      const name = String(a.product_name ?? '').trim().toLowerCase()
      const barcode = String(inp.barcode ?? '').trim()
      const cost = Number(inp.product_cost ?? 0)
      const commPct = Number(inp.commission_pct ?? 18)
      if (name) costByName.set(name, { cost, commPct })
      if (barcode) costByName.set(barcode, { cost, commPct })
    }

    const SOLD = ['Created', 'Picking', 'Invoiced', 'Shipped', 'Delivered', 'AtCollectionPoint']

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d)
      dayEnd.setHours(23, 59, 59, 999)

      let dayProfit = 0
      let dayRevenue = 0
      try {
        const result = await trendyolApi.fetchOrders(creds, d.getTime(), dayEnd.getTime(), 0, 200)
        for (const order of result.content) {
          const status = String(order.shipmentPackageStatus ?? order.status ?? '')
          if (!SOLD.includes(status)) continue
          const lines = (order.lines ?? order.orderItems ?? []) as Array<Record<string, unknown>>
          for (const line of lines) {
            const lineStatus = String(line.orderLineItemStatusName ?? status)
            if (lineStatus === 'Cancelled' || lineStatus === 'Returned') continue
            const qty = Number(line.quantity ?? 1)
            const price = Number(line.lineUnitPrice ?? line.lineGrossAmount ?? line.amount ?? 0)
            const commission = Number(line.commission ?? 0)
            const barcode = String(line.barcode ?? '').trim()
            const title = String(line.productName ?? '').trim().toLowerCase()

            const info = costByName.get(barcode) ?? costByName.get(title)
            const productCost = info?.cost ?? 0

            const lineRevenue = price * qty
            const lineProfit = (price - productCost - (commission / 100 * price)) * qty
            dayRevenue += lineRevenue
            dayProfit += lineProfit
          }
        }
      } catch { /* gün verisi opsiyonel */ }

      days.push({
        date: d.toISOString().split('T')[0],
        label: labels[d.getDay()],
        profit: Math.round(dayProfit * 100) / 100,
        revenue: Math.round(dayRevenue * 100) / 100,
      })
    }

    // Bu ay toplam ciro (son 7 günün toplamı yaklaşık)
    const totalRevenue = days.reduce((s, d) => s + d.revenue, 0)
    // Geçen aya göre değişim — basit tahmin (7 gün ortalaması × 30)
    const revenueGoal = 60000 // default hedef
    const goalPercent = revenueGoal > 0 ? Math.min(100, Math.round((totalRevenue / revenueGoal) * 100)) : 0

    return {
      days: days.map(d => ({ date: d.date, label: d.label, profit: d.profit })),
      totalRevenue: Math.round(totalRevenue),
      revenueChange: 0, // ilk versiyon — karşılaştırma sonra
      revenueGoal,
      goalPercent,
    }
  }

  async getOrderSummary(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{
    today: number; todayChange: number; shipped: number;
    pending: number; cancelled: number; pendingOver24h: number; activeClaims: number
  }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveCredentials(connectionId, traceId)

    const now = Date.now()
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const WINDOW_MS = 13 * 24 * 60 * 60 * 1000

    // Son 30 günün siparişlerini çek (13 günlük pencerelerle)
    const allOrders: Array<Record<string, unknown>> = []
    let wStart = thirtyDaysAgo
    while (wStart < now) {
      const wEnd = Math.min(wStart + WINDOW_MS, now)
      let pg = 0; let tp = 1
      while (pg < tp && pg < 10) {
        const result = await trendyolApi.fetchOrders(creds, wStart, wEnd, pg, 200)
        allOrders.push(...result.content)
        tp = result.totalPages; pg++
      }
      wStart = wEnd
    }

    let todayCount = 0; let yesterdayCount = 0
    let shipped = 0; let pending = 0; let cancelled = 0; let pendingOver24h = 0

    const h24Ago = now - 24 * 60 * 60 * 1000

    for (const o of allOrders) {
      const status = String(o.shipmentPackageStatus ?? o.status ?? '')
      const orderDate = Number(o.orderDate ?? 0)

      if (orderDate >= todayStart.getTime()) todayCount++
      else if (orderDate >= yesterdayStart.getTime()) yesterdayCount++

      // Kargolanan + teslim edilen
      if (status === 'Shipped' || status === 'Delivered' || status === 'AtCollectionPoint') shipped++
      // İptal
      else if (status === 'Cancelled' || status === 'Returned' || status === 'ReturnAccepted' || status === 'ReturnedAndRefunded' || status === 'UnSupplied') cancelled++
      // Bekleyen (tüm aktif statüler)
      else if (status === 'Created' || status === 'Picking' || status === 'Awaiting' || status === 'Invoiced' || status === 'UnPacked') {
        pending++
        if (orderDate > 0 && orderDate < h24Ago) pendingOver24h++
      }
    }

    const todayChange = yesterdayCount > 0 ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100) : 0

    // Açık iade talepleri
    let activeClaims = 0
    try {
      const end = new Date()
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
      const claims = await trendyolApi.fetchAllClaims(creds, start, end)
      activeClaims = claims.length
    } catch { /* claims opsiyonel */ }

    return { today: todayCount, todayChange, shipped, pending, cancelled, pendingOver24h, activeClaims }
  }

  async getTrendyolClaims(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ claims: trendyolApi.TrendyolClaim[] }> {
    const { connectionId, days } = payload as { connectionId: string; days?: number }
    const creds = await this.resolveCredentials(connectionId, traceId)

    const end = new Date()
    const start = new Date(end.getTime() - (days ?? 90) * 24 * 60 * 60 * 1000)
    const claims = await trendyolApi.fetchAllClaims(creds, start, end)
    return { claims }
  }

  async getTrendyolFinance(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ settlements: trendyolApi.SellerSettlement[]; otherFinancials: trendyolApi.OtherFinancial[] }> {
    const { connectionId, days, startDate, endDate } = payload as {
      connectionId: string; days?: number; startDate?: string; endDate?: string
    }
    const creds = await this.resolveCredentials(connectionId, traceId)

    // Öncelik: explicit startDate/endDate > days hesaplaması
    let startStr: string
    let endStr: string

    if (startDate && endDate) {
      // YYYY-MM-DD formatında olmalı (Trendyol beklentisi)
      startStr = startDate.split('T')[0]
      endStr = endDate.split('T')[0]
    } else {
      const end = new Date()
      const start = new Date(end.getTime() - (days ?? 30) * 24 * 60 * 60 * 1000)
      startStr = start.toISOString().split('T')[0]
      endStr = end.toISOString().split('T')[0]
    }

    // Finans API — hata olursa boş dizi dön ama mesajı ilet
    let settlements: trendyolApi.SellerSettlement[] = []
    let otherFinancials: trendyolApi.OtherFinancial[] = []
    let financeError: string | undefined

    const results = await Promise.allSettled([
      trendyolApi.getSellerSettlements(creds, startStr, endStr),
      trendyolApi.getOtherFinancials(creds, startStr, endStr),
    ])

    if (results[0].status === 'fulfilled') {
      settlements = results[0].value
    } else {
      financeError = results[0].reason instanceof Error ? results[0].reason.message : 'Hakediş verisi alınamadı'
    }

    if (results[1].status === 'fulfilled') {
      otherFinancials = results[1].value
    }

    return {
      settlements,
      otherFinancials,
      ...(financeError ? { warning: financeError } : {}),
    }
  }

  async normalizeTrendyol(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ matched: number; created: number; manual: number }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveCredentials(connectionId, traceId)

    // 1. Tum urunleri cek (sayfalama — size 200, resmi max)
    const allProducts: Record<string, unknown>[] = []
    let page = 0
    let totalPages = 1
    while (page < totalPages) {
      const result = await trendyolApi.fetchProducts(creds, page, 200, { approved: true })
      allProducts.push(...result.content)
      totalPages = result.totalPages
      page++
    }

    // 2. Mevcut analizleri cek
    const analyses = await this.analysisRepo.findByUserId(userId)

    // 3. Raw → RawProduct formatina map et
    const rawProducts: RawProduct[] = allProducts.map(p => ({
      external_product_id: String(p.id ?? ''),
      barcode: (p.barcode as string) ?? undefined,
      merchant_sku: (p.stockCode as string) ?? undefined,
      title: (p.title as string) ?? undefined,
      sale_price: (p.salePrice as number) ?? 0,
    }))

    // 4. Normalizer cagir (AnalysisRow → ExistingAnalysis uyumlulugu)
    const existingAnalyses = analyses.map(a => ({
      id: a.id,
      product_name: a.product_name ?? undefined,
      barcode: a.barcode ?? undefined,
      merchant_sku: a.merchant_sku ?? undefined,
      inputs: (a.inputs ?? undefined) as Record<string, unknown> | undefined,
    }))
    const normalized = normalizeProducts(rawProducts, existingAnalyses, 'trendyol')

    // 5. Sonuclari DB'ye yaz
    // Batch optimizasyonu — N+1 sorgu yerine toplu islem
    const mapBatchRows: Array<{
      user_id: string; marketplace: string; external_product_id: string;
      merchant_sku?: string; barcode?: string; external_title?: string;
      internal_product_id?: string; match_confidence: string; connection_id?: string;
    }> = []

    for (const r of normalized.results) {
      if (r.internalId && r.analysisUpdate) {
        // Eslesme bulundu — analiz guncelle (sirayla, ID gerekli)
        const updateData: Record<string, unknown> = {
          barcode: r.analysisUpdate.barcode,
          merchant_sku: r.analysisUpdate.merchant_sku,
          marketplace_source: r.analysisUpdate.marketplace_source,
          auto_synced: true,
        }
        if (r.analysisUpdate.inputs) {
          updateData.inputs = r.analysisUpdate.inputs
        }
        await this.analysisRepo.update(r.internalId, updateData)

        mapBatchRows.push({
          user_id: userId, marketplace: r.mapEntry.marketplace,
          external_product_id: r.mapEntry.external_product_id,
          merchant_sku: r.mapEntry.merchant_sku ?? undefined,
          barcode: r.mapEntry.barcode ?? undefined,
          external_title: r.mapEntry.external_title,
          internal_product_id: r.internalId,
          match_confidence: r.mapEntry.match_confidence,
          connection_id: connectionId,
        })
      } else if (r.newAnalysis) {
        // Yeni urun — analiz olustur, sonra map batch'e ekle
        const newRow = await this.analysisRepo.create({
          user_id: userId,
          marketplace: r.newAnalysis.marketplace,
          product_name: r.newAnalysis.product_name,
          barcode: r.newAnalysis.barcode,
          merchant_sku: r.newAnalysis.merchant_sku,
          marketplace_source: r.newAnalysis.marketplace_source,
          auto_synced: true,
          inputs: r.newAnalysis.inputs,
          outputs: r.newAnalysis.outputs,
          risk_score: r.newAnalysis.risk_score,
          risk_level: r.newAnalysis.risk_level,
        })
        mapBatchRows.push({
          user_id: userId, marketplace: r.mapEntry.marketplace,
          external_product_id: r.mapEntry.external_product_id,
          merchant_sku: r.mapEntry.merchant_sku ?? undefined,
          barcode: r.mapEntry.barcode ?? undefined,
          external_title: r.mapEntry.external_title,
          internal_product_id: newRow.id,
          match_confidence: r.mapEntry.match_confidence,
          connection_id: connectionId,
        })
      } else {
        // Manuel eslestirme gerekli — batch'e ekle
        mapBatchRows.push({
          user_id: userId, marketplace: r.mapEntry.marketplace,
          external_product_id: r.mapEntry.external_product_id,
          merchant_sku: r.mapEntry.merchant_sku ?? undefined,
          barcode: r.mapEntry.barcode ?? undefined,
          external_title: r.mapEntry.external_title,
          match_confidence: 'manual_required',
          connection_id: connectionId,
        })
      }
    }

    // Tum map satirlarini tek batch ile kaydet
    if (mapBatchRows.length > 0) {
      await this.productRepo.upsertMapBatch(mapBatchRows)
    }

    return { matched: normalized.matched, created: normalized.created, manual: normalized.manual }
  }

  async normalizeTrendyolOrders(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ metricsUpdated: number; unmatchedOrders: number }> {
    const { connectionId, days } = payload as { connectionId: string; days?: number }
    const creds = await this.resolveCredentials(connectionId, traceId)

    // 1. Son N gun siparisleri cek
    const end = new Date()
    const start = new Date(end.getTime() - (days ?? 30) * 24 * 60 * 60 * 1000)
    const orders = await trendyolApi.fetchAllOrders(creds, start.getTime(), end.getTime())

    // 2. Urun eslestirme haritasini cek
    const mapRows = await this.productRepo.getMapByUserId(userId, 'trendyol')
    const productMappings: ProductMapping[] = mapRows.map(m => ({
      external_product_id: m.external_product_id,
      internal_product_id: m.internal_product_id,
    }))

    // 3. Siparisleri RawOrder formatina map et
    const rawOrders: RawOrder[] = orders.map(o => ({
      order_number: String(o.orderNumber ?? o.id ?? ''),
      order_date: (o.orderDate as string) ?? new Date().toISOString(),
      status: (o.status as string) ?? 'Unknown',
      raw_json: o as Record<string, unknown>,
    }))

    // 4. Normalizer cagir
    const result = normalizeOrderMetrics(rawOrders, productMappings, 'trendyol')

    // 5. Metrikleri kaydet
    for (const metric of result.metrics) {
      await this.productRepo.upsertSalesMetrics({
        user_id: userId,
        internal_product_id: metric.internal_product_id,
        marketplace: metric.marketplace,
        period_month: metric.period_month,
        sold_qty: metric.sold_qty,
        returned_qty: metric.returned_qty,
        gross_revenue: metric.gross_revenue,
        net_revenue: metric.net_revenue,
      })
    }

    // 6. Otomatik satis adedini guncelle
    for (const update of result.autoSalesUpdates) {
      await this.analysisRepo.update(update.productId, {
        auto_sales_qty: update.netQty,
      })
    }

    return { metricsUpdated: result.metricsUpdated, unmatchedOrders: result.unmatchedOrders }
  }

  async getTrendyolUnsuppliedOrders(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ orders: Record<string, unknown>[] }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveCredentials(connectionId, traceId)
    const orders = await trendyolApi.fetchAskidakiSiparisler(creds)
    return { orders }
  }

  async registerTrendyolWebhook(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ registration: trendyolApi.WebhookRegistration }> {
    const { connectionId, webhookUrl } = payload as { connectionId: string; webhookUrl: string }
    const creds = await this.resolveCredentials(connectionId, traceId)
    const registration = await trendyolApi.registerWebhook(creds, webhookUrl)
    await this.marketplaceRepo.updateConnectionStatus(connectionId, 'connected')
    return { registration }
  }

  async handleTrendyolWebhook(
    _traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ processed: boolean; ordersProcessed?: number }> {
    try {
      const body = payload as Record<string, unknown>
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()

      // Trendyol webhook formatı: { content: [...sipariş paketleri...] } veya tek event
      const content = (body.content as Array<Record<string, unknown>>) ?? [body]

      const SOLD_STATUSES = ['Created', 'Picking', 'Invoiced', 'Shipped', 'Delivered', 'AtCollectionPoint', 'Verified']
      let ordersProcessed = 0

      for (const event of content) {
        const eventType = String(event.shipmentPackageStatus ?? event.status ?? event.eventType ?? 'unknown')
        const orderNumber = String(event.orderNumber ?? '')
        const shipmentPackageId = typeof event.shipmentPackageId === 'number' ? event.shipmentPackageId : null
        const sellerId = String(event.sellerId ?? event.supplierId ?? '')

        // 1. Event'i DB'ye kaydet
        let eventId: string | null = null
        if (sellerId) {
          try {
            const { data: insertedEvent } = await admin.from('trendyol_webhook_events').insert({
              event_type: eventType,
              seller_id: sellerId,
              shipment_package_id: shipmentPackageId,
              order_number: orderNumber,
              status: eventType,
              payload: event,
              processed: false,
            }).select('id').single()
            eventId = insertedEvent?.id ?? null
          } catch { /* DB hatası webhook işlemeyi durdurmamalı */ }
        }

        // 2. Sipariş satırlarını işle — satış verisi güncelle
        if (SOLD_STATUSES.includes(eventType) || eventType === 'Cancelled' || eventType === 'Returned') {
          const lines = (event.lines ?? event.orderItems ?? []) as Array<Record<string, unknown>>

          // Seller ID'den user bul
          let userId: string | null = null
          if (sellerId) {
            try {
              const { data: conn } = await admin
                .from('marketplace_connections')
                .select('user_id')
                .eq('seller_id', sellerId)
                .eq('marketplace', 'trendyol')
                .single()
              userId = conn?.user_id ?? null
            } catch { /* bağlantı bulunamazsa atla */ }
          }

          if (userId && lines.length > 0) {
            // Kullanıcının analizlerini getir
            const allAnalyses = await this.analysisRepo.findByUserId(userId)

            for (const line of lines) {
              const barcode = String(line.barcode ?? '').trim()
              const productName = String(line.productName ?? '').trim().toLowerCase()
              const qty = Number(line.quantity ?? 1)
              const lineStatus = String(line.orderLineItemStatusName ?? eventType)

              if (!barcode && !productName) continue

              // Analiz eşleştir (barcode veya ürün adı ile)
              const matchedAnalysis = allAnalyses.find(a => {
                const inputs = (a.inputs ?? {}) as Record<string, unknown>
                const aBarcode = String(inputs.barcode ?? '').trim()
                const aName = String(a.product_name ?? '').trim().toLowerCase()
                if (aBarcode && aBarcode === barcode) return true
                if (aName && aName === productName) return true
                if (aName && productName) {
                  return aName.replace(/[\s\-_./]+/g, '') === productName.replace(/[\s\-_./]+/g, '')
                }
                return false
              })

              if (matchedAnalysis) {
                const currentQty = matchedAnalysis.auto_sales_qty ?? 0
                const isSale = SOLD_STATUSES.includes(lineStatus)
                const isReturn = lineStatus === 'Cancelled' || lineStatus === 'Returned'

                let newQty = currentQty
                if (isSale) newQty = currentQty + qty
                else if (isReturn) newQty = Math.max(0, currentQty - qty)

                if (newQty !== currentQty) {
                  const inputs = (matchedAnalysis.inputs ?? {}) as Record<string, unknown>
                  inputs.monthly_sales_volume = newQty
                  await this.analysisRepo.update(matchedAnalysis.id, {
                    auto_sales_qty: newQty,
                    inputs,
                  })
                  // Bellekteki analizi de güncelle (sonraki satırlar için)
                  matchedAnalysis.auto_sales_qty = newQty
                }
              }
            }
            ordersProcessed++

            // 2b. Kullanıcıya bildirim gönder
            const isSaleEvent = SOLD_STATUSES.includes(eventType)
            const isReturnEvent = eventType === 'Cancelled' || eventType === 'Returned'
            const lineCount = lines.length
            const totalAmount = lines.reduce((sum, l) => sum + Number(l.lineGrossAmount ?? l.lineUnitPrice ?? 0), 0)

            try {
              const notifTitle = isSaleEvent
                ? `Yeni siparis: ${orderNumber}`
                : isReturnEvent
                  ? `Iade/Iptal: ${orderNumber}`
                  : `Siparis guncellendi: ${orderNumber}`
              const notifMessage = isSaleEvent
                ? `${lineCount} urun, toplam ${totalAmount.toFixed(2)} TL`
                : isReturnEvent
                  ? `${lineCount} urun iade/iptal edildi`
                  : `Durum: ${eventType}`

              await admin.from('notifications').insert({
                user_id: userId,
                type: isReturnEvent ? 'warning' : 'info',
                category: 'marketplace',
                title: notifTitle,
                message: notifMessage,
                is_read: false,
                dedupe_key: `webhook-${orderNumber}-${eventType}`,
              })
            } catch { /* bildirim opsiyonel */ }
          }
        }

        // 3. Event'i processed olarak işaretle
        if (eventId) {
          try {
            await admin.from('trendyol_webhook_events').update({ processed: true }).eq('id', eventId)
          } catch { /* */ }
        }
      }

      return { processed: true, ordersProcessed }
    } catch (_error) {
      return { processed: false }
    }
  }

  // ----------------------------------------------------------------
  // Hepsiburada-specific metodlar
  // ----------------------------------------------------------------

  async syncHepsiburadaProducts(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ count: number; message: string }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveHbCredentials(connectionId, traceId)

    const syncLog = await this.marketplaceRepo.createSyncLog({
      connection_id: connectionId,
      sync_type: 'products',
      status: 'running',
    })

    try {
      const result = await hepsiburadaApi.fetchAllProducts(creds)
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'success', `${result.totalCount} ürün çekildi`)
      await this.marketplaceRepo.updateLastSyncAt(connectionId)
      return { count: result.totalCount, message: `${result.totalCount} ürün senkronize edildi` }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'failed', msg)
      throw error
    }
  }

  async syncHepsiburadaOrders(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ count: number; message: string }> {
    const { connectionId, days } = payload as { connectionId: string; days?: number }
    const creds = await this.resolveHbCredentials(connectionId, traceId)

    const syncLog = await this.marketplaceRepo.createSyncLog({
      connection_id: connectionId,
      sync_type: 'orders',
      status: 'running',
    })

    try {
      const end = new Date()
      const start = new Date(end.getTime() - (days ?? 30) * 24 * 60 * 60 * 1000)
      const orders = await hepsiburadaApi.fetchAllOrders(creds, start, end)
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'success', `${orders.length} sipariş çekildi`)
      await this.marketplaceRepo.updateLastSyncAt(connectionId)
      return { count: orders.length, message: `${orders.length} sipariş senkronize edildi` }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'failed', msg)
      throw error
    }
  }

  async getHepsiburadaClaims(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<unknown> {
    const { connectionId, days } = payload as { connectionId: string; days?: number }
    const creds = await this.resolveHbCredentials(connectionId, traceId)

    const end = new Date()
    const start = new Date(end.getTime() - (days ?? 90) * 24 * 60 * 60 * 1000)
    return hepsiburadaApi.getClaims(creds, start, end)
  }

  async getHepsiburadaFinance(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<unknown> {
    const { connectionId, days } = payload as { connectionId: string; days?: number }
    const creds = await this.resolveHbCredentials(connectionId, traceId)

    const end = new Date()
    const start = new Date(end.getTime() - (days ?? 30) * 24 * 60 * 60 * 1000)
    return hepsiburadaApi.getFinanceRecords(creds, start, end)
  }

  async normalizeHepsiburada(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ matched: number; created: number; manual: number }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveHbCredentials(connectionId, traceId)

    // 1. Tum urunleri cek
    const { items: allProducts } = await hepsiburadaApi.fetchAllProducts(creds)

    // 2. Mevcut analizleri cek
    const analyses = await this.analysisRepo.findByUserId(userId)

    // 3. Raw → RawProduct formatina map et
    const rawProducts: RawProduct[] = allProducts.map(p => ({
      external_product_id: String(p.hepsiburadaSku ?? p.merchantSku ?? ''),
      barcode: (p.barcode as string) ?? undefined,
      merchant_sku: (p.merchantSku as string) ?? undefined,
      title: (p.productName as string) ?? (p.urunAdi as string) ?? undefined,
      sale_price: (p.price as number) ?? (p.fiyat as number) ?? 0,
    }))

    // 4. Normalizer cagir (AnalysisRow → ExistingAnalysis uyumlulugu)
    const existingAnalyses = analyses.map(a => ({
      id: a.id,
      product_name: a.product_name ?? undefined,
      barcode: a.barcode ?? undefined,
      merchant_sku: a.merchant_sku ?? undefined,
      inputs: (a.inputs ?? undefined) as Record<string, unknown> | undefined,
    }))
    const normalized = normalizeProducts(rawProducts, existingAnalyses, 'hepsiburada')

    // 5. Sonuclari DB'ye yaz
    for (const r of normalized.results) {
      if (r.internalId && r.analysisUpdate) {
        await this.productRepo.upsertMap({
          user_id: userId,
          marketplace: r.mapEntry.marketplace,
          external_product_id: r.mapEntry.external_product_id,
          merchant_sku: r.mapEntry.merchant_sku ?? undefined,
          barcode: r.mapEntry.barcode ?? undefined,
          external_title: r.mapEntry.external_title,
          internal_product_id: r.internalId,
          match_confidence: r.mapEntry.match_confidence,
          connection_id: connectionId,
        })
        const updateData: Record<string, unknown> = {
          barcode: r.analysisUpdate.barcode,
          merchant_sku: r.analysisUpdate.merchant_sku,
          marketplace_source: r.analysisUpdate.marketplace_source,
          auto_synced: true,
        }
        if (r.analysisUpdate.inputs) {
          updateData.inputs = r.analysisUpdate.inputs
        }
        await this.analysisRepo.update(r.internalId, updateData)
      } else if (r.newAnalysis) {
        const newRow = await this.analysisRepo.create({
          user_id: userId,
          marketplace: r.newAnalysis.marketplace,
          product_name: r.newAnalysis.product_name,
          barcode: r.newAnalysis.barcode,
          merchant_sku: r.newAnalysis.merchant_sku,
          marketplace_source: r.newAnalysis.marketplace_source,
          auto_synced: true,
          inputs: r.newAnalysis.inputs,
          outputs: r.newAnalysis.outputs,
          risk_score: r.newAnalysis.risk_score,
          risk_level: r.newAnalysis.risk_level,
        })
        await this.productRepo.upsertMap({
          user_id: userId,
          marketplace: r.mapEntry.marketplace,
          external_product_id: r.mapEntry.external_product_id,
          merchant_sku: r.mapEntry.merchant_sku ?? undefined,
          barcode: r.mapEntry.barcode ?? undefined,
          external_title: r.mapEntry.external_title,
          internal_product_id: newRow.id,
          match_confidence: r.mapEntry.match_confidence,
          connection_id: connectionId,
        })
      } else {
        await this.productRepo.upsertMap({
          user_id: userId,
          marketplace: r.mapEntry.marketplace,
          external_product_id: r.mapEntry.external_product_id,
          merchant_sku: r.mapEntry.merchant_sku ?? undefined,
          barcode: r.mapEntry.barcode ?? undefined,
          external_title: r.mapEntry.external_title,
          match_confidence: 'manual_required',
          connection_id: connectionId,
        })
      }
    }

    return { matched: normalized.matched, created: normalized.created, manual: normalized.manual }
  }

  async normalizeHepsiburadaOrders(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ metricsUpdated: number; unmatchedOrders: number }> {
    const { connectionId, days } = payload as { connectionId: string; days?: number }
    const creds = await this.resolveHbCredentials(connectionId, traceId)

    // 1. Son N gun siparisleri cek
    const end = new Date()
    const start = new Date(end.getTime() - (days ?? 30) * 24 * 60 * 60 * 1000)
    const orders = await hepsiburadaApi.fetchAllOrders(creds, start, end)

    // 2. Urun eslestirme haritasini cek
    const mapRows = await this.productRepo.getMapByUserId(userId, 'hepsiburada')
    const productMappings: ProductMapping[] = mapRows.map(m => ({
      external_product_id: m.external_product_id,
      internal_product_id: m.internal_product_id,
    }))

    // 3. Siparisleri RawOrder formatina map et
    const rawOrders: RawOrder[] = orders.map((o: Record<string, unknown>) => ({
      order_number: String(o.orderNumber ?? o.id ?? ''),
      order_date: (o.orderDate as string) ?? new Date().toISOString(),
      status: (o.status as string) ?? 'Unknown',
      raw_json: o,
    }))

    // 4. Normalizer cagir
    const result = normalizeOrderMetrics(rawOrders, productMappings, 'hepsiburada')

    // 5. Metrikleri kaydet
    for (const metric of result.metrics) {
      await this.productRepo.upsertSalesMetrics({
        user_id: userId,
        internal_product_id: metric.internal_product_id,
        marketplace: metric.marketplace,
        period_month: metric.period_month,
        sold_qty: metric.sold_qty,
        returned_qty: metric.returned_qty,
        gross_revenue: metric.gross_revenue,
        net_revenue: metric.net_revenue,
      })
    }

    // 6. Otomatik satis adedini guncelle
    for (const update of result.autoSalesUpdates) {
      await this.analysisRepo.update(update.productId, {
        auto_sales_qty: update.netQty,
      })
    }

    return { metricsUpdated: result.metricsUpdated, unmatchedOrders: result.unmatchedOrders }
  }

  // ----------------------------------------------------------------
  // Gerçek Veri Zenginleştirme (Enrich)
  // Sipariş + iade verilerinden gerçek komisyon, iade oranı ve satış
  // adedini çıkararak analiz inputlarını günceller.
  // ----------------------------------------------------------------

  async enrichAnalysesWithRealData(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{
    enriched: number
    skipped: number
    details: Array<{ productName: string; field: string; oldValue: number; newValue: number }>
  }> {
    const { connectionId, marketplace: mp, days } = payload as {
      connectionId: string; marketplace: 'trendyol' | 'hepsiburada'; days?: number
    }

    const dayCount = days ?? 90

    // 1. Siparişleri çek
    let orders: Record<string, unknown>[] = []
    if (mp === 'trendyol') {
      const creds = await this.resolveCredentials(connectionId, traceId)
      const end = Date.now()
      const start = end - dayCount * 24 * 60 * 60 * 1000
      orders = await trendyolApi.fetchAllOrders(creds, start, end)
    } else {
      const creds = await this.resolveHbCredentials(connectionId, traceId)
      const end = new Date()
      const start = new Date(end.getTime() - dayCount * 24 * 60 * 60 * 1000)
      orders = await hepsiburadaApi.fetchAllOrders(creds, start, end) as Record<string, unknown>[]
    }

    // 2. İadeleri çek
    let claims: Record<string, unknown>[] = []
    if (mp === 'trendyol') {
      const creds = await this.resolveCredentials(connectionId, traceId)
      const end = new Date()
      const start = new Date(end.getTime() - dayCount * 24 * 60 * 60 * 1000)
      const fetched = await trendyolApi.fetchAllClaims(creds, start, end)
      claims = fetched as unknown as Record<string, unknown>[]
    }

    // 3. Eşleşme haritasını çek (external → internal)
    const mapRows = await this.productRepo.getMapByUserId(userId, mp)
    const extToInt = new Map<string, string>()
    for (const m of mapRows) {
      if (m.internal_product_id) {
        extToInt.set(m.external_product_id, m.internal_product_id)
        if (m.barcode) {
          extToInt.set(m.barcode, m.internal_product_id)
        }
        if (m.merchant_sku) {
          extToInt.set(m.merchant_sku, m.internal_product_id)
        }
      }
    }

    // 4. Ürün bazlı metrikler hesapla
    const productMetrics = new Map<string, {
      totalCommission: number
      totalAmount: number
      soldQty: number
      returnedQty: number
      months: Set<string>
    }>()

    for (const order of orders) {
      const lines = (order.lines ?? order.orderItems ?? []) as Record<string, unknown>[]
      const orderDate = order.orderDate ? new Date(order.orderDate as number) : new Date()
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`
      const status = String(order.status ?? order.shipmentPackageStatus ?? '')

      const isReturn = ['Cancelled', 'Returned', 'ReturnAccepted', 'ReturnedAndRefunded', 'UnDelivered', 'UnSupplied'].includes(status)

      for (const line of lines) {
        const extId = String(line.productId ?? line.id ?? line.barcode ?? '')
        const barcode = String(line.barcode ?? line.merchantSku ?? '')
        const internalId = extToInt.get(extId) ?? extToInt.get(barcode)
        if (!internalId) continue

        const commission = (line.commission as number) ?? 0
        const amount = (line.amount as number) ?? (line.price as number) ?? 0
        const qty = (line.quantity as number) ?? 1

        const existing = productMetrics.get(internalId) ?? {
          totalCommission: 0, totalAmount: 0, soldQty: 0, returnedQty: 0, months: new Set<string>()
        }

        if (isReturn) {
          existing.returnedQty += qty
        } else {
          existing.totalCommission += commission
          existing.totalAmount += amount * qty
          existing.soldQty += qty
          existing.months.add(monthKey)
        }

        productMetrics.set(internalId, existing)
      }
    }

    // 5. İade sayılarını ürün bazlı hesapla (claims'den)
    const productReturnCounts = new Map<string, number>()
    for (const claim of claims) {
      const claimLines = ((claim as Record<string, unknown>).lines ?? []) as Record<string, unknown>[]
      for (const line of claimLines) {
        const barcode = String(line.barcode ?? '')
        // Barcode → internal ID eşleştirmesi dene
        for (const [ext, intId] of extToInt) {
          if (barcode && ext === barcode) {
            const prev = productReturnCounts.get(intId) ?? 0
            productReturnCounts.set(intId, prev + ((line.quantity as number) ?? 1))
            break
          }
        }
      }
    }

    // 6. Mevcut analizleri çek ve güncelle
    const analyses = await this.analysisRepo.findByUserId(userId)
    let enriched = 0
    let skipped = 0
    const details: Array<{ productName: string; field: string; oldValue: number; newValue: number }> = []

    for (const analysis of analyses) {
      const metrics = productMetrics.get(analysis.id)
      if (!metrics || metrics.soldQty === 0) {
        skipped++
        continue
      }

      const inputs = (analysis.inputs ?? {}) as Record<string, unknown>
      const updates: Record<string, unknown> = {}
      let changed = false

      // Gerçek komisyon oranı
      if (metrics.totalAmount > 0) {
        const realCommission = (metrics.totalCommission / metrics.totalAmount) * 100
        const currentCommission = (inputs.commission_pct as number) ?? 0
        if (Math.abs(realCommission - currentCommission) > 0.5) {
          const rounded = Math.round(realCommission * 10) / 10
          details.push({
            productName: analysis.product_name ?? 'Bilinmeyen',
            field: 'Komisyon',
            oldValue: currentCommission,
            newValue: rounded,
          })
          inputs.commission_pct = rounded
          changed = true
        }
      }

      // Gerçek iade oranı
      const totalOrders = metrics.soldQty + metrics.returnedQty
      if (totalOrders > 0) {
        const returnCount = productReturnCounts.get(analysis.id) ?? metrics.returnedQty
        const realReturnRate = (returnCount / totalOrders) * 100
        const currentReturnRate = (inputs.return_rate_pct as number) ?? 0
        if (Math.abs(realReturnRate - currentReturnRate) > 1) {
          const rounded = Math.round(realReturnRate * 10) / 10
          details.push({
            productName: analysis.product_name ?? 'Bilinmeyen',
            field: 'İade Oranı',
            oldValue: currentReturnRate,
            newValue: rounded,
          })
          inputs.return_rate_pct = rounded
          changed = true
        }
      }

      // Gerçek aylık satış adedi
      const monthCount = Math.max(metrics.months.size, 1)
      const avgMonthlySales = Math.round(metrics.soldQty / monthCount)
      const currentMonthlySales = (inputs.monthly_sales_volume as number) ?? 0
      if (avgMonthlySales > 0 && Math.abs(avgMonthlySales - currentMonthlySales) > 2) {
        details.push({
          productName: analysis.product_name ?? 'Bilinmeyen',
          field: 'Aylık Satış',
          oldValue: currentMonthlySales,
          newValue: avgMonthlySales,
        })
        inputs.monthly_sales_volume = avgMonthlySales
        changed = true
      }

      if (changed) {
        updates.inputs = inputs
        updates.auto_synced = true
        updates.marketplace_source = mp
        await this.analysisRepo.update(analysis.id, updates)
        enriched++
      } else {
        skipped++
      }
    }

    return { enriched, skipped, details }
  }

  async rotateKeys(
    traceId: string,
    _payload: unknown,
    _userId: string
  ): Promise<{ rotated: number; total: number; errors: string[] }> {
    const allSecrets = await this.marketplaceRepo.getAllSecrets()
    let rotated = 0
    const errors: string[] = []

    for (const secret of allSecrets) {
      try {
        const plaintext = decrypt(secret.encrypted_blob)
        const newBlob = encrypt(plaintext)
        const newVersion = (secret.key_version || 1) + 1
        await this.marketplaceRepo.storeSecrets(secret.connection_id, newBlob, newVersion)
        rotated++
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
        errors.push(`Secret ${secret.id}: ${msg}`)
      }
    }

    return { rotated, total: allSecrets.length, errors }
  }

  // ----------------------------------------------------------------
  // Dahili yardimcilar
  // ----------------------------------------------------------------

  private async resolveCredentials(
    connectionId: string,
    traceId: string
  ): Promise<trendyolApi.TrendyolCredentials> {
    const secretRow = await this.marketplaceRepo.getSecrets(connectionId)
    if (!secretRow) {
      throw new ServiceError('Bağlantı bilgileri bulunamadı', {
        code: 'SECRETS_NOT_FOUND',
        statusCode: 404,
        traceId,
      })
    }
    return JSON.parse(decrypt(secretRow.encrypted_blob)) as trendyolApi.TrendyolCredentials
  }

  private async resolveHbCredentials(
    connectionId: string,
    traceId: string
  ): Promise<hepsiburadaApi.HepsiburadaCredentials> {
    const secretRow = await this.marketplaceRepo.getSecrets(connectionId)
    if (!secretRow) {
      throw new ServiceError('Bağlantı bilgileri bulunamadı', {
        code: 'SECRETS_NOT_FOUND',
        statusCode: 404,
        traceId,
      })
    }
    return JSON.parse(decrypt(secretRow.encrypted_blob)) as hepsiburadaApi.HepsiburadaCredentials
  }

  /**
   * Tam sync yapar (urunler + siparisler).
   * Cron job tarafindan cagrilir.
   */
  async fullSync(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<SyncResult> {
    const { connectionId } = payload as { connectionId: string }

    const products = await this.syncProducts(traceId, { connectionId }, userId)
    const orders = await this.syncOrders(traceId, { connectionId }, userId)

    return {
      productsCount: (products as Record<string, unknown>).count as number ?? 0,
      ordersCount: (orders as Record<string, unknown>).count as number ?? 0,
      syncedAt: new Date().toISOString(),
    }
  }
}

// Instance olusturma registry.ts'de yapilir (repo DI)
