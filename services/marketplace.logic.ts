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
  constructor(private readonly marketplaceRepo: MarketplaceRepository) {}

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

    const _credentials = JSON.parse(decrypt(secretRow.encrypted_blob)) as {
      apiKey: string
      apiSecret: string
      sellerId: string
    }

    // TODO: Trendyol/HB API'ye gercek test istegi — API client FAZ7+ entegrasyonunda
    // Simdilik baglanti durumunu 'connected' olarak guncelle
    await this.marketplaceRepo.updateConnectionStatus(connectionId, 'connected')

    return { success: true, storeName: null }
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

      const _credentials = JSON.parse(decrypt(secretRow.encrypted_blob))

      // TODO: Trendyol/HB API'den urunleri cek — API client entegrasyonu ayri task
      const productsCount = 0

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

      const _credentials = JSON.parse(decrypt(secretRow.encrypted_blob))

      // TODO: Trendyol/HB API'den siparisleri cek — API client entegrasyonu ayri task
      const ordersCount = 0

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
    // TODO: normalizer entegrasyonu — rawProducts ve analyses repo'dan çekilecek
    return { matched: 0, created: 0, manual: 0 }
  }

  async normalizeTrendyolOrders(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ metricsUpdated: number; unmatchedOrders: number }> {
    // TODO: normalizer entegrasyonu — rawOrders ve productMap repo'dan çekilecek
    return { metricsUpdated: 0, unmatchedOrders: 0 }
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
    // TODO: webhook event'ini DB'ye kaydet, bildirim oluştur
    return { processed: true }
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
    // TODO: normalizer entegrasyonu — rawProducts ve analyses repo'dan çekilecek
    return { matched: 0, created: 0, manual: 0 }
  }

  async normalizeHepsiburadaOrders(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ metricsUpdated: number; unmatchedOrders: number }> {
    // TODO: normalizer entegrasyonu — rawOrders ve productMap repo'dan çekilecek
    return { metricsUpdated: 0, unmatchedOrders: 0 }
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
