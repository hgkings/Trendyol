/**
 * Trendyol Seller API Client — Server-only
 *
 * Base URL: https://api.trendyol.com/sapigw/suppliers/{supplierId}
 * Auth: Basic (apiKey:apiSecret → base64)
 * User-Agent: {supplierId} - SelfIntegration
 * Rate limit: 45 req/10s client-side limiter + 12s wait on 429
 *
 * Mock mode: apiKey === "TRENDYOL_TEST" — gerçek API çağrısı yapılmaz.
 *
 * NEVER log credentials, auth headers, or tokens.
 */

const BASE_URL = process.env.TRENDYOL_ENV === 'stage'
    ? 'https://stageapi.trendyol.com/stagesapigw'
    : 'https://api.trendyol.com/sapigw';

// Sipariş API'si yeni domain ve path kullanıyor (Trendyol dok. güncellemesi)
const ORDER_BASE_URL = process.env.TRENDYOL_ENV === 'stage'
    ? 'https://stageapi.trendyol.com/stagesapigw/integration/order/sellers'
    : 'https://apigw.trendyol.com/integration/order/sellers';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const TIMEOUT_MS = 10000;

export const TRENDYOL_TEST_KEY = 'TRENDYOL_TEST';

export interface TrendyolCredentials {
    apiKey: string;
    apiSecret: string;
    sellerId: string;
}

// ─── Mock Data ───────────────────────────────────────────────

const MOCK_PRODUCTS = [
    { id: '1001', barcode: 'TY-001', title: 'Samsung Galaxy S21 128GB', salePrice: 15999, listPrice: 17999, stockCount: 45, categoryName: 'Elektronik > Cep Telefonu', stockCode: 'SGS21-BLK' },
    { id: '1002', barcode: 'TY-002', title: "Levi's 501 Original Jeans", salePrice: 899, listPrice: 1199, stockCount: 120, categoryName: 'Giyim > Erkek > Pantolon', stockCode: 'LV501-32' },
    { id: '1003', barcode: 'TY-003', title: 'Philips XXL Air Fryer 7L', salePrice: 2499, listPrice: 2999, stockCount: 23, categoryName: 'Ev & Yaşam > Mutfak Aletleri', stockCode: 'PH-AF7L' },
    { id: '1004', barcode: 'TY-004', title: 'Nike Air Max 270 React', salePrice: 1299, listPrice: 1799, stockCount: 67, categoryName: 'Ayakkabı > Erkek > Spor', stockCode: 'NK-AM270-42' },
    { id: '1005', barcode: 'TY-005', title: 'Apple Watch Series 9 41mm', salePrice: 13999, listPrice: 14999, stockCount: 12, categoryName: 'Elektronik > Akıllı Saat', stockCode: 'AW-S9-41' },
];

const MOCK_ORDERS = [
    { orderId: 'ORD-001', orderDate: '2026-03-01T10:00:00Z', status: 'Delivered', totalPrice: 15999, commission: 1280, cargoPrice: 0, netEarning: 14719 },
    { orderId: 'ORD-002', orderDate: '2026-03-02T14:30:00Z', status: 'Delivered', totalPrice: 899, commission: 108, cargoPrice: 29.9, netEarning: 761.1 },
    { orderId: 'ORD-003', orderDate: '2026-03-05T09:15:00Z', status: 'Shipped', totalPrice: 2499, commission: 250, cargoPrice: 0, netEarning: 2249 },
    { orderId: 'ORD-004', orderDate: '2026-03-06T16:45:00Z', status: 'Shipped', totalPrice: 1299, commission: 130, cargoPrice: 29.9, netEarning: 1139.1 },
    { orderId: 'ORD-005', orderDate: '2026-03-08T11:20:00Z', status: 'Created', totalPrice: 13999, commission: 1120, cargoPrice: 0, netEarning: 12879 },
    { orderId: 'ORD-006', orderDate: '2026-03-10T13:00:00Z', status: 'Cancelled', totalPrice: 899, commission: 0, cargoPrice: 0, netEarning: 0 },
    { orderId: 'ORD-007', orderDate: '2026-03-12T08:30:00Z', status: 'Delivered', totalPrice: 2499, commission: 216, cargoPrice: 0, netEarning: 2283 },
    { orderId: 'ORD-008', orderDate: '2026-03-13T17:00:00Z', status: 'Delivered', totalPrice: 1299, commission: 156, cargoPrice: 29.9, netEarning: 1113.1 },
    { orderId: 'ORD-009', orderDate: '2026-03-15T12:10:00Z', status: 'Shipped', totalPrice: 15999, commission: 1200, cargoPrice: 0, netEarning: 14799 },
    { orderId: 'ORD-010', orderDate: '2026-03-17T09:45:00Z', status: 'Created', totalPrice: 13999, commission: 1120, cargoPrice: 0, netEarning: 12879 },
];

