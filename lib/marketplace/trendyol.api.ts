/**
 * Trendyol Seller API Client — Server-only
 *
 * Resmi dokümantasyon: https://developers.trendyol.com/
 * Base URL (Production): https://apigw.trendyol.com/integration/...
 * Base URL (Staging):    https://stageapigw.trendyol.com/...
 * Auth: HTTP Basic (apiKey:apiSecret → base64)
 * User-Agent: "{sellerId} - SelfIntegration" (zorunlu, 403 döner yoksa)
 *
 * Rate limit: Genel 50 req/10s + endpoint bazlı limitler
 *
 * NEVER log credentials, auth headers, or tokens.
 */

// ─── Base URL'ler (Resmi Trendyol Dokümanı) ─────────────────────
// Tüm URL'ler https://developers.trendyol.com/ referans alınarak yazılmıştır.

const IS_STAGE = process.env.TRENDYOL_ENV === 'stage'

/** Ürün API (CRUD, filtreleme, batch, arşiv, buybox) */
const PRODUCT_BASE_URL = IS_STAGE
    ? 'https://stageapigw.trendyol.com/integration/product/sellers'
    : 'https://apigw.trendyol.com/integration/product/sellers'

/** Ürün referans verileri (kategori, marka) — sellerId gerektirmez */
const PRODUCT_REF_URL = IS_STAGE
    ? 'https://stageapigw.trendyol.com/integration/product'
    : 'https://apigw.trendyol.com/integration/product'

/** Stok & Fiyat güncelleme */
const INVENTORY_BASE_URL = IS_STAGE
    ? 'https://stageapigw.trendyol.com/integration/inventory/sellers'
    : 'https://apigw.trendyol.com/integration/inventory/sellers'

/** Sipariş API (paketler, durum güncelleme, tedarik edilemez, bölme) */
const ORDER_BASE_URL = IS_STAGE
    ? 'https://stageapigw.trendyol.com/integration/order/sellers'
    : 'https://apigw.trendyol.com/integration/order/sellers'

/** İade/Claim referans verileri (sebep kodları) */
const CLAIM_REF_URL = IS_STAGE
    ? 'https://stageapigw.trendyol.com/integration/order'
    : 'https://apigw.trendyol.com/integration/order'

/** Finans / Cari Hesap Ekstresi */
const FINANCE_BASE_URL = IS_STAGE
    ? 'https://stageapigw.trendyol.com/integration/finance/che/sellers'
    : 'https://apigw.trendyol.com/integration/finance/che/sellers'

/** Webhook yönetimi */
const WEBHOOK_BASE_URL = IS_STAGE
    ? 'https://stageapigw.trendyol.com/integration/webhook/sellers'
    : 'https://apigw.trendyol.com/integration/webhook/sellers'

/** Fatura link gönderimi */
const INVOICE_BASE_URL = IS_STAGE
    ? 'https://stageapigw.trendyol.com/integration/sellers'
    : 'https://apigw.trendyol.com/integration/sellers'

/** Soru & Cevap (Q&A) */
const QNA_BASE_URL = IS_STAGE
    ? 'https://stageapigw.trendyol.com/integration/qna/sellers'
    : 'https://apigw.trendyol.com/integration/qna/sellers'

/** Kargo etiketi */
const LABEL_BASE_URL = IS_STAGE
    ? 'https://stageapigw.trendyol.com/integration/sellers'
    : 'https://apigw.trendyol.com/integration/sellers'

// ─── Sabitler ────────────────────────────────────────────────────

const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000
const TIMEOUT_MS = 8000 // Vercel serverless 10sn sınırı — 2sn gateway overhead için margin

// ─── Sipariş Durumları (Resmi) ──────────────────────────────────

/** Trendyol resmi sipariş durumları */
export const ORDER_STATUSES = {
    Created: 'Created',
    Picking: 'Picking',
    Invoiced: 'Invoiced',
    Shipped: 'Shipped',
    Cancelled: 'Cancelled',
    Delivered: 'Delivered',
    UnDelivered: 'UnDelivered',
    Returned: 'Returned',
    AtCollectionPoint: 'AtCollectionPoint',
    UnPacked: 'UnPacked',
    UnSupplied: 'UnSupplied',
    /** ÖNEMLİ: Awaiting durumundaki siparişler İŞLENMEMELİDİR */
    Awaiting: 'Awaiting',
} as const

/** Sipariş iptal (tedarik edilemez) sebep kodları — resmi */
export const UNSUPPLY_REASON_CODES = {
    STOCK_EXHAUSTED: 500,
    DEFECTIVE_PRODUCT: 501,
    WRONG_PRICE: 502,
    INTEGRATION_ERROR: 504,
    BULK_PURCHASE: 505,
    FORCE_MAJEURE: 506,
} as const

/** Webhook'ta dinlenebilecek durum değişiklikleri — resmi */
export const WEBHOOK_STATUSES = [
    'CREATED', 'PICKING', 'INVOICED', 'SHIPPED', 'CANCELLED',
    'DELIVERED', 'UNDELIVERED', 'RETURNED', 'UNSUPPLIED',
    'AWAITING', 'UNPACKED', 'AT_COLLECTION_POINT', 'VERIFIED',
] as const

/** KDV oranları — Trendyol tarafından kabul edilen değerler */
export const VALID_VAT_RATES = [0, 1, 10, 20] as const

// ─── Kargo Şirketleri (Sabit Liste — Resmi Doküman) ─────────────
// Trendyol bu veriyi API ile sunmaz; referans tablosu olarak sağlar.

export const CARGO_PROVIDERS = [
    { id: 38, code: 'SENDEOMP', name: 'Kolay Gelsin' },
    { id: 30, code: 'CEVATEDARIK', name: 'Ceva Tedarik' },
    { id: 10, code: 'DHLECOMMP', name: 'DHL eCommerce' },
    { id: 19, code: 'PTTMP', name: 'PTT Kargo' },
    { id: 9, code: 'SURATMP', name: 'Surat Kargo' },
    { id: 17, code: 'TEXMP', name: 'Trendyol Express' },
    { id: 6, code: 'HOROZMP', name: 'Horoz Kargo' },
    { id: 20, code: 'CEVAMP', name: 'CEVA' },
    { id: 4, code: 'YKMP', name: 'Yurtiçi Kargo' },
    { id: 7, code: 'ARASMP', name: 'Aras Kargo' },
] as const

// ─── Rate Limit Profilleri (Resmi Doküman) ──────────────────────

/** Endpoint bazlı rate limit kuralları (resmi) */
export const RATE_LIMITS = {
    general: { maxRequests: 50, windowMs: 10_000 },
    productCreation: { maxRequests: 1000, windowMs: 60_000 },
    productUpdate: { maxRequests: 1000, windowMs: 60_000 },
    stockPriceUpdate: { maxRequests: Infinity, windowMs: 0 }, // NO LIMIT (ama 15dk dedup)
    productFilter: { maxRequests: 2000, windowMs: 60_000 },
    productDeletion: { maxRequests: 100, windowMs: 60_000 },
    batchCheck: { maxRequests: 1000, windowMs: 60_000 },
    brandList: { maxRequests: 50, windowMs: 60_000 },
    brandSearch: { maxRequests: 50, windowMs: 60_000 },
    categoryList: { maxRequests: 50, windowMs: 60_000 },
    categoryAttrs: { maxRequests: 50, windowMs: 60_000 },
    buybox: { maxRequests: 1000, windowMs: 60_000 },
    orders: { maxRequests: 1000, windowMs: 60_000 },
    addresses: { maxRequests: 1, windowMs: 3_600_000 }, // 1 istek/saat
} as const

// ─── Tipler ──────────────────────────────────────────────────────

export interface TrendyolCredentials {
    apiKey: string
    apiSecret: string
    sellerId: string
}

export interface TrendyolProductPage {
    content: Record<string, unknown>[]
    totalElements: number
    totalPages: number
    page: number
    size: number
}

export interface TrendyolOrderPage {
    content: Record<string, unknown>[]
    totalElements: number
    totalPages: number
    page: number
    size: number
}

export interface CommissionRate {
    categoryId: number
    categoryName: string
    commissionRate: number
}

export interface ShipmentProvider {
    id: number
    name: string
    code: string
}

export interface BatchStatus {
    basarili: number
    basarisiz: number
    bekleyen: number   // -1 = zaman aşımı
    hatalar: string[]
}

export interface SellerSettlement {
    siparisId: string
    paketId: number
    barkod: string
    islemTipi: string
    komisyonOrani: number
    komisyonTutari: number
    saticiHakedis: number
    alacak: number
    borc: number
    odemeTarihi: string | null
    islemTarihi: string | null
    odemeNo: number
    faturaNuarasi: string
}

