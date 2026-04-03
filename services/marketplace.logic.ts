// ----------------------------------------------------------------
// MarketplaceLogic — Katman 6
// Trendyol / Hepsiburada baglanti yonetimi ve sync.
// KNOWLEDGE-BASE.md Section 3.
// ----------------------------------------------------------------

import { ServiceError } from '@/lib/gateway/types'
import { encrypt, decrypt } from '@/lib/db/db.helper'
import { encryptCredentials, decryptCredentials } from '@/lib/marketplace/crypto'
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
  ): Promise<{ connectionId: string; status: ConnectionStatus }> {
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

    // Baglanti olustur
    const connection = await this.marketplaceRepo.createConnection({
      user_id: userId,
      marketplace: input.marketplace,
      store_name: input.storeName,
      seller_id: input.sellerId,
      status: 'pending_test',
    })

    // Credentials sifrele ve sakla
    const encryptedBlob = encrypt(JSON.stringify({
      apiKey: input.apiKey,
      apiSecret: input.apiSecret,
      sellerId: input.sellerId,
    }))

    await this.marketplaceRepo.storeSecrets(connection.id, encryptedBlob)

    return { connectionId: connection.id, status: 'pending_test' }
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
   * Baglanti testi yapar.
   * API'ye basit bir istek atarak credentials'in gecerli oldugunu dogrular.
   */
  async testConnection(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean; storeName: string | null }> {
    const { connectionId } = payload as {
      marketplace: MarketplaceType
      connectionId: string
    }

    if (!connectionId) {
      throw new ServiceError('Bağlantı ID\'si zorunludur', {
        code: 'MISSING_CONNECTION_ID',
        statusCode: 400,
        traceId,
      })
    }

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
      apiKey: string
      apiSecret: string
      sellerId: string
    }

    // Marketplace tipini bul
    const connection = await this.marketplaceRepo.getConnectionById(connectionId)
    if (!connection) {
      throw new ServiceError('Bağlantı bulunamadı', {
        code: 'CONNECTION_NOT_FOUND',
        statusCode: 404,
        traceId,
      })
    }

    let result: { success: boolean; message: string; storeName?: string }

    if (connection.marketplace === 'trendyol') {
      result = await trendyolApi.testConnection(credentials)
    } else if (connection.marketplace === 'hepsiburada') {
      const hbCreds = { apiKey: credentials.apiKey, apiSecret: credentials.apiSecret, merchantId: credentials.sellerId }
      result = await hepsiburadaApi.testConnection(hbCreds)
    } else {
      throw new ServiceError('Desteklenmeyen pazaryeri', {
        code: 'UNSUPPORTED_MARKETPLACE',
        statusCode: 400,
        traceId,
      })
    }

    if (result.success) {
      await this.marketplaceRepo.updateConnectionStatus(connectionId, 'connected')
    } else {
      await this.marketplaceRepo.updateConnectionStatus(connectionId, 'error')
    }

    return { success: result.success, storeName: result.storeName ?? null }
  }

  /**
   * Marketplace urunlerini ceker.
   */
  async syncProducts(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ productsCount: number }> {
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
      return { productsCount }
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
  ): Promise<{ ordersCount: number }> {
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
      return { ordersCount }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'failed', msg)
      throw error
    }
  }

  /**
   * Baglanti durumunu dondurur.
   */
  async getStatus(
    _traceId: string,
    _payload: unknown,
    userId: string
  ): Promise<unknown[]> {
    return this.marketplaceRepo.getConnectionsByUserId(userId)
  }

  // ----------------------------------------------------------------
  // Trendyol-specific metodlar
  // ----------------------------------------------------------------

  async syncTrendyolProducts(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ productsCount: number }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveCredentials(connectionId, traceId)

    const syncLog = await this.marketplaceRepo.createSyncLog({
      connection_id: connectionId,
      sync_type: 'trendyol_products',
      status: 'running',
    })

    try {
      const page = await trendyolApi.fetchProducts(creds)
      const productsCount = page.totalElements
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'success', `${productsCount} ürün çekildi`)
      await this.marketplaceRepo.updateLastSyncAt(connectionId)
      return { productsCount }
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
  ): Promise<{ ordersCount: number }> {
    const { connectionId, days } = payload as { connectionId: string; days?: number }
    const creds = await this.resolveCredentials(connectionId, traceId)

    const syncLog = await this.marketplaceRepo.createSyncLog({
      connection_id: connectionId,
      sync_type: 'trendyol_orders',
      status: 'running',
    })

    try {
      const end = new Date()
      const start = new Date(end.getTime() - (days ?? 30) * 24 * 60 * 60 * 1000)
      const orders = await trendyolApi.fetchAllOrders(creds, start.getTime(), end.getTime())
      const ordersCount = orders.length
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'success', `${ordersCount} sipariş çekildi`)
      await this.marketplaceRepo.updateLastSyncAt(connectionId)
      return { ordersCount }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'failed', msg)
      throw error
    }
  }

  async testTrendyol(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean; storeName: string | null }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveCredentials(connectionId, traceId)

    const result = await trendyolApi.testConnection(creds)
    if (result.success) {
      await this.marketplaceRepo.updateConnectionStatus(connectionId, 'connected')
    } else {
      await this.marketplaceRepo.updateConnectionStatus(connectionId, 'error')
    }
    return { success: result.success, storeName: result.storeName ?? null }
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
    const { connectionId, days } = payload as { connectionId: string; days?: number }
    const creds = await this.resolveCredentials(connectionId, traceId)

    const end = new Date()
    const start = new Date(end.getTime() - (days ?? 30) * 24 * 60 * 60 * 1000)
    const startStr = start.toISOString()
    const endStr = end.toISOString()

    const [settlements, otherFinancials] = await Promise.all([
      trendyolApi.getSellerSettlements(creds, startStr, endStr),
      trendyolApi.getOtherFinancials(creds, startStr, endStr),
    ])

    return { settlements, otherFinancials }
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
  ): Promise<{ processed: boolean }> {
    try {
      const event = payload as Record<string, unknown>

      // Webhook event'ini DB'ye kaydet
      const eventType = String(event.status ?? event.eventType ?? 'unknown')
      const orderNumber = String(event.orderNumber ?? '')
      const shipmentPackageId = typeof event.shipmentPackageId === 'number'
        ? event.shipmentPackageId
        : null

      // Seller ID'den bağlantıyı bul
      const sellerId = String(event.sellerId ?? event.supplierId ?? '')

      if (sellerId) {
        // trendyol_webhook_events tablosuna kaydet (varsa)
        // Bu tablo migration 20260326_trendyol_webhook.sql ile oluşturuldu
        try {
          const { createAdminClient } = await import('@/lib/supabase/admin')
          const admin = createAdminClient()

          await admin.from('trendyol_webhook_events').insert({
            event_type: eventType,
            seller_id: sellerId,
            shipment_package_id: shipmentPackageId,
            order_number: orderNumber,
            status: eventType,
            payload: event,
            processed: false,
          })
        } catch (_dbError) {
          // DB hatası webhook işlemeyi durdurmamalı
        }
      }

      return { processed: true }
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
  ): Promise<{ productsCount: number }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveHbCredentials(connectionId, traceId)

    const syncLog = await this.marketplaceRepo.createSyncLog({
      connection_id: connectionId,
      sync_type: 'hepsiburada_products',
      status: 'running',
    })

    try {
      const result = await hepsiburadaApi.fetchAllProducts(creds)
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'success', `${result.totalCount} ürün çekildi`)
      await this.marketplaceRepo.updateLastSyncAt(connectionId)
      return { productsCount: result.totalCount }
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
  ): Promise<{ ordersCount: number }> {
    const { connectionId, days } = payload as { connectionId: string; days?: number }
    const creds = await this.resolveHbCredentials(connectionId, traceId)

    const syncLog = await this.marketplaceRepo.createSyncLog({
      connection_id: connectionId,
      sync_type: 'hepsiburada_orders',
      status: 'running',
    })

    try {
      const end = new Date()
      const start = new Date(end.getTime() - (days ?? 30) * 24 * 60 * 60 * 1000)
      const orders = await hepsiburadaApi.fetchAllOrders(creds, start, end)
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'success', `${orders.length} sipariş çekildi`)
      await this.marketplaceRepo.updateLastSyncAt(connectionId)
      return { ordersCount: orders.length }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
      await this.marketplaceRepo.updateSyncLog(syncLog.id, 'failed', msg)
      throw error
    }
  }

  async testHepsiburada(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean; storeName: string | null }> {
    const { connectionId } = payload as { connectionId: string }
    const creds = await this.resolveHbCredentials(connectionId, traceId)

    const result = await hepsiburadaApi.testConnection(creds)
    if (result.success) {
      await this.marketplaceRepo.updateConnectionStatus(connectionId, 'connected')
    } else {
      await this.marketplaceRepo.updateConnectionStatus(connectionId, 'error')
    }
    return { success: result.success, storeName: result.storeName ?? null }
  }

  async testHepsiburadaConnection(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ success: boolean; storeName: string | null }> {
    return this.testHepsiburada(traceId, payload, userId)
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
        const plaintext = decryptCredentials(secret.encrypted_blob)
        const newBlob = encryptCredentials(plaintext)
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
      productsCount: products.productsCount,
      ordersCount: orders.ordersCount,
      syncedAt: new Date().toISOString(),
    }
  }
}

// Instance olusturma registry.ts'de yapilir (repo DI)