const MOCK_COMMISSION_RATES: CommissionRate[] = [
    { categoryId: 1, categoryName: 'Elektronik', commissionRate: 8 },
    { categoryId: 2, categoryName: 'Giyim', commissionRate: 12 },
    { categoryId: 3, categoryName: 'Ev & Yaşam', commissionRate: 10 },
    { categoryId: 4, categoryName: 'Ayakkabı', commissionRate: 15 },
];

const MOCK_SHIPMENT_PROVIDERS: ShipmentProvider[] = [
    { id: 1, name: 'Yurtiçi Kargo', code: 'YURTICI' },
    { id: 2, name: 'Aras Kargo', code: 'ARAS' },
    { id: 3, name: 'MNG Kargo', code: 'MNG' },
    { id: 4, name: 'PTT Kargo', code: 'PTT' },
];

// ─── Rate Limiter (45 req / 10s — Trendyol limiti 50) ────────

const rateLimiter = {
    requests: [] as number[],
    maxRequests: 45,
    windowMs: 10_000,
};

async function checkRateLimit(): Promise<void> {
    const now = Date.now();
    rateLimiter.requests = rateLimiter.requests.filter(t => now - t < rateLimiter.windowMs);

    if (rateLimiter.requests.length >= rateLimiter.maxRequests) {
        const bekleme = rateLimiter.windowMs - (now - rateLimiter.requests[0]) + 100;
        console.log(`[trendyol-api] Rate limit: ${bekleme}ms bekleniyor`);
        await sleep(bekleme);
    }

    rateLimiter.requests.push(Date.now());
}

// ─── Helpers ─────────────────────────────────────────────────

function isMockMode(creds: TrendyolCredentials): boolean {
    return creds.apiKey === TRENDYOL_TEST_KEY;
}

function buildHeaders(creds: TrendyolCredentials): Record<string, string> {
    const token = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64');
    return {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': `${String(creds.sellerId).trim()} - SelfIntegration`,
    };
}

async function fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            await checkRateLimit();

            const res = await fetch(url, {
                headers,
                method: 'GET',
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });

            // Success or non-retryable 4xx → return immediately
            if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
                return res;
            }

            // 429 → Trendyol rate limit, 12s sabit bekleme
            // 5xx → sunucu hatası, exponential backoff
            if (res.status === 429 || res.status >= 500) {
                const backoff = res.status === 429
                    ? 12_000
                    : INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                console.log(`[trendyol-api] Status ${res.status}, retry ${attempt + 1}/${MAX_RETRIES} after ${backoff}ms`);
                await sleep(backoff);
                continue;
            }

            return res;
        } catch (err: any) {
            lastError = err;
            if (attempt < MAX_RETRIES) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                console.log(`[trendyol-api] Network error, retry ${attempt + 1}/${MAX_RETRIES} after ${backoff}ms`);
                await sleep(backoff);
            }
        }
    }

    throw lastError || new Error('Max retries exceeded');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Error Handling ───────────────────────────────────────────