export interface OtherFinancial {
    islemTipi: string
    tutar: number
    aciklama: string
    tarih: string | null
}

export interface TrendyolClaimLine {
    claimId: string
    orderId: string
    orderNumber: string
    claimType: string
    claimReason: string
    claimDate: string | null
    status: string
    amount: number
    quantity: number
    productName: string
    barcode: string
}

export interface TrendyolClaim {
    claimId: string
    orderId: string
    orderNumber: string
    claimType: string
    claimReason: string
    claimDate: string | null
    status: string
    totalAmount: number
    lines: TrendyolClaimLine[]
}

export interface WebhookRegistration {
    webhookId: string
    url: string
    subscribedStatuses: string[]
}

export interface WebhookInfo {
    id: string
    url: string
    username: string
    authenticationType: string
    status: 'ACTIVE' | 'PASSIVE'
    subscribedStatuses: string[]
    createdDate: number
    lastModifiedDate: number
}

export interface CategoryNode {
    id: number
    name: string
    parentId: number | null
    subCategories: CategoryNode[]
}

export interface CategoryAttribute {
    attribute: { id: number; name: string }
    required: boolean
    allowCustom: boolean
    varianter: boolean
    slicer: boolean
    attributeValues: Array<{ id: number; name: string }>
}

export interface Brand {
    id: number
    name: string
}

export interface BuyboxInfo {
    barcode: string
    buyboxOrder: number
    buyboxPrice: number
    hasMultipleSeller: boolean
}

export interface SellerAddress {
    id: number
    addressType: 'Shipment' | 'Invoice' | 'Returning'
    city: string
    district: string
    fullAddress: string
    isDefault: boolean
}

export interface QuestionItem {
    id: number
    text: string
    creationDate: number
    status: string
    customerId: number
    productMainId: string
    answer: { text: string; creationDate: number } | null
}

export interface ClaimIssueReason {
    id: number
    name: string
}

// ─── Rate Limiter ────────────────────────────────────────────────

const rateLimiter = {
    requests: [] as number[],
    maxRequests: 50,
    windowMs: 10_000,
}

async function checkRateLimit(): Promise<void> {
    const now = Date.now()
    rateLimiter.requests = rateLimiter.requests.filter(t => now - t < rateLimiter.windowMs)

    if (rateLimiter.requests.length >= rateLimiter.maxRequests) {
        const bekleme = rateLimiter.windowMs - (now - (rateLimiter.requests[0] ?? now)) + 100
        await sleep(bekleme)
    }

    rateLimiter.requests.push(Date.now())
}

const orderRateLimiter = {
    requests: [] as number[],
    maxRequests: 1000,
    windowMs: 60_000,
}

async function checkOrderRateLimit(): Promise<void> {
    const now = Date.now()
    orderRateLimiter.requests = orderRateLimiter.requests.filter(t => now - t < orderRateLimiter.windowMs)

    if (orderRateLimiter.requests.length >= orderRateLimiter.maxRequests) {
        const bekleme = orderRateLimiter.windowMs - (now - (orderRateLimiter.requests[0] ?? now)) + 100
        await sleep(bekleme)
    }

    orderRateLimiter.requests.push(Date.now())
}

// ─── Helpers ─────────────────────────────────────────────────────

function buildHeaders(creds: TrendyolCredentials): Record<string, string> {
    const token = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64')
    return {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': `${String(creds.sellerId).trim()} - SelfIntegration`,
    }
}

async function fetchWithRetry(
    url: string,
    headers: Record<string, string>,
    rateLimitFn: () => Promise<void> = checkRateLimit
): Promise<Response> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            await rateLimitFn()

            const res = await fetch(url, {
                headers,
                method: 'GET',
                signal: AbortSignal.timeout(TIMEOUT_MS),
            })

            if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
                return res
            }

            if (res.status === 429 || res.status >= 500) {
                const backoff = res.status === 429
                    ? 12_000
                    : INITIAL_BACKOFF_MS * Math.pow(2, attempt)
                await sleep(backoff)
                continue
            }

            return res
        } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(String(error))
            if (attempt < MAX_RETRIES) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
                await sleep(backoff)
            }
        }
    }

    throw lastError || new Error('Max retries exceeded')
}

async function fetchWithRetryAndBody(
    url: string,
    headers: Record<string, string>,
    method: 'POST' | 'PUT' | 'DELETE',
    body?: unknown,
    rateLimitFn: () => Promise<void> = checkRateLimit
): Promise<Response> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            await rateLimitFn()

            const res = await fetch(url, {
                headers,
                method,
                body: body ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(TIMEOUT_MS),
            })

            if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
                return res
            }

            if (res.status === 429 || res.status >= 500) {
                const backoff = res.status === 429
                    ? 12_000
                    : INITIAL_BACKOFF_MS * Math.pow(2, attempt)
                await sleep(backoff)
                continue
            }

            return res
        } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(String(error))
            if (attempt < MAX_RETRIES) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
                await sleep(backoff)
            }
        }
    }

    throw lastError || new Error('Max retries exceeded')
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Error Handling ──────────────────────────────────────────────

const TRENDYOL_ERROR_MESSAGES: Record<number, string> = {
    400: 'Gönderilen bilgiler hatalı. API Key, Secret ve Satıcı ID\'yi kontrol edin.',
    401: 'API Key veya API Secret hatalı. Trendyol Satıcı Paneli → Hesabım → Entegrasyon Bilgileri\'nden güncel bilgileri alın.',
    403: 'Erişim reddedildi. User-Agent header ve satıcı ID\'nizin doğruluğunu kontrol edin.',
    404: 'Satıcı ID ile eşleşen mağaza bulunamadı. ID\'yi kontrol edin.',
    405: 'HTTP metodu desteklenmiyor.',
    409: 'Kaynak çakışması (örn: aynı fatura linki zaten kayıtlı).',
    414: 'Sorgu çok uzun. İsteği parçalayın.',
    415: 'Desteklenmeyen medya tipi. Content-Type header\'ı kontrol edin.',
    429: 'Çok fazla istek gönderildi. Lütfen 1-2 dakika bekleyip tekrar deneyin.',
    500: 'Trendyol\'un sisteminde geçici bir sorun var. Birkaç dakika sonra tekrar deneyin.',
    502: 'Trendyol\'un ağ geçidinde sorun var. Birkaç dakika sonra tekrar deneyin.',
    503: 'Trendyol servisi geçici olarak kullanılamıyor. Test ortamındaysanız IP whitelisting kontrolü yapın.',
    504: 'Trendyol zaman aşımı. İsteği parçalayarak tekrar gönderin.',
}

function getTrendyolErrorMessage(status: number): string {
    return TRENDYOL_ERROR_MESSAGES[status] ?? `Trendyol hatası (HTTP ${status})`
}

function handleTrendyolError(status: number, _endpoint: string): never {
    throw new Error(getTrendyolErrorMessage(status))
}

/**
 * Trendyol timestamp → ISO string dönüşümü.
 *
 * Trendyol iki farklı format kullanır:
 *  - orderDate   → GMT+3 epoch ms (Trendyol dökümanı)
 *  - createdDate → UTC  epoch ms
 *
 * JavaScript Date constructor her iki durumda da doğru çalışır
 * (epoch ms her zaman UTC bazlıdır).
 */
export function trendyolTariheDonustur(
    timestamp: number | null | undefined,
    _fieldType: 'orderDate' | 'createdDate' | 'other' = 'other'
): string | null {
    if (!timestamp) return null
    try {
        const date = new Date(timestamp)
        if (isNaN(date.getTime())) return null
        return date.toISOString()
    } catch {
        return null
    }
}

// ═══════════════════════════════════════════════════════════════════
//  BÖLÜM 1: BAĞLANTI TESTİ
// ═══════════════════════════════════════════════════════════════════

export async function testConnection(
    creds: TrendyolCredentials
): Promise<{ success: boolean; message: string; storeName?: string }> {
    if (!creds.sellerId || String(creds.sellerId).trim() === '') {
        return {
            success: false,
            message: 'Satıcı ID eksik. Lütfen pazaryeri ayarlarından Satıcı ID bilgisini güncelleyin.',
        }
    }

    try {
        const url = `${PRODUCT_BASE_URL}/${creds.sellerId}/products?approved=true&page=0&size=1`
        const headers = buildHeaders(creds)
        const res = await fetchWithRetry(url, headers)

        if (res.ok) {
            const data = await res.json() as { totalElements?: number }
            return {
                success: true,
                message: `Bağlantı başarılı. Toplam ${data.totalElements ?? '?'} ürün bulundu.`,
                storeName: undefined,
            }
        }

        return { success: false, message: getTrendyolErrorMessage(res.status) }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Trendyol bağlantısı kurulamadı.'
        return { success: false, message }
    }
}

// ═══════════════════════════════════════════════════════════════════
//  BÖLÜM 2: REFERANS VERİLERİ (Kategori, Marka, Kargo)
// ═══════════════════════════════════════════════════════════════════

/**
 * Tüm kategori ağacını çeker.
 * Endpoint: GET /integration/product/product-categories
 * Rate limit: 50 req/dk
 * NOT: Sadece yaprak (leaf) kategori ID'leri ürün oluşturmada kullanılabilir.
 * Haftalık yenilenmesi tavsiye edilir.
 */
export async function getCategories(
    creds: TrendyolCredentials
): Promise<CategoryNode[]> {
    const url = `${PRODUCT_REF_URL}/product-categories`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers)

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as { categories?: CategoryNode[] }
    return data.categories ?? []
}

/**
 * Belirli kategorinin özniteliklerini çeker.
 * Endpoint: GET /integration/product/product-categories/{categoryId}/attributes
 * Rate limit: 50 req/dk
 */
export async function getCategoryAttributes(
    creds: TrendyolCredentials,
    categoryId: number
): Promise<CategoryAttribute[]> {
    const url = `${PRODUCT_REF_URL}/product-categories/${categoryId}/attributes`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers)

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as { categoryAttributes?: CategoryAttribute[] }
    return data.categoryAttributes ?? []
}

/**
 * Marka listesini sayfalı çeker.
 * Endpoint: GET /integration/product/brands?page={p}&size={s}
 * Rate limit: 50 req/dk
 * NOT: Size minimum 1000 olmalı.
 */
export async function getBrands(
    creds: TrendyolCredentials,
    page = 0,
    size = 1000
): Promise<{ brands: Brand[]; totalPages: number }> {
    const url = `${PRODUCT_REF_URL}/brands?page=${page}&size=${size}`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers)

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as { brands?: Brand[]; totalPages?: number }
    return { brands: data.brands ?? [], totalPages: data.totalPages ?? 0 }
}

/**
 * İsme göre marka arar (case-sensitive).
 * Endpoint: GET /integration/product/brands/by-name?name={name}
 * Rate limit: 50 req/dk
 */
export async function searchBrandByName(
    creds: TrendyolCredentials,
    name: string
): Promise<Brand[]> {
    const url = `${PRODUCT_REF_URL}/brands/by-name?name=${encodeURIComponent(name)}`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers)

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as { brands?: Brand[] }
    return data.brands ?? []
}

/**
 * Kargo şirketlerini döndürür (sabit liste — API endpoint yok).
 */
export function getShipmentProviders(): ShipmentProvider[] {
    return [...CARGO_PROVIDERS]
}

// ═══════════════════════════════════════════════════════════════════
//  BÖLÜM 3: ÜRÜN API (Filtreleme, CRUD, Stok/Fiyat, Arşiv, Buybox)
// ═══════════════════════════════════════════════════════════════════

/**
 * Ürün listesi çeker (filtreleme).
 * Endpoint: GET /integration/product/sellers/{sellerId}/products
 * Rate limit: 2000 req/dk
 * Max sayfa: 2500 | Max boyut: 200
 */
export async function fetchProducts(
    creds: TrendyolCredentials,
    page = 0,
    size = 200,
    filters: {
        approved?: boolean
        barcode?: string
        stockCode?: string
        productMainId?: string
        startDate?: number
        endDate?: number
        dateQueryType?: 'CREATED_DATE' | 'LAST_MODIFIED_DATE'
        onSale?: boolean
        rejected?: boolean
        blacklisted?: boolean
        archived?: boolean
        brandIds?: number[]
    } = {}
): Promise<TrendyolProductPage> {
    if (!creds.sellerId || String(creds.sellerId).trim() === '') {
        throw new Error('Satıcı ID eksik. Lütfen pazaryeri ayarlarından Satıcı ID bilgisini güncelleyin.')
    }

    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('size', String(Math.min(size, 200)))

    if (filters.approved !== undefined) params.set('approved', String(filters.approved))
    if (filters.barcode) params.set('barcode', filters.barcode)
    if (filters.stockCode) params.set('stockCode', filters.stockCode)
    if (filters.productMainId) params.set('productMainId', filters.productMainId)
    if (filters.startDate) params.set('startDate', String(filters.startDate))
    if (filters.endDate) params.set('endDate', String(filters.endDate))
    if (filters.dateQueryType) params.set('dateQueryType', filters.dateQueryType)
    if (filters.onSale !== undefined) params.set('onSale', String(filters.onSale))
    if (filters.rejected !== undefined) params.set('rejected', String(filters.rejected))
    if (filters.blacklisted !== undefined) params.set('blacklisted', String(filters.blacklisted))
    if (filters.archived !== undefined) params.set('archived', String(filters.archived))
    if (filters.brandIds?.length) params.set('brandIds', filters.brandIds.join(','))

    const url = `${PRODUCT_BASE_URL}/${creds.sellerId}/products?${params.toString()}`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers)

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as { content?: Record<string, unknown>[]; totalElements?: number; totalPages?: number; page?: number; size?: number }
    return {
        content: data.content || [],
        totalElements: data.totalElements || 0,
        totalPages: data.totalPages || 0,
        page: data.page || page,
        size: data.size || size,
    }
}

/**
 * Barcode ile ürün arar.
 */
export async function getProductByBarcode(
    creds: TrendyolCredentials,
    barcode: string
): Promise<Record<string, unknown> | null> {
    const result = await fetchProducts(creds, 0, 1, { barcode, approved: true })
    return result.content[0] ?? null
}

/**
 * Ürün oluşturur (V1).
 * Endpoint: POST /integration/product/sellers/{sellerId}/products
 * Rate limit: 1000 req/dk | Max 1000 ürün/istek
 * Sonuç: batchRequestId — durumu checkBatchStatus ile kontrol edin.
 */
export async function createProducts(
    creds: TrendyolCredentials,
    items: Array<{
        barcode: string
        title: string
        productMainId: string
        brandId: number
        categoryId: number
        quantity: number
        stockCode: string
        dimensionalWeight: number
        description: string
        currencyType?: string
        listPrice: number
        salePrice: number
        vatRate: number
        cargoCompanyId: number
        images: Array<{ url: string }>
        attributes: Array<{ attributeId: number; attributeValueId?: number; customAttributeValue?: string }>
        deliveryOption?: { fastDeliveryType: 'SAME_DAY_SHIPPING' | 'FAST_DELIVERY'; deliveryDuration: number }
        shipmentAddressId?: number
        returningAddressId?: number
    }>
): Promise<{ batchRequestId: string }> {
    const url = `${PRODUCT_BASE_URL}/${creds.sellerId}/products`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'POST', { items })

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Ürün oluşturma hatası: HTTP ${res.status} — ${text.slice(0, 300)}`)
    }

    const data = await res.json() as { batchRequestId?: string }
    return { batchRequestId: data.batchRequestId ?? '' }
}

/**
 * Ürün günceller (V1).
 * Endpoint: PUT /integration/product/sellers/{sellerId}/products
 * Rate limit: 1000 req/dk | Max 1000 ürün/istek
 * NOT: Onaylı ürünlerde barcode, productMainId, brandId, categoryId DEĞİŞTİRİLEMEZ.
 */
export async function updateProducts(
    creds: TrendyolCredentials,
    items: Array<{
        barcode: string
        title?: string
        productMainId?: string
        brandId?: number
        categoryId?: number
        quantity?: number
        stockCode?: string
        dimensionalWeight?: number
        description?: string
        listPrice?: number
        salePrice?: number
        vatRate?: number
        cargoCompanyId?: number
        images?: Array<{ url: string }>
        attributes?: Array<{ attributeId: number; attributeValueId?: number; customAttributeValue?: string }>
    }>
): Promise<{ batchRequestId: string }> {
    const url = `${PRODUCT_BASE_URL}/${creds.sellerId}/products`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'PUT', { items })

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Ürün güncelleme hatası: HTTP ${res.status} — ${text.slice(0, 300)}`)
    }

    const data = await res.json() as { batchRequestId?: string }
    return { batchRequestId: data.batchRequestId ?? '' }
}

/**
 * Stok ve/veya fiyat günceller.
 * Endpoint: POST /integration/inventory/sellers/{sellerId}/products/price-and-inventory
 * Rate limit: SINIR YOK — ancak 15 dakika içinde aynı istek tekrar gönderilemez (dedup).
 * Max 1000 SKU/istek | Max 20.000 adet stok/ürün
 */