const TRENDYOL_ERROR_MESSAGES: Record<number, string> = {
    400: 'Gönderilen bilgiler hatalı. API Key, Secret ve Satıcı ID\'yi kontrol edin.',
    401: 'API Key veya API Secret hatalı. Trendyol Satıcı Paneli → Hesabım → Entegrasyon Bilgileri\'nden güncel bilgileri alın.',
    403: 'Erişim reddedildi. Satıcı ID\'nin doğru olduğunu ve hesabınızın API erişimine açık olduğunu kontrol edin.',
    404: 'Satıcı ID ile eşleşen mağaza bulunamadı. ID\'yi kontrol edin.',
    429: 'Çok fazla istek gönderildi. Lütfen 1-2 dakika bekleyip tekrar deneyin.',
    500: 'Trendyol\'un sisteminde geçici bir sorun var. Birkaç dakika sonra tekrar deneyin.',
};

function getTrendyolErrorMessage(status: number): string {
    return TRENDYOL_ERROR_MESSAGES[status] ?? `Trendyol hatası (HTTP ${status})`;
}

function handleTrendyolError(status: number, endpoint: string): never {
    console.error(`[trendyol-api] HTTP ${status} — ${endpoint}`);
    throw new Error(getTrendyolErrorMessage(status));
}

// ─── Test Connection ──────────────────────────────────────────

export async function testConnection(
    creds: TrendyolCredentials
): Promise<{ success: boolean; message: string; storeName?: string }> {
    if (!creds.sellerId || String(creds.sellerId).trim() === '') {
        return {
            success: false,
            message: 'Satıcı ID eksik. Lütfen pazaryeri ayarlarından Satıcı ID bilgisini güncelleyin.',
        };
    }

    if (isMockMode(creds)) {
        return {
            success: true,
            message: 'Bağlantı başarılı. Toplam 5 ürün bulundu. (Test Modu)',
            storeName: 'Trendyol Test Mağazası',
        };
    }

    try {
        const url = `${BASE_URL}/suppliers/${creds.sellerId}/products?page=0&size=1`;
        const headers = buildHeaders(creds);
        const res = await fetchWithRetry(url, headers);

        if (res.ok) {
            const data = await res.json();
            return {
                success: true,
                message: `Bağlantı başarılı. Toplam ${data.totalElements ?? '?'} ürün bulundu.`,
                storeName: undefined,
            };
        }

        return { success: false, message: getTrendyolErrorMessage(res.status) };
    } catch (err: any) {
        return { success: false, message: err?.message || 'Trendyol bağlantısı kurulamadı.' };
    }
}

// ─── Products ────────────────────────────────────────────────

export interface TrendyolProductPage {
    content: any[];
    totalElements: number;
    totalPages: number;
    page: number;
    size: number;
}

export async function fetchProducts(
    creds: TrendyolCredentials,
    page = 0,
    size = 50
): Promise<TrendyolProductPage> {
    if (!creds.sellerId || String(creds.sellerId).trim() === '') {
        throw new Error('Satıcı ID eksik. Lütfen pazaryeri ayarlarından Satıcı ID bilgisini güncelleyin.');
    }

    if (isMockMode(creds)) {
        return {
            content: MOCK_PRODUCTS,
            totalElements: MOCK_PRODUCTS.length,
            totalPages: 1,
            page: 0,
            size,
        };
    }

    const url = `${BASE_URL}/suppliers/${creds.sellerId}/products?page=${page}&size=${size}`;
    const headers = buildHeaders(creds);
    const res = await fetchWithRetry(url, headers);

    if (!res.ok) handleTrendyolError(res.status, url);

    const data = await res.json();
    return {
        content: data.content || [],
        totalElements: data.totalElements || 0,
        totalPages: data.totalPages || 0,
        page: data.page || page,
        size: data.size || size,
    };
}

export async function getProductByBarcode(
    creds: TrendyolCredentials,
    barcode: string
): Promise<any | null> {
    if (isMockMode(creds)) {
        return MOCK_PRODUCTS.find(p => p.barcode === barcode) ?? null;
    }

    const url = `${BASE_URL}/suppliers/${creds.sellerId}/products?barcode=${encodeURIComponent(barcode)}&page=0&size=1`;
    const headers = buildHeaders(creds);
    const res = await fetchWithRetry(url, headers);

    if (!res.ok) handleTrendyolError(res.status, url);

    const data = await res.json();
    return data.content?.[0] ?? null;
}