export async function updateStockAndPrice(
    creds: TrendyolCredentials,
    items: Array<{
        barcode: string
        quantity?: number
        salePrice?: number
        listPrice?: number
    }>
): Promise<{ batchRequestId: string }> {
    const url = `${INVENTORY_BASE_URL}/${creds.sellerId}/products/price-and-inventory`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'POST', { items })

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Stok/fiyat güncelleme hatası: HTTP ${res.status} — ${text.slice(0, 300)}`)
    }

    const data = await res.json() as { batchRequestId?: string }
    return { batchRequestId: data.batchRequestId ?? '' }
}

/**
 * Ürün siler.
 * Endpoint: DELETE /integration/product/sellers/{sellerId}/products
 * Rate limit: 100 req/dk
 */
export async function deleteProducts(
    creds: TrendyolCredentials,
    barcodes: string[]
): Promise<{ batchRequestId: string }> {
    const url = `${PRODUCT_BASE_URL}/${creds.sellerId}/products`
    const headers = buildHeaders(creds)
    const body = { items: barcodes.map(barcode => ({ barcode })) }

    const res = await fetchWithRetryAndBody(url, headers, 'DELETE', body)

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Ürün silme hatası: HTTP ${res.status} — ${text.slice(0, 300)}`)
    }

    const data = await res.json() as { batchRequestId?: string }
    return { batchRequestId: data.batchRequestId ?? '' }
}

/**
 * Ürün arşivler veya arşivden çıkarır.
 * Endpoint: PUT /integration/product/sellers/{sellerId}/products/archive-state
 * Max 1000 ürün/istek
 */
export async function archiveProducts(
    creds: TrendyolCredentials,
    items: Array<{ barcode: string; archived: boolean }>
): Promise<{ batchRequestId: string }> {
    const url = `${PRODUCT_BASE_URL}/${creds.sellerId}/products/archive-state`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'PUT', { items })

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as { batchRequestId?: string }
    return { batchRequestId: data.batchRequestId ?? '' }
}

/**
 * Ürün kilit kaldırma.
 * Endpoint: PUT /integration/product/sellers/{sellerId}/products/unlock
 */
export async function unlockProducts(
    creds: TrendyolCredentials,
    barcodes: string[]
): Promise<{ batchRequestId: string }> {
    const url = `${PRODUCT_BASE_URL}/${creds.sellerId}/products/unlock`
    const headers = buildHeaders(creds)
    const body = { items: barcodes.map(barcode => ({ barcode })) }

    const res = await fetchWithRetryAndBody(url, headers, 'PUT', body)

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as { batchRequestId?: string }
    return { batchRequestId: data.batchRequestId ?? '' }
}

/**
 * Buybox bilgisi sorgular.
 * Endpoint: POST /integration/product/sellers/{sellerId}/products/buybox-information
 * Rate limit: 1000 req/dk | Max 10 barkod/istek
 */
export async function checkBuybox(
    creds: TrendyolCredentials,
    barcodes: string[]
): Promise<BuyboxInfo[]> {
    if (barcodes.length > 10) {
        throw new Error('Buybox sorgusu maksimum 10 barkod ile yapılabilir.')
    }

    const url = `${PRODUCT_BASE_URL}/${creds.sellerId}/products/buybox-information`
    const headers = {
        ...buildHeaders(creds),
        'storeFrontCode': 'TR', // Trendyol Türkiye — resmi doküman zorunlu kılıyor
    }

    const res = await fetchWithRetryAndBody(url, headers, 'POST', { barcodes })

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as { buyboxInfo?: BuyboxInfo[] }
    return data.buyboxInfo ?? []
}

/**
 * Batch işlem sonucunu kontrol eder.
 * Endpoint: GET /integration/product/sellers/{sellerId}/products/batch-requests/{batchId}
 * Rate limit: 1000 req/dk
 * NOT: Sonuçlar 4 saat sonra silinir!
 */
export async function checkBatchStatus(
    creds: TrendyolCredentials,
    batchId: string,
    maxDeneme = 5
): Promise<BatchStatus> {
    const url = `${PRODUCT_BASE_URL}/${creds.sellerId}/products/batch-requests/${batchId}`
    const headers = buildHeaders(creds)

    for (let i = 0; i < maxDeneme; i++) {
        await sleep(3000)
        const res = await fetchWithRetry(url, headers)

        if (!res.ok) handleTrendyolError(res.status, url)

        const data = await res.json() as {
            status?: string
            itemCount?: number
            failedItemCount?: number
            items?: Array<{ status: string; failureReasons?: string[] }>
        }

        if (data.status === 'COMPLETED') {
            const items = data.items || []
            return {
                basarili: items.filter(item => item.status === 'SUCCESS').length,
                basarisiz: items.filter(item => item.status === 'ERROR').length,
                bekleyen: 0,
                hatalar: items
                    .filter(item => item.status === 'ERROR')
                    .flatMap(item => item.failureReasons || []),
            }
        }
        // IN_PROGRESS → döngü devam eder
    }

    return { basarili: 0, basarisiz: 0, bekleyen: -1, hatalar: ['İşlem zaman aşımına uğradı.'] }
}

// ═══════════════════════════════════════════════════════════════════
//  BÖLÜM 4: SİPARİŞ API (Listeleme, Durum Güncelleme, İptal, Bölme)
// ═══════════════════════════════════════════════════════════════════

/**
 * Sipariş paketlerini listeler.
 * Endpoint: GET /integration/order/sellers/{sellerId}/orders
 * Rate limit: 1000 req/dk
 * Max size: 200 | Varsayılan aralık: son 7 gün | Max aralık: 2 hafta | Max geriye dönük: 1 ay
 *
 * ÖNEMLİ: Awaiting durumundaki siparişleri İŞLEMEYİN — Created'a geçene kadar bekleyin.
 */
export async function fetchOrders(
    creds: TrendyolCredentials,
    startDate: number,
    endDate: number,
    page = 0,
    size = 200,
    filters: {
        status?: string
        orderNumber?: string
        orderByField?: 'PackageLastModifiedDate' | 'CreatedDate'
        orderByDirection?: 'ASC' | 'DESC'
        shipmentPackageIds?: number[]
    } = {}
): Promise<TrendyolOrderPage> {
    if (!creds.sellerId || String(creds.sellerId).trim() === '') {
        throw new Error('Satıcı ID eksik.')
    }

    const params = new URLSearchParams()
    params.set('startDate', String(startDate))
    params.set('endDate', String(endDate))
    params.set('page', String(page))
    params.set('size', String(Math.min(size, 200)))
    params.set('orderByField', filters.orderByField ?? 'PackageLastModifiedDate')
    params.set('orderByDirection', filters.orderByDirection ?? 'DESC')

    if (filters.status) params.set('status', filters.status)
    if (filters.orderNumber) params.set('orderNumber', filters.orderNumber)
    if (filters.shipmentPackageIds?.length) {
        params.set('shipmentPackageIds', filters.shipmentPackageIds.join(','))
    }

    const url = `${ORDER_BASE_URL}/${creds.sellerId}/orders?${params.toString()}`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers, checkOrderRateLimit)

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as {
        content?: Record<string, unknown>[]
        totalElements?: number
        totalPages?: number
        page?: number
        size?: number
    }
    return {
        content: data.content || [],
        totalElements: data.totalElements || 0,
        totalPages: data.totalPages || 0,
        page: data.page || page,
        size: data.size || size,
    }
}

/**
 * Tüm siparişleri çeker (tarih aralığını 13 günlük pencerelere böler).
 * Trendyol kuralı: max 2 hafta (14 gün) aralık.
 * Awaiting durumundaki siparişleri otomatik filtreler.
 */
export async function fetchAllOrders(
    creds: TrendyolCredentials,
    startDate: number,
    endDate: number,
    size = 200
): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = []
    const WINDOW_MS = 13 * 24 * 60 * 60 * 1000
    const MAX_PAGES = 20

    let mevcutBaslangic = startDate

    while (mevcutBaslangic < endDate) {
        const mevcutBitis = Math.min(mevcutBaslangic + WINDOW_MS, endDate)

        let page = 0
        let totalPages = 1

        while (page < totalPages && page < MAX_PAGES) {
            const result = await fetchOrders(creds, mevcutBaslangic, mevcutBitis, page, size)
            totalPages = result.totalPages || 1

            // Awaiting durumundaki siparişleri filtrele — işlenmemeli
            const filtered = result.content.filter(order => {
                const status = String(order.status ?? order.shipmentPackageStatus ?? '')
                return status !== ORDER_STATUSES.Awaiting
            })
            all.push(...filtered)
            page++
        }

        mevcutBaslangic = mevcutBitis + 1
    }

    return all
}

/**
 * Tedarik edilemeyen (UnSupplied) / askıdaki siparişleri çeker.
 */
export async function fetchAskidakiSiparisler(
    creds: TrendyolCredentials
): Promise<Record<string, unknown>[]> {
    const headers = buildHeaders(creds)
    const tumSiparisler: Record<string, unknown>[] = []
    let page = 0
    const MAX_PAGES = 10

    while (page < MAX_PAGES) {
        await checkOrderRateLimit()
        const url =
            `${ORDER_BASE_URL}/${creds.sellerId}/orders` +
            `?status=UnSupplied&orderByField=PackageLastModifiedDate` +
            `&orderByDirection=DESC&size=200&page=${page}`
        const res = await fetchWithRetry(url, headers, checkOrderRateLimit)
        if (!res.ok) break

        const data = await res.json() as { content?: Record<string, unknown>[]; totalPages?: number }
        const content: Record<string, unknown>[] = data.content || []
        tumSiparisler.push(...content)

        if (!data.totalPages || page + 1 >= data.totalPages) break
        page++
    }

    return tumSiparisler
}

/**
 * Sipariş paket durumunu günceller.
 * Endpoint: PUT /integration/order/sellers/{sellerId}/shipment-packages/{packageId}
 *
 * Akış: Created → Picking → Invoiced (sırasıyla olmalı)
 *
 * @param status 'Picking' veya 'Invoiced'
 * @param lines Her satır: { lineId, quantity }
 * @param invoiceNumber Sadece Invoiced durumu için zorunlu (3 harf + 13 rakam)
 */
export async function updatePackageStatus(
    creds: TrendyolCredentials,
    packageId: number,
    status: 'Picking' | 'Invoiced',
    lines: Array<{ lineId: number; quantity: number }>,
    invoiceNumber?: string
): Promise<void> {
    const url = `${ORDER_BASE_URL}/${creds.sellerId}/shipment-packages/${packageId}`
    const headers = buildHeaders(creds)

    const body: Record<string, unknown> = {
        lines,
        params: status === 'Invoiced' && invoiceNumber ? { invoiceNumber } : {},
        status,
    }

    const res = await fetchWithRetryAndBody(url, headers, 'PUT', body, checkOrderRateLimit)

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Paket durum güncelleme hatası: HTTP ${res.status} — ${text.slice(0, 300)}`)
    }
}

/**
 * Siparişi tedarik edilemez olarak işaretler (iptal).
 * Endpoint: PUT /integration/order/sellers/{sellerId}/shipment-packages/{packageId}/items/unsupplied
 */
export async function markUnsupplied(
    creds: TrendyolCredentials,
    packageId: number,
    lines: Array<{ lineId: number; quantity: number }>,
    reasonId: number
): Promise<void> {
    const url = `${ORDER_BASE_URL}/${creds.sellerId}/shipment-packages/${packageId}/items/unsupplied`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'PUT', { lines, reasonId }, checkOrderRateLimit)

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Tedarik edilemez işaretleme hatası: HTTP ${res.status} — ${text.slice(0, 300)}`)
    }
}

/**
 * Paket bölme (split).
 * Endpoint: POST /integration/order/sellers/{sellerId}/shipment-packages/{packageId}/split-packages
 */