// ─── Orders ──────────────────────────────────────────────────

export interface TrendyolOrderPage {
    content: any[];
    totalElements: number;
    totalPages: number;
    page: number;
    size: number;
}

export async function fetchOrders(
    creds: TrendyolCredentials,
    startDate: number,   // epoch millis
    endDate: number,     // epoch millis
    page = 0,
    size = 50
): Promise<TrendyolOrderPage> {
    if (!creds.sellerId || String(creds.sellerId).trim() === '') {
        throw new Error('Satıcı ID eksik. Lütfen pazaryeri ayarlarından Satıcı ID bilgisini güncelleyin.');
    }

    if (isMockMode(creds)) {
        return {
            content: MOCK_ORDERS,
            totalElements: MOCK_ORDERS.length,
            totalPages: 1,
            page: 0,
            size,
        };
    }

    const url = `${ORDER_BASE_URL}/${creds.sellerId}/orders?startDate=${startDate}&endDate=${endDate}&orderByField=PackageLastModifiedDate&orderByDirection=DESC&page=${page}&size=${size}`;
    const headers = buildHeaders(creds);
    const res = await fetchWithRetry(url, headers);

    if (!res.ok) handleTrendyolError(res.status, url);

    const data = await res.json();
    return {
        content: data.content || [],
        totalElements: data.totalElements || 0,
        totalPages: data.totalPages || 0,
        page: data.page || page,
        size: data.size || size,
    };
}

export async function getOrderDetail(
    creds: TrendyolCredentials,
    orderId: string
): Promise<any | null> {
    if (isMockMode(creds)) {
        return MOCK_ORDERS.find(o => o.orderId === orderId) ?? null;
    }

    const url = `${ORDER_BASE_URL}/${creds.sellerId}/orders/${orderId}`;
    const headers = buildHeaders(creds);
    const res = await fetchWithRetry(url, headers);

    if (!res.ok) handleTrendyolError(res.status, url);
    return res.json();
}

// ─── Commission Rates ────────────────────────────────────────

export interface CommissionRate {
    categoryId: number;
    categoryName: string;
    commissionRate: number;
}

export async function getCommissionRates(
    creds: TrendyolCredentials,
    categoryId?: number
): Promise<CommissionRate[]> {
    if (isMockMode(creds)) {
        return categoryId
            ? MOCK_COMMISSION_RATES.filter(c => c.categoryId === categoryId)
            : MOCK_COMMISSION_RATES;
    }

    const url = `${BASE_URL}/suppliers/${creds.sellerId}/commissions${categoryId ? `?categoryId=${categoryId}` : ''}`;
    const headers = buildHeaders(creds);
    const res = await fetchWithRetry(url, headers);

    if (!res.ok) handleTrendyolError(res.status, url);

    const data = await res.json();
    return data.commissions || data || [];
}

// ─── Shipment Providers ──────────────────────────────────────

export interface ShipmentProvider {
    id: number;
    name: string;
    code: string;
}

export async function getShipmentProviders(creds: TrendyolCredentials): Promise<ShipmentProvider[]> {
    if (isMockMode(creds)) return MOCK_SHIPMENT_PROVIDERS;

    const url = `${BASE_URL}/shipment-providers`;
    const headers = buildHeaders(creds);
    const res = await fetchWithRetry(url, headers);

    if (!res.ok) handleTrendyolError(res.status, url);

    const data = await res.json();
    return data.shipmentProviders || data || [];
}

// ─── Batch Status (Outbound ürün push sonrası kontrol) ────────
// Kullanım: Trendyol'a ürün GÖNDERİLDİKTEN sonra batchId ile sonuç sorgulanır.
// Mevcut sync-products inbound sync (Trendyol → Kârnet DB) yaptığı için
// batchId bu akışta kullanılmaz; outbound push özelliği eklendiğinde devreye girer.

export interface BatchStatus {
    basarili: number;
    basarisiz: number;
    bekleyen: number;   // -1 = zaman aşımı
    hatalar: string[];
}