export async function splitPackage(
    creds: TrendyolCredentials,
    packageId: number,
    splitGroups: Array<{ orderLineId: number; quantity: number }>
): Promise<void> {
    const url = `${ORDER_BASE_URL}/${creds.sellerId}/shipment-packages/${packageId}/split-packages`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'POST', { splitGroups }, checkOrderRateLimit)

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Paket bölme hatası: HTTP ${res.status} — ${text.slice(0, 300)}`)
    }
}

/**
 * Paket koli bilgisi günceller.
 * Endpoint: PUT /integration/order/sellers/{sellerId}/shipment-packages/{packageId}/box-info
 * NOT: Horoz ve CEVA kargo için zorunlu.
 */
export async function updateBoxInfo(
    creds: TrendyolCredentials,
    packageId: number,
    boxQuantity: number,
    deci: number
): Promise<void> {
    const url = `${ORDER_BASE_URL}/${creds.sellerId}/shipment-packages/${packageId}/box-info`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'PUT', { boxQuantity, deci }, checkOrderRateLimit)

    if (!res.ok) handleTrendyolError(res.status, url)
}

/**
 * Kargo şirketini değiştirir.
 * Endpoint: PUT /integration/order/sellers/{sellerId}/shipment-packages/{packageId}/cargo-providers
 * NOT: Paket başına 5 dakikada bir değiştirilebilir.
 */
export async function changeCargoProvider(
    creds: TrendyolCredentials,
    packageId: number,
    cargoProviderCode: string
): Promise<void> {
    const url = `${ORDER_BASE_URL}/${creds.sellerId}/shipment-packages/${packageId}/cargo-providers`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'PUT', { cargoProvider: cargoProviderCode }, checkOrderRateLimit)

    if (!res.ok) handleTrendyolError(res.status, url)
}

/**
 * Sipariş detayını getirir (orderNumber ile).
 */
export async function getOrderDetail(
    creds: TrendyolCredentials,
    orderNumber: string
): Promise<Record<string, unknown> | null> {
    const now = Date.now()
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000
    const result = await fetchOrders(creds, monthAgo, now, 0, 1, { orderNumber })
    return result.content[0] ?? null
}

// ═══════════════════════════════════════════════════════════════════
//  BÖLÜM 5: İADE / CLAIM API
// ═══════════════════════════════════════════════════════════════════

/**
 * İade taleplerini çeker.
 * Endpoint: GET /integration/order/sellers/{sellerId}/claims
 * Params: claimIds, claimItemStatus, startDate, endDate, orderNumber, page, size
 */
export async function fetchAllClaims(
    creds: TrendyolCredentials,
    startDate: Date,
    endDate: Date,
    statusFilter?: string
): Promise<TrendyolClaim[]> {
    const headers = buildHeaders(creds)
    const results: TrendyolClaim[] = []
    const WINDOW_DAYS = 13
    const PAGE_SIZE = 200
    const MAX_PAGES = 20

    let windowStart = new Date(startDate)

    while (windowStart <= endDate) {
        const windowEnd = new Date(windowStart)
        windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS)
        if (windowEnd > endDate) windowEnd.setTime(endDate.getTime())

        const startTs = windowStart.getTime()
        const endTs = windowEnd.getTime()

        for (let page = 0; page < MAX_PAGES; page++) {
            let url = `${ORDER_BASE_URL}/${creds.sellerId}/claims?startDate=${startTs}&endDate=${endTs}&page=${page}&size=${PAGE_SIZE}`
            if (statusFilter) url += `&claimItemStatus=${statusFilter}`

            const res = await fetchWithRetry(url, headers, checkOrderRateLimit)
            if (!res.ok) break

            const data = await res.json() as { content?: Record<string, unknown>[]; totalPages?: number }
            const content: Record<string, unknown>[] = data.content || []
            if (content.length === 0) break

            content.forEach((item: Record<string, unknown>) => {
                const lines = (item.claimLines as Record<string, unknown>[] | undefined)
                    || (item.lines as Record<string, unknown>[] | undefined)
                    || []
                results.push({
                    claimId: (item.id as string) ?? (item.claimId as string) ?? '',
                    orderId: (item.orderId as string) ?? '',
                    orderNumber: (item.orderNumber as string) ?? '',
                    claimType: (item.claimType as string) ?? '',
                    claimReason: (item.claimIssueReasonText as string) ?? (item.reason as string) ?? '',
                    claimDate: trendyolTariheDonustur(item.creationDate as number | null | undefined, 'createdDate'),
                    status: (item.status as string) ?? '',
                    totalAmount: (item.refundAmount as number) ?? (item.amount as number) ?? 0,
                    lines: lines.map((l: Record<string, unknown>): TrendyolClaimLine => ({
                        claimId: (item.id as string) ?? '',
                        orderId: (item.orderId as string) ?? '',
                        orderNumber: (item.orderNumber as string) ?? '',
                        claimType: (item.claimType as string) ?? '',
                        claimReason: (l.claimIssueReasonText as string) ?? (item.claimIssueReasonText as string) ?? '',
                        claimDate: item.creationDate
                            ? new Date(item.creationDate as number).toISOString()
                            : null,
                        status: (l.status as string) ?? (item.status as string) ?? '',
                        amount: (l.refundAmount as number) ?? (l.amount as number) ?? 0,
                        quantity: (l.quantity as number) ?? 1,
                        productName: (l.productName as string) ?? (l.name as string) ?? '',
                        barcode: (l.barcode as string) ?? '',
                    })),
                })
            })

            if (!data.totalPages || page + 1 >= data.totalPages) break
        }

        windowStart = new Date(windowEnd)
        windowStart.setDate(windowStart.getDate() + 1)
    }

    return results
}

/**
 * İade talebini onaylar.
 * Endpoint: PUT /integration/order/sellers/{sellerId}/claims/{claimId}/items/approve
 * NOT: Sadece WaitingInAction durumundaki talepler onaylanabilir.
 */
export async function approveClaim(
    creds: TrendyolCredentials,
    claimId: string,
    claimLineItemIdList: string[]
): Promise<void> {
    const url = `${ORDER_BASE_URL}/${creds.sellerId}/claims/${claimId}/items/approve`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'PUT', {
        claimLineItemIdList,
        params: {},
    }, checkOrderRateLimit)

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`İade onay hatası: HTTP ${res.status} — ${text.slice(0, 300)}`)
    }
}

/**
 * İade talebini reddeder (sorun bildirimi oluşturur).
 * Endpoint: POST /integration/order/sellers/{sellerId}/claims/{claimId}/issue
 * NOT: Bazı sebep kodları dosya eki gerektirir.
 */
export async function rejectClaim(
    creds: TrendyolCredentials,
    claimId: string,
    claimIssueReasonId: number,
    claimItemIdList: string[],
    description: string
): Promise<void> {
    const url = `${ORDER_BASE_URL}/${creds.sellerId}/claims/${claimId}/issue`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'POST', {
        claimIssueReasonId,
        claimItemIdList,
        description: description.slice(0, 500),
    }, checkOrderRateLimit)

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`İade red hatası: HTTP ${res.status} — ${text.slice(0, 300)}`)
    }
}

/**
 * İade red sebep kodlarını çeker.
 * Endpoint: GET /integration/order/claim-issue-reasons
 */
export async function getClaimIssueReasons(
    creds: TrendyolCredentials
): Promise<ClaimIssueReason[]> {
    const url = `${CLAIM_REF_URL}/claim-issue-reasons`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers)

    if (!res.ok) handleTrendyolError(res.status, url)

    return (await res.json()) as ClaimIssueReason[]
}

/**
 * Satıcı tarafından iade talebi oluşturur.
 * Endpoint: POST /integration/order/sellers/{sellerId}/claims/create
 */
export async function createClaim(
    creds: TrendyolCredentials,
    params: {
        barcode: string
        customerNote: string
        quantity: number
        reasonId: number
        customerId: number
        orderNumber: string
        shipmentCompanyId?: number
        excludeListing?: boolean
    }
): Promise<{ claimId: string; cargoTrackingNumber: string; claimItemIds: string[] }> {
    const url = `${ORDER_BASE_URL}/${creds.sellerId}/claims/create`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'POST', params, checkOrderRateLimit)

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`İade talebi oluşturma hatası: HTTP ${res.status} — ${text.slice(0, 300)}`)
    }

    return await res.json() as { claimId: string; cargoTrackingNumber: string; claimItemIds: string[] }
}

// ═══════════════════════════════════════════════════════════════════
//  BÖLÜM 6: FİNANS / CARİ HESAP EKSTRESİ
// ═══════════════════════════════════════════════════════════════════

/** Resmi işlem tipleri — settlements */
export const SETTLEMENT_TRANSACTION_TYPES = [
    'Sale', 'Return', 'Discount', 'DiscountCancel',
    'Coupon', 'CouponCancel', 'ProvisionPositive', 'ProvisionNegative',
    'SellerRevenuePositive', 'SellerRevenueNegative',
    'CommissionPositive', 'CommissionNegative',
] as const

/** Resmi işlem tipleri — otherfinancials */
export const OTHER_FINANCIAL_TRANSACTION_TYPES = [
    'Stoppage', 'CashAdvance', 'WireTransfer', 'IncomingTransfer',
    'ReturnInvoice', 'CommissionAgreementInvoice', 'PaymentOrder',
    'DeductionInvoices', 'FinancialItem',
] as const

/**
 * Cari hesap ekstresi çeker (settlements).
 * Endpoint: GET /integration/finance/che/sellers/{sellerId}/settlements
 * ZORUNLU parametre: transactionType(s), startDate, endDate
 * Max aralık: 15 gün | Size: 500 veya 1000
 */
async function fetchSettlementsChunk(
    creds: TrendyolCredentials,
    headers: Record<string, string>,
    startDate: string,
    endDate: string,
    transactionTypes: string[] = ['Sale', 'Return', 'CommissionPositive', 'CommissionNegative']
): Promise<SellerSettlement[]> {
    const allItems: SellerSettlement[] = []
    const MAX_PAGES = 20

    for (let page = 0; page < MAX_PAGES; page++) {
        const params = new URLSearchParams()
        params.set('startDate', startDate)
        params.set('endDate', endDate)
        params.set('size', '500')
        params.set('page', String(page))
        params.set('supplierId', creds.sellerId) // Resmi doküman zorunlu kılıyor
        for (const tt of transactionTypes) {
            params.append('transactionType', tt)
        }

        const url = `${FINANCE_BASE_URL}/${creds.sellerId}/settlements?${params.toString()}`
        const res = await fetchWithRetry(url, headers)

        if (!res.ok) handleTrendyolError(res.status, url)

        const data = await res.json() as { content?: Record<string, unknown>[]; totalPages?: number }
        const items = (data.content || []).map((item: Record<string, unknown>): SellerSettlement => ({
            siparisId: (item.orderNumber as string) ?? '',
            paketId: (item.shipmentPackageId as number) ?? 0,
            barkod: (item.barcode as string) ?? '',
            islemTipi: (item.transactionType as string) ?? '',
            komisyonOrani: (item.commissionRate as number) ?? 0,
            komisyonTutari: (item.commissionAmount as number) ?? 0,
            saticiHakedis: (item.sellerRevenue as number) ?? 0,
            alacak: (item.credit as number) ?? 0,
            borc: (item.debt as number) ?? 0,
            odemeTarihi: trendyolTariheDonustur(item.paymentDate as number | null | undefined, 'createdDate'),
            islemTarihi: trendyolTariheDonustur(item.transactionDate as number | null | undefined, 'createdDate'),
            odemeNo: (item.paymentOrderId as number) ?? 0,
            faturaNuarasi: (item.receiptId as string) ?? '',
        }))

        allItems.push(...items)

        if (!data.totalPages || page + 1 >= data.totalPages || items.length === 0) break
    }

    return allItems
}

/**
 * Cari hesap ekstresi çeker — tarih aralığını 14 günlük pencerelere böler.
 * @param transactionTypes Resmi işlem tipleri (varsayılan: Sale, Return, Commission)
 */
export async function getSellerSettlements(
    creds: TrendyolCredentials,
    startDate: string,
    endDate: string,
    transactionTypes?: string[]
): Promise<SellerSettlement[]> {
    const headers = buildHeaders(creds)
    const results: SellerSettlement[] = []
    const types = transactionTypes ?? ['Sale', 'Return', 'CommissionPositive', 'CommissionNegative']

    const baslangic = new Date(startDate)
    const bitis = new Date(endDate)
    let mevcutBaslangic = new Date(baslangic)

    while (mevcutBaslangic <= bitis) {
        const mevcutBitis = new Date(mevcutBaslangic)
        mevcutBitis.setDate(mevcutBitis.getDate() + 14)
        if (mevcutBitis > bitis) mevcutBitis.setTime(bitis.getTime())

        // Trendyol Finance API epoch millisaniye bekliyor (YYYY-MM-DD DEĞİL)
        const start = String(mevcutBaslangic.getTime())
        const end = String(mevcutBitis.getTime())

        const chunk = await fetchSettlementsChunk(creds, headers, start, end, types)
        results.push(...chunk)

        mevcutBaslangic = new Date(mevcutBitis)
        mevcutBaslangic.setDate(mevcutBaslangic.getDate() + 1)
    }

    return results
}

/**
 * Diğer finansal işlemler (promosyon, kupon, kesinti, stopaj vb.).
 * Endpoint: GET /integration/finance/che/sellers/{sellerId}/otherfinancials
 * ZORUNLU parametre: transactionType(s), startDate, endDate
 */
export async function getOtherFinancials(
    creds: TrendyolCredentials,
    startDate: string,
    endDate: string,
    transactionTypes?: string[]
): Promise<OtherFinancial[]> {
    const headers = buildHeaders(creds)
    const results: OtherFinancial[] = []
    const types = transactionTypes ?? [
        'Stoppage', 'CashAdvance', 'WireTransfer', 'IncomingTransfer',
        'ReturnInvoice', 'CommissionAgreementInvoice', 'PaymentOrder',
        'DeductionInvoices', 'FinancialItem',
    ]

    const baslangic = new Date(startDate)
    const bitis = new Date(endDate)
    let mevcutBaslangic = new Date(baslangic)

    while (mevcutBaslangic <= bitis) {
        const mevcutBitis = new Date(mevcutBaslangic)
        mevcutBitis.setDate(mevcutBitis.getDate() + 14)
        if (mevcutBitis > bitis) mevcutBitis.setTime(bitis.getTime())

        // Trendyol Finance API epoch millisaniye bekliyor
        const start = String(mevcutBaslangic.getTime())
        const end = String(mevcutBitis.getTime())

        const params = new URLSearchParams()
        params.set('startDate', start)
        params.set('endDate', end)
        params.set('size', '500')
        params.set('supplierId', creds.sellerId)
        for (const tt of types) {
            params.append('transactionType', tt)
        }

        // Sayfalama ile çek
        for (let page = 0; page < 20; page++) {
            params.set('page', String(page))
            const url = `${FINANCE_BASE_URL}/${creds.sellerId}/otherfinancials?${params.toString()}`
            const res = await fetchWithRetry(url, headers)

            if (!res.ok) break // Hata durumunda pencereyi atla

            const data = await res.json() as { content?: Record<string, unknown>[]; totalPages?: number }
            const chunk = (data.content || []).map((item: Record<string, unknown>): OtherFinancial => ({
                islemTipi: (item.transactionType as string) ?? '',
                tutar: (item.amount as number) ?? 0,
                aciklama: (item.description as string) ?? '',
                tarih: item.transactionDate ? new Date(item.transactionDate as number).toISOString() : null,
            }))
            results.push(...chunk)

            if (!data.totalPages || page + 1 >= data.totalPages || chunk.length === 0) break
        }

        mevcutBaslangic = new Date(mevcutBitis)
        mevcutBaslangic.setDate(mevcutBaslangic.getDate() + 1)
    }

    return results
}

/**
 * Kargo fatura detayını çeker.
 * Endpoint: GET /integration/finance/che/sellers/{sellerId}/cargo-invoice/{invoiceSerialNumber}/items
 */
export async function getCargoInvoiceDetails(
    creds: TrendyolCredentials,
    invoiceSerialNumber: string
): Promise<Array<{ shipmentPackageType: string; parcelUniqueId: string; orderNumber: string; amount: number; desi: number }>> {
    const url = `${FINANCE_BASE_URL}/${creds.sellerId}/cargo-invoice/${invoiceSerialNumber}/items`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers)

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as { content?: Array<Record<string, unknown>> }
    return (data.content ?? []).map(item => ({
        shipmentPackageType: (item.shipmentPackageType as string) ?? '',
        parcelUniqueId: (item.parcelUniqueId as string) ?? '',
        orderNumber: (item.orderNumber as string) ?? '',
        amount: (item.amount as number) ?? 0,
        desi: (item.desi as number) ?? 0,
    }))
}

// ═══════════════════════════════════════════════════════════════════
//  BÖLÜM 7: WEBHOOK YÖNETİMİ
// ═══════════════════════════════════════════════════════════════════

/**
 * Webhook kayıt eder.
 * Endpoint: POST /integration/webhook/sellers/{sellerId}/webhooks
 * Max 15 webhook/satıcı (pasifler dahil).
 * URL'de "Trendyol", "Dolap", "Localhost" YASAKLANMIŞTIR.
 * Boş subscribedStatuses = tüm durumlar.
 *
 * authenticationType: "BASIC_AUTHENTICATION" veya "API_KEY"
 */
export async function registerWebhook(
    creds: TrendyolCredentials,
    webhookUrl: string,
    subscribedStatuses: string[] = []
): Promise<WebhookRegistration> {
    await checkRateLimit()
    const headers = buildHeaders(creds)
    const url = `${WEBHOOK_BASE_URL}/${creds.sellerId}/webhooks`

    const body: Record<string, unknown> = {
        url: webhookUrl,
        authenticationType: 'BASIC_AUTHENTICATION',
        username: creds.apiKey,
        password: creds.apiSecret,
    }

    if (subscribedStatuses.length > 0) {
        body.subscribedStatuses = subscribedStatuses
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Webhook kayıt hatası: HTTP ${res.status} — ${text.slice(0, 200)}`)
    }

    const data = await res.json().catch(() => ({})) as { id?: string | number; webhookId?: string }
    return {
        webhookId: String(data.id ?? data.webhookId ?? ''),
        url: webhookUrl,
        subscribedStatuses,
    }
}

/**
 * Kayıtlı webhook'ları listeler.
 * Endpoint: GET /integration/webhook/sellers/{sellerId}/webhooks
 */
export async function listWebhooks(
    creds: TrendyolCredentials
): Promise<WebhookInfo[]> {
    const url = `${WEBHOOK_BASE_URL}/${creds.sellerId}/webhooks`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers)

    if (!res.ok) handleTrendyolError(res.status, url)

    return (await res.json()) as WebhookInfo[]
}

/**
 * Webhook günceller.
 * Endpoint: PUT /integration/webhook/sellers/{sellerId}/webhooks/{webhookId}
 */
export async function updateWebhook(
    creds: TrendyolCredentials,
    webhookId: string,
    updates: {
        url?: string
        subscribedStatuses?: string[]
        authenticationType?: 'BASIC_AUTHENTICATION' | 'API_KEY'
        username?: string
        password?: string
        apiKey?: string
    }
): Promise<void> {
    const url = `${WEBHOOK_BASE_URL}/${creds.sellerId}/webhooks/${webhookId}`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'PUT', updates)

    if (!res.ok) handleTrendyolError(res.status, url)
}

/**
 * Webhook siler.
 * Endpoint: DELETE /integration/webhook/sellers/{sellerId}/webhooks/{webhookId}
 */
export async function deleteWebhook(
    creds: TrendyolCredentials,
    webhookId: string
): Promise<void> {
    const url = `${WEBHOOK_BASE_URL}/${creds.sellerId}/webhooks/${webhookId}`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'DELETE')

    if (!res.ok) handleTrendyolError(res.status, url)
}

/**
 * Webhook aktifleştirir.
 * Endpoint: PUT /integration/webhook/sellers/{sellerId}/webhooks/{webhookId}/activate
 */
export async function activateWebhook(
    creds: TrendyolCredentials,
    webhookId: string
): Promise<void> {
    const url = `${WEBHOOK_BASE_URL}/${creds.sellerId}/webhooks/${webhookId}/activate`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'PUT')

    if (!res.ok) handleTrendyolError(res.status, url)
}

/**
 * Webhook pasifleştirir.
 * Endpoint: PUT /integration/webhook/sellers/{sellerId}/webhooks/{webhookId}/deactivate
 */
export async function deactivateWebhook(
    creds: TrendyolCredentials,
    webhookId: string
): Promise<void> {
    const url = `${WEBHOOK_BASE_URL}/${creds.sellerId}/webhooks/${webhookId}/deactivate`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'PUT')

    if (!res.ok) handleTrendyolError(res.status, url)
}

// ═══════════════════════════════════════════════════════════════════
//  BÖLÜM 8: FATURA API
// ═══════════════════════════════════════════════════════════════════

/**
 * Fatura linki gönderir.
 * Endpoint: POST /integration/sellers/{sellerId}/seller-invoice-links
 * invoiceNumber: 3 harf + 13 rakam
 * invoiceDateTime: 10 veya 13 haneli timestamp
 */
export async function sendInvoiceLink(
    creds: TrendyolCredentials,
    shipmentPackageId: number,
    invoiceLink: string,
    invoiceNumber: string,
    invoiceDateTime: number
): Promise<void> {
    const url = `${INVOICE_BASE_URL}/${creds.sellerId}/seller-invoice-links`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'POST', {
        invoiceLink,
        shipmentPackageId,
        invoiceDateTime,
        invoiceNumber,
    })

    if (!res.ok) {
        if (res.status === 409) {
            throw new Error('Bu paket için zaten bir fatura linki kayıtlı.')
        }
        handleTrendyolError(res.status, url)
    }
}

/**
 * Fatura linkini siler.
 * Endpoint: DELETE /integration/sellers/{sellerId}/seller-invoice-links
 */