export async function checkBatchStatus(
    creds: TrendyolCredentials,
    batchId: string,
    maxDeneme = 5
): Promise<BatchStatus> {
    if (isMockMode(creds)) {
        return { basarili: 0, basarisiz: 0, bekleyen: 0, hatalar: [] };
    }

    const url = `${BASE_URL}/suppliers/${creds.sellerId}/products/batch-requests/${batchId}`;
    const headers = buildHeaders(creds);

    for (let i = 0; i < maxDeneme; i++) {
        await sleep(3000);
        const res = await fetchWithRetry(url, headers);

        if (!res.ok) handleTrendyolError(res.status, url);

        const data = await res.json();

        if (data.status === 'COMPLETED') {
            const items: any[] = data.items || [];
            return {
                basarili: items.filter(item => item.status === 'SUCCESS').length,
                basarisiz: items.filter(item => item.status === 'ERROR').length,
                bekleyen: 0,
                hatalar: items
                    .filter(item => item.status === 'ERROR')
                    .flatMap(item => item.failureReasons || []),
            };
        }
        // IN_PROGRESS → döngü devam eder
    }

    return { basarili: 0, basarisiz: 0, bekleyen: -1, hatalar: ['İşlem zaman aşımına uğradı.'] };
}

// ─── Finance / Cari Hesap Ekstresi ───────────────────────────
// Trendyol kuralı: startDate - endDate arası max 15 gün olabilir.
// Daha uzun aralıklar için 14 günlük pencerelere bölerek çağrı yapılır.

export interface SellerSettlement {
    siparisId: string;
    paketId: number;
    barkod: string;
    islemTipi: string;
    komisyonOrani: number;
    komisyonTutari: number;
    saticiHakedis: number;
    alacak: number;
    borc: number;
    odemeTarihi: string | null;
    islemTarihi: string | null;
    odemeNo: number;
}

async function fetchSettlementsChunk(
    creds: TrendyolCredentials,
    headers: Record<string, string>,
    startDate: string,
    endDate: string
): Promise<SellerSettlement[]> {
    const url = `${BASE_URL}/suppliers/${creds.sellerId}/finance/che/seller-settlements?startDate=${startDate}&endDate=${endDate}`;
    const res = await fetchWithRetry(url, headers);

    if (!res.ok) handleTrendyolError(res.status, url);

    const data = await res.json();
    return (data.content || []).map((item: any): SellerSettlement => ({
        siparisId: item.orderNumber ?? '',
        paketId: item.shipmentPackageId ?? 0,
        barkod: item.barcode ?? '',
        islemTipi: item.transactionType ?? '',
        komisyonOrani: item.commissionRate ?? 0,
        komisyonTutari: item.commissionAmount ?? 0,
        saticiHakedis: item.sellerRevenue ?? 0,
        alacak: item.credit ?? 0,
        borc: item.debt ?? 0,
        odemeTarihi: item.paymentDate ? new Date(item.paymentDate).toISOString() : null,
        islemTarihi: item.transactionDate ? new Date(item.transactionDate).toISOString() : null,
        odemeNo: item.paymentOrderId ?? 0,
    }));
}

export async function getSellerSettlements(
    creds: TrendyolCredentials,
    startDate: string,
    endDate: string
): Promise<SellerSettlement[]> {
    if (isMockMode(creds)) return [];

    const headers = buildHeaders(creds);
    const results: SellerSettlement[] = [];

    const baslangic = new Date(startDate);
    const bitis = new Date(endDate);
    let mevcutBaslangic = new Date(baslangic);

    while (mevcutBaslangic <= bitis) {
        const mevcutBitis = new Date(mevcutBaslangic);
        mevcutBitis.setDate(mevcutBitis.getDate() + 14);
        if (mevcutBitis > bitis) mevcutBitis.setTime(bitis.getTime());

        const start = mevcutBaslangic.toISOString().split('T')[0];
        const end = mevcutBitis.toISOString().split('T')[0];

        const chunk = await fetchSettlementsChunk(creds, headers, start, end);
        results.push(...chunk);

        mevcutBaslangic = new Date(mevcutBitis);
        mevcutBaslangic.setDate(mevcutBaslangic.getDate() + 1);
    }

    return results;
}