export async function deleteInvoiceLink(
    creds: TrendyolCredentials,
    shipmentPackageId: number
): Promise<void> {
    const url = `${INVOICE_BASE_URL}/${creds.sellerId}/seller-invoice-links`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'DELETE', { shipmentPackageId })

    if (!res.ok) handleTrendyolError(res.status, url)
}

// ═══════════════════════════════════════════════════════════════════
//  BÖLÜM 9: SORU & CEVAP (Q&A) API
// ═══════════════════════════════════════════════════════════════════

/**
 * Müşteri sorularını çeker.
 * Endpoint: GET /integration/qna/sellers/{sellerId}/questions/filter
 * Max size: 50 | Max aralık: 2 hafta | Varsayılan: son 1 hafta
 */
export async function getQuestions(
    creds: TrendyolCredentials,
    params: {
        startDate?: number
        endDate?: number
        status?: 'WAITING_FOR_ANSWER' | 'ANSWERED' | 'REPORTED' | 'REJECTED' | 'UNANSWERED'
        barcode?: string
        page?: number
        size?: number
        orderByField?: string
        orderByDirection?: 'ASC' | 'DESC'
    } = {}
): Promise<{ content: QuestionItem[]; totalElements: number; totalPages: number }> {
    const qp = new URLSearchParams()
    if (params.startDate) qp.set('startDate', String(params.startDate))
    if (params.endDate) qp.set('endDate', String(params.endDate))
    if (params.status) qp.set('status', params.status)
    if (params.barcode) qp.set('barcode', params.barcode)
    qp.set('page', String(params.page ?? 0))
    qp.set('size', String(Math.min(params.size ?? 50, 50)))
    if (params.orderByField) qp.set('orderByField', params.orderByField)
    if (params.orderByDirection) qp.set('orderByDirection', params.orderByDirection)

    const url = `${QNA_BASE_URL}/${creds.sellerId}/questions/filter?${qp.toString()}`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers)

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as { content?: QuestionItem[]; totalElements?: number; totalPages?: number }
    return {
        content: data.content ?? [],
        totalElements: data.totalElements ?? 0,
        totalPages: data.totalPages ?? 0,
    }
}

/**
 * Tek soru detayını getirir.
 * Endpoint: GET /integration/qna/sellers/{sellerId}/questions/{questionId}
 */
export async function getQuestionById(
    creds: TrendyolCredentials,
    questionId: number
): Promise<QuestionItem | null> {
    const url = `${QNA_BASE_URL}/${creds.sellerId}/questions/${questionId}`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers)

    if (!res.ok) return null

    return (await res.json()) as QuestionItem
}

/**
 * Müşteri sorusunu yanıtlar.
 * Endpoint: POST /integration/qna/sellers/{sellerId}/questions/{questionId}/answers
 * Text: 10-2000 karakter | Sadece WAITING_FOR_ANSWER durumunda yanıtlanabilir
 */
export async function answerQuestion(
    creds: TrendyolCredentials,
    questionId: number,
    text: string
): Promise<{ answerId: number }> {
    if (text.length < 10 || text.length > 2000) {
        throw new Error('Yanıt 10-2000 karakter arasında olmalıdır.')
    }

    const url = `${QNA_BASE_URL}/${creds.sellerId}/questions/${questionId}/answers`
    const headers = buildHeaders(creds)

    const res = await fetchWithRetryAndBody(url, headers, 'POST', { text })

    if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Soru yanıtlama hatası: HTTP ${res.status} — ${errText.slice(0, 300)}`)
    }

    return (await res.json()) as { answerId: number }
}

// ═══════════════════════════════════════════════════════════════════
//  BÖLÜM 10: KARGO ETİKETİ API
// ═══════════════════════════════════════════════════════════════════

/**
 * Kargo etiketi oluşturma talebi.
 * Endpoint: POST /integration/sellers/{sellerId}/common-label/{cargoTrackingNumber}
 * NOT: Sadece TEX ve Aras Kargo desteklenir. Asenkron — GET ile alınır.
 */
export async function createLabel(
    creds: TrendyolCredentials,
    cargoTrackingNumber: string,
    format: 'ZPL' | 'PDF' = 'ZPL',
    boxQuantity = 1,
    volumetricHeight?: number
): Promise<void> {
    const url = `${LABEL_BASE_URL}/${creds.sellerId}/common-label/${cargoTrackingNumber}`
    const headers = buildHeaders(creds)
    const body: Record<string, unknown> = { format, boxQuantity }
    if (volumetricHeight !== undefined) body.volumetricHeight = volumetricHeight

    const res = await fetchWithRetryAndBody(url, headers, 'POST', body)

    if (!res.ok) handleTrendyolError(res.status, url)
}

/**
 * Oluşturulan kargo etiketini çeker.
 * Endpoint: GET /integration/sellers/{sellerId}/common-label/{cargoTrackingNumber}
 */
export async function getLabel(
    creds: TrendyolCredentials,
    cargoTrackingNumber: string
): Promise<Array<{ label: string; format: string }>> {
    const url = `${LABEL_BASE_URL}/${creds.sellerId}/common-label/${cargoTrackingNumber}`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers)

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as { data?: Array<{ label: string; format: string }> }
    return data.data ?? []
}

// ═══════════════════════════════════════════════════════════════════
//  BÖLÜM 11: SATICI ADRES API
// ═══════════════════════════════════════════════════════════════════

/**
 * Satıcı adreslerini çeker.
 * Endpoint: GET /integration/sellers/{sellerId}/addresses
 * Rate limit: 1 istek/SAAT — çok sınırlı, cache'leyin!
 */
export async function getSellerAddresses(
    creds: TrendyolCredentials
): Promise<SellerAddress[]> {
    const url = `${INVOICE_BASE_URL}/${creds.sellerId}/addresses`
    const headers = buildHeaders(creds)
    const res = await fetchWithRetry(url, headers)

    if (!res.ok) handleTrendyolError(res.status, url)

    const data = await res.json() as { supplierAddresses?: Array<Record<string, unknown>> }
    return (data.supplierAddresses ?? []).map(addr => ({
        id: (addr.id as number) ?? 0,
        addressType: (addr.addressType as 'Shipment' | 'Invoice' | 'Returning') ?? 'Shipment',
        city: (addr.city as string) ?? '',
        district: (addr.district as string) ?? '',
        fullAddress: (addr.fullAddress as string) ?? '',
        isDefault: (addr.isDefault as boolean) ?? false,
    }))
}

// ═══════════════════════════════════════════════════════════════════
//  BÖLÜM 12: KOMİSYON ORANLARI
// ═══════════════════════════════════════════════════════════════════

/**
 * Komisyon oranlarını sipariş satırlarından hesaplar.
 * Trendyol resmi API'de ayrı bir komisyon endpoint'i YOK.
 * Komisyon bilgisi:
 *   1. Sipariş satırlarındaki `commission` alanından (her satırda var)
 *   2. Finans settlement API'den (`commissionRate`, `commissionAmount`)
 *
 * Bu fonksiyon mevcut sipariş verilerinden komisyon oranlarını çıkarır.
 */
export function extractCommissionFromOrders(
    orders: Record<string, unknown>[]
): Map<string, number> {
    const categoryCommissions = new Map<string, { total: number; count: number }>()

    for (const order of orders) {
        const lines = (order.lines ?? order.orderItems ?? []) as Record<string, unknown>[]
        for (const line of lines) {
            const commission = (line.commission as number) ?? 0
            const amount = (line.amount as number) ?? (line.price as number) ?? 0
            const categoryName = (line.categoryName as string) ?? 'Genel'

            if (amount > 0 && commission > 0) {
                const rate = (commission / amount) * 100
                const existing = categoryCommissions.get(categoryName) ?? { total: 0, count: 0 }
                existing.total += rate
                existing.count += 1
                categoryCommissions.set(categoryName, existing)
            }
        }
    }

    const result = new Map<string, number>()
    for (const [category, data] of categoryCommissions) {
        result.set(category, Math.round((data.total / data.count) * 100) / 100)
    }
    return result
}

/**
 * Geriye dönük uyumluluk — eski kod bu fonksiyonu kullanıyor olabilir.
 * NOT: Resmi API'de /commissions endpoint'i dokümante edilmemiştir.
 * Komisyon verileri sipariş satırlarından veya finans API'den alınmalıdır.
 */
export async function getCommissionRates(
    creds: TrendyolCredentials,
    _categoryId?: number
): Promise<CommissionRate[]> {
    // Gerçek komisyon verileri sipariş satırlarından veya
    // finans settlement API'den alınmalıdır.
    // Bu fonksiyon mock veri ile geriye uyumluluğu korur.
    return []
}
