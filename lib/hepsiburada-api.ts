/**
 * Hepsiburada Merchant API Client — Server-only
 *
 * Auth: HTTP Basic Auth — Authorization: Basic base64(username:password)
 * Env: HEPSIBURADA_USERNAME, HEPSIBURADA_PASSWORD, HEPSIBURADA_MERCHANT_ID
 *
 * Base URLs:
 *   OMS (orders/claims): https://oms-external.hepsiburada.com
 *   FIN (finance):       https://mpfinance-external.hepsiburada.com
 *   LIST (products):     https://listing-external.hepsiburada.com
 *
 * SIT ortamı: HEPSIBURADA_ENV=sit → *-sit.hepsiburada.com
 *
 * Rate limit: 10.000 req / 10s
 *   429 → X-RateLimit-Reset header'ından saniye oku, bekle, max 3 retry
 *
 * Mock mode: apiKey === "HB_TEST" — gerçek API çağrısı yapılmaz.
 *
 * NEVER log credentials, auth headers, or tokens.
 */

// ─── Base URLs ──────────────────────────────────────────────

const HB_OMS =
    process.env.HEPSIBURADA_ENV === 'sit'
        ? 'https://oms-external-sit.hepsiburada.com'
        : 'https://oms-external.hepsiburada.com';

const HB_FIN =
    process.env.HEPSIBURADA_ENV === 'sit'
        ? 'https://mpfinance-external-sit.hepsiburada.com'
        : 'https://mpfinance-external.hepsiburada.com';

const HB_LIST =
    process.env.HEPSIBURADA_ENV === 'sit'
        ? 'https://listing-external-sit.hepsiburada.com'
        : 'https://listing-external.hepsiburada.com';

const MAX_RETRIES = 3;
const TIMEOUT_MS = 10000;

export const HB_TEST_KEY = 'HB_TEST';

/**
 * HepsiburadaCredentials
 * apiKey    = Hepsiburada merchant username (HEPSIBURADA_USERNAME)
 * apiSecret = Hepsiburada merchant password (HEPSIBURADA_PASSWORD)
 * merchantId = Hepsiburada merchant ID — GUID format (HEPSIBURADA_MERCHANT_ID)
 */
export interface HepsiburadaCredentials {
    apiKey: string;
    apiSecret: string;
    merchantId: string;
}

export const HB_STATUS_MAP: Record<string, string> = {
    Created: 'beklemede',
    Shipped: 'kargoda',
    Delivered: 'tamamlandı',
    Cancelled: 'iptal',
};

// ─── Mock Data ───────────────────────────────────────────────

const MOCK_PRODUCTS = [
    { merchantSku: 'SONY-WH1000XM5', hepsiburadaSku: 'HB-SKU-001', urunAdi: 'Sony WH-1000XM5 Kablosuz Kulaklık', fiyat: 8499, stok: 34 },
    { merchantSku: 'ADIDAS-UB22-42', hepsiburadaSku: 'HB-SKU-002', urunAdi: 'Adidas Ultraboost 22 Spor Ayakkabı', fiyat: 2199, stok: 56 },
    { merchantSku: 'TEFAL-CP6000', hepsiburadaSku: 'HB-SKU-003', urunAdi: 'Tefal Comfort Pressure Cooker 6L', fiyat: 1299, stok: 18 },
    { merchantSku: 'MAVI-101-32', hepsiburadaSku: 'HB-SKU-004', urunAdi: 'Mavi Jeans 101 Slim Fit Pantolon', fiyat: 699, stok: 89 },
    { merchantSku: 'DYSON-V11', hepsiburadaSku: 'HB-SKU-005', urunAdi: 'Dyson V11 Kablosuz Süpürge', fiyat: 14999, stok: 7 },
];

const MOCK_ORDERS = [
    { siparisNo: 'HB-ORD-001', siparisTarihi: '2026-03-01T10:00:00Z', musteriAdi: 'Test Müşteri', hepsiburadaSku: 'HB-SKU-001', birimFiyat: 8499, adet: 1, toplamFiyat: 8499 },
    { siparisNo: 'HB-ORD-002', siparisTarihi: '2026-03-02T14:30:00Z', musteriAdi: 'Test Müşteri 2', hepsiburadaSku: 'HB-SKU-002', birimFiyat: 2199, adet: 1, toplamFiyat: 2199 },
    { siparisNo: 'HB-ORD-003', siparisTarihi: '2026-03-04T09:15:00Z', musteriAdi: 'Test Müşteri 3', hepsiburadaSku: 'HB-SKU-003', birimFiyat: 1299, adet: 2, toplamFiyat: 2598 },
];

const MOCK_FINANCE_RECORDS = [
    { hepsiburadaSku: 'HB-SKU-001', paketNo: 'PKG-001', siparisNo: 'HB-ORD-001', toplamTutar: 8499, vergiTutari: 1529.82, netTutar: 6969.18, aciklama: 'Payment', gelirMi: true, faturaMi: true },
    { hepsiburadaSku: 'HB-SKU-001', paketNo: 'PKG-001', siparisNo: 'HB-ORD-001', toplamTutar: 765, vergiTutari: 137.7, netTutar: 627.3, aciklama: 'Komisyon', gelirMi: false, faturaMi: true },
];

const MOCK_CLAIMS = [
    { talepId: 'CLM-001', siparisNo: 'HB-ORD-001', hepsiburadaSku: 'HB-SKU-001', talepTipi: 'Return', talepDurumu: 'Approved', talepNedeni: 'Ürün hasarlı', adet: 1, talepTarihi: '2026-03-10T10:00:00Z', birimFiyat: 8499 },
];

// ─── Helpers ─────────────────────────────────────────────────

function isMockMode(creds: HepsiburadaCredentials): boolean {
    return creds.apiKey === HB_TEST_KEY;
}

/**
 * HTTP Basic Auth header üretir.
 * 'Basic ' + Base64(username:password)
 */
export function getAuthHeader(creds: HepsiburadaCredentials): string {
    return 'Basic ' + Buffer.from(creds.apiKey + ':' + creds.apiSecret).toString('base64');
}

function buildHeaders(creds: HepsiburadaCredentials): Record<string, string> {
    return {
        'Authorization': getAuthHeader(creds),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
}

/**
 * HB tarih formatı: 'yyyy-MM-dd HH:mm'
 * Trendyol'daki ms timestamp DEĞİL — HB string format kullanır.
 */
export function formatHbDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}`;
}

/**
 * HB finans API tarih formatı: 'yyyy-M-d' (sıfır pad YOK)
 */
export function formatFinDate(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * HB API fetch wrapper — 429 rate limit handling.
 * 429 gelirse X-RateLimit-Reset header'ından bekleme süresi okunur.
 * Max 3 retry, sonra throw.
 */
async function hbFetch(
    url: string,
    options: { headers: Record<string, string>; method?: string },
    retry = 0
): Promise<Response> {
    try {
        const res = await fetch(url, {
            method: options.method || 'GET',
            headers: options.headers,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
            return res;
        }

        if (res.status === 429) {
            if (retry >= MAX_RETRIES) {
                throw new Error(`Hepsiburada rate limit aşıldı — ${MAX_RETRIES} deneme sonrası başarısız`);
            }
            const resetSeconds = parseInt(res.headers.get('X-RateLimit-Reset') || '10', 10);
            console.log(`[hepsiburada-api] 429 rate limit, ${resetSeconds}s bekleniyor (retry ${retry + 1}/${MAX_RETRIES})`);
            await sleep(resetSeconds * 1000);
            return hbFetch(url, options, retry + 1);
        }

        if (res.status >= 500) {
            if (retry >= MAX_RETRIES) {
                throw new Error(`Hepsiburada sunucu hatası HTTP ${res.status} — ${MAX_RETRIES} deneme sonrası başarısız`);
            }
            const backoff = 1000 * Math.pow(2, retry);
            console.log(`[hepsiburada-api] HTTP ${res.status}, retry ${retry + 1}/${MAX_RETRIES} after ${backoff}ms`);
            await sleep(backoff);
            return hbFetch(url, options, retry + 1);
        }

        return res;
    } catch (err: any) {
        if (err?.message?.includes('rate limit') || err?.message?.includes('sunucu hatası')) {
            throw err;
        }
        if (retry >= MAX_RETRIES) {
            throw err;
        }
        const backoff = 1000 * Math.pow(2, retry);
        console.log(`[hepsiburada-api] Network error, retry ${retry + 1}/${MAX_RETRIES} after ${backoff}ms`);
        await sleep(backoff);
        return hbFetch(url, options, retry + 1);
    }
}

// ─── Error Messages ─────────────────────────────────────────

const HB_ERROR_MESSAGES: Record<number, string> = {
    400: 'Gönderilen bilgiler hatalı. Merchant ID ve kimlik bilgilerini kontrol edin.',
    401: 'Kimlik bilgileri hatalı. Hepsiburada kullanıcı adı ve şifresini kontrol edin.',
    403: 'Erişim reddedildi. Merchant ID doğruluğunu kontrol edin.',
    404: 'Merchant ID ile eşleşen mağaza bulunamadı.',
    429: 'Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.',
    500: 'Hepsiburada sisteminde geçici bir sorun var. Birkaç dakika sonra tekrar deneyin.',
};

function getHbErrorMessage(status: number): string {
    return HB_ERROR_MESSAGES[status] ?? `Hepsiburada hatası (HTTP ${status})`;
}

// ─── Test Connection ──────────────────────────────────────────

export async function testConnection(
    creds: HepsiburadaCredentials
): Promise<{ success: boolean; message: string; storeName?: string }> {
    if (isMockMode(creds)) {
        return {
            success: true,
            message: 'Bağlantı başarılı. (Test Modu)',
            storeName: 'Hepsiburada Test Mağazası',
        };
    }

    try {
        const url = `${HB_OMS}/orders/merchantid/${creds.merchantId}?offset=0&limit=1`;
        const headers = buildHeaders(creds);
        const res = await hbFetch(url, { headers });

        if (res.ok) {
            return { success: true, message: 'Bağlantı başarılı' };
        }

        if (res.status === 401) {
            return { success: false, message: 'Kimlik bilgileri hatalı' };
        }

        return { success: false, message: `HTTP ${res.status}` };
    } catch (err: any) {
        return { success: false, message: `Bağlantı hatası: ${err?.message || 'Bilinmeyen hata'}` };
    }
}

// ─── Products ────────────────────────────────────────────────

export interface HepsiburadaProductPage {
    content: any[];
    totalElements: number;
    totalPages: number;
    page: number;
    size: number;
}

/**
 * Tek sayfa ürün çeker (backward compat — sync-products route kullanıyor).
 */
export async function fetchProducts(
    creds: HepsiburadaCredentials,
    page = 0,
    size = 100
): Promise<HepsiburadaProductPage> {
    if (isMockMode(creds)) {
        return {
            content: MOCK_PRODUCTS,
            totalElements: MOCK_PRODUCTS.length,
            totalPages: 1,
            page: 0,
            size,
        };
    }

    const offset = page * size;
    const url = `${HB_LIST}/listings/merchantid/${creds.merchantId}?offset=${offset}&limit=${size}`;
    const headers = buildHeaders(creds);
    const res = await hbFetch(url, { headers });

    if (!res.ok) throw new Error(getHbErrorMessage(res.status));

    const data = await res.json();
    const items: any[] = data?.listings || data?.items || data || [];

    return {
        content: items.map(mapProduct),
        totalElements: items.length < size ? offset + items.length : offset + size + 1,
        totalPages: items.length < size ? page + 1 : page + 2,
        page,
        size,
    };
}

/**
 * Tüm ürünleri çeker — offset pagination, 100'er 100'er.
 * Max güvenlik sınırı: 50 sayfa (5000 ürün).
 */
export async function fetchAllProducts(
    creds: HepsiburadaCredentials
): Promise<{ items: any[]; totalCount: number }> {
    if (isMockMode(creds)) {
        return { items: MOCK_PRODUCTS, totalCount: MOCK_PRODUCTS.length };
    }

    const headers = buildHeaders(creds);
    const allItems: any[] = [];
    const PAGE_SIZE = 100;
    const MAX_PAGES = 50;

    for (let page = 0; page < MAX_PAGES; page++) {
        const offset = page * PAGE_SIZE;
        const url = `${HB_LIST}/listings/merchantid/${creds.merchantId}?offset=${offset}&limit=${PAGE_SIZE}`;
        const res = await hbFetch(url, { headers });

        if (!res.ok) throw new Error(getHbErrorMessage(res.status));

        const data = await res.json();
        const items: any[] = data?.listings || data?.items || data || [];
        allItems.push(...items.map(mapProduct));

        if (items.length < PAGE_SIZE) break;
    }

    return { items: allItems, totalCount: allItems.length };
}

function mapProduct(raw: any): any {
    return {
        merchantSku: raw.merchantSku,
        hepsiburadaSku: raw.hepsiburadaSku,
        urunAdi: raw.productName,
        fiyat: raw.price,
        stok: raw.availableStock,
        ...raw,
    };
}

// ─── Orders ──────────────────────────────────────────────────

export interface HepsiburadaOrderPage {
    content: any[];
    totalElements: number;
    totalPages: number;
    page: number;
    size: number;
}

/**
 * Tek sayfa sipariş çeker (backward compat — sync-orders route kullanıyor).
 */
export async function fetchOrders(
    creds: HepsiburadaCredentials,
    startDate: number,
    endDate: number,
    page = 0,
    size = 100
): Promise<HepsiburadaOrderPage> {
    if (isMockMode(creds)) {
        return {
            content: MOCK_ORDERS,
            totalElements: MOCK_ORDERS.length,
            totalPages: 1,
            page: 0,
            size,
        };
    }

    const offset = page * size;
    const start = formatHbDate(new Date(startDate));
    const end = formatHbDate(new Date(endDate));
    const url = `${HB_OMS}/orders/merchantid/${creds.merchantId}?offset=${offset}&limit=${size}&begindate=${encodeURIComponent(start)}&enddate=${encodeURIComponent(end)}`;
    const headers = buildHeaders(creds);
    const res = await hbFetch(url, { headers });

    if (!res.ok) throw new Error(getHbErrorMessage(res.status));

    const data = await res.json();
    const orders: any[] = data?.data || data?.orders || data?.content || [];

    return {
        content: orders.map(mapOrder),
        totalElements: orders.length < size ? offset + orders.length : offset + size + 1,
        totalPages: orders.length < size ? page + 1 : page + 2,
        page,
        size,
    };
}

/**
 * Tüm siparişleri çeker — 30 günlük pencereler + offset pagination.
 * Max offset güvenlik sınırı: 5000.
 */
export async function fetchAllOrders(
    creds: HepsiburadaCredentials,
    startDate: Date,
    endDate: Date,
    status?: string
): Promise<any[]> {
    if (isMockMode(creds)) return MOCK_ORDERS;

    const headers = buildHeaders(creds);
    const allOrders: any[] = [];
    const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün
    const PAGE_SIZE = 100;
    const MAX_OFFSET = 5000;

    let windowStart = startDate.getTime();
    const finalEnd = endDate.getTime();

    while (windowStart < finalEnd) {
        const windowEnd = Math.min(windowStart + WINDOW_MS, finalEnd);
        const beginStr = formatHbDate(new Date(windowStart));
        const endStr = formatHbDate(new Date(windowEnd));

        let offset = 0;
        while (offset < MAX_OFFSET) {
            let url = `${HB_OMS}/orders/merchantid/${creds.merchantId}?offset=${offset}&limit=${PAGE_SIZE}&begindate=${encodeURIComponent(beginStr)}&enddate=${encodeURIComponent(endStr)}`;
            if (status) {
                url += `&status=${encodeURIComponent(status)}`;
            }

            const res = await hbFetch(url, { headers });
            if (!res.ok) throw new Error(getHbErrorMessage(res.status));

            const data = await res.json();
            const orders: any[] = data?.data || data?.orders || data?.content || [];
            allOrders.push(...orders.map(mapOrder));

            if (orders.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }

        windowStart = windowEnd;
    }

    return allOrders;
}

function mapOrder(raw: any): any {
    const lineItems = (raw.lineItems || raw.lines || []).map((li: any) => ({
        hepsiburadaSku: li.sku,
        birimFiyat: li.price?.amount ?? li.unitPrice ?? 0,
        adet: li.quantity ?? 1,
        toplamFiyat: li.totalPrice?.amount ?? li.totalAmount ?? 0,
        ...li,
    }));

    return {
        siparisNo: raw.orderNumber,
        siparisTarihi: raw.orderDate,
        musteriAdi: raw.customer?.name ?? '',
        lineItems,
        ...raw,
    };
}

// ─── Finance Records ─────────────────────────────────────────

/**
 * Finans kayıtlarını çeker — 30 günlük pencereler + offset pagination.
 */
export async function getFinanceRecords(
    creds: HepsiburadaCredentials,
    startDate: Date,
    endDate: Date,
    types = 'Payment,Commission,Return'
): Promise<{ records: any[]; toplamlar: { toplamGelir: number; toplamGider: number; toplamKomisyon: number; toplamIade: number } }> {
    if (isMockMode(creds)) {
        return {
            records: MOCK_FINANCE_RECORDS,
            toplamlar: { toplamGelir: 6969.18, toplamGider: 627.3, toplamKomisyon: 627.3, toplamIade: 0 },
        };
    }

    const headers = buildHeaders(creds);
    const allRecords: any[] = [];
    const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
    const PAGE_SIZE = 100;

    let windowStart = startDate.getTime();
    const finalEnd = endDate.getTime();

    while (windowStart < finalEnd) {
        const windowEnd = Math.min(windowStart + WINDOW_MS, finalEnd);
        const beginStr = formatFinDate(new Date(windowStart));
        const endStr = formatFinDate(new Date(windowEnd));

        let offset = 0;
        while (true) {
            const url =
                `${HB_FIN}/invoices/merchantid/${creds.merchantId}/transactiontype/${encodeURIComponent(types)}` +
                `?startDate=${encodeURIComponent(beginStr)}&endDate=${encodeURIComponent(endStr)}` +
                `&useInvoiceDate=false&offset=${offset}&limit=${PAGE_SIZE}`;

            const res = await hbFetch(url, { headers });
            if (!res.ok) throw new Error(getHbErrorMessage(res.status));

            const data = await res.json();
            const items: any[] = data?.data || data?.invoices || data || [];
            allRecords.push(...items.map(mapFinanceRecord));

            if (items.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }

        windowStart = windowEnd;
    }

    const toplamGelir = allRecords
        .filter(r => r.gelirMi)
        .reduce((sum, r) => sum + r.netTutar, 0);

    const toplamGider = allRecords
        .filter(r => !r.gelirMi)
        .reduce((sum, r) => sum + r.netTutar, 0);

    const toplamKomisyon = allRecords
        .filter(r => (r.aciklama || '').toLowerCase().includes('kom'))
        .reduce((sum, r) => sum + r.netTutar, 0);

    const toplamIade = allRecords
        .filter(r => {
            const desc = (r.aciklama || '').toUpperCase();
            return desc.includes('İADE') || desc.includes('IADE');
        })
        .reduce((sum, r) => sum + r.netTutar, 0);

    return {
        records: allRecords,
        toplamlar: { toplamGelir, toplamGider, toplamKomisyon, toplamIade },
    };
}

function mapFinanceRecord(raw: any): any {
    const parseAmount = (val: any): number => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return parseFloat(val.replace(',', '.')) || 0;
        return 0;
    };

    return {
        hepsiburadaSku: raw.sku,
        paketNo: raw.packageNumber,
        siparisNo: raw.orderNumber,
        toplamTutar: parseAmount(raw.totalAmount),
        vergiTutari: parseAmount(raw.taxAmount),
        netTutar: parseAmount(raw.netAmount),
        aciklama: raw.invoiceExplanation,
        gelirMi: raw.isIncome,
        faturaMi: raw.isInvoice,
        ...raw,
    };
}

// ─── Claims (İade Talepleri) ─────────────────────────────────

/**
 * İade taleplerini çeker — offset pagination.
 */
export async function getClaims(
    creds: HepsiburadaCredentials,
    startDate: Date,
    endDate: Date
): Promise<{ iadeListesi: any[]; ozet: { toplamTalep: number; toplamIadeTutari: number; tipDagilimi: Record<string, number> } }> {
    if (isMockMode(creds)) {
        return {
            iadeListesi: MOCK_CLAIMS,
            ozet: {
                toplamTalep: 1,
                toplamIadeTutari: 8499,
                tipDagilimi: { Return: 1 },
            },
        };
    }

    const headers = buildHeaders(creds);
    const allClaims: any[] = [];
    const PAGE_SIZE = 100;
    const beginStr = formatHbDate(startDate);
    const endStr = formatHbDate(endDate);

    let offset = 0;
    while (true) {
        const url =
            `${HB_OMS}/claims/merchantid/${creds.merchantId}` +
            `?offset=${offset}&limit=${PAGE_SIZE}` +
            `&begindate=${encodeURIComponent(beginStr)}&enddate=${encodeURIComponent(endStr)}`;

        const res = await hbFetch(url, { headers });
        if (!res.ok) throw new Error(getHbErrorMessage(res.status));

        const data = await res.json();
        const items: any[] = data?.data || data?.claims || data || [];
        allClaims.push(...items.map(mapClaim));

        if (items.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
    }

    const tipDagilimi: Record<string, number> = {};
    let toplamIadeTutari = 0;

    for (const claim of allClaims) {
        const tip = claim.talepTipi || 'Bilinmeyen';
        tipDagilimi[tip] = (tipDagilimi[tip] || 0) + 1;
        toplamIadeTutari += (claim.birimFiyat || 0) * (claim.adet || 1);
    }

    return {
        iadeListesi: allClaims,
        ozet: {
            toplamTalep: allClaims.length,
            toplamIadeTutari,
            tipDagilimi,
        },
    };
}

function mapClaim(raw: any): any {
    return {
        talepId: raw.claimId,
        siparisNo: raw.orderNumber,
        hepsiburadaSku: raw.sku,
        talepTipi: raw.claimType,
        talepDurumu: raw.claimStatus,
        talepNedeni: raw.claimReason,
        adet: raw.quantity ?? 1,
        talepTarihi: raw.claimDate,
        birimFiyat: raw.price?.amount ?? raw.unitPrice ?? 0,
        ...raw,
    };
}

// ─── Backward Compat Exports ─────────────────────────────────

export interface HBCommissionRate {
    categoryId: number;
    categoryName: string;
    commissionRate: number;
}

export async function getCommissionRates(
    creds: HepsiburadaCredentials,
    _categoryId?: number
): Promise<HBCommissionRate[]> {
    if (isMockMode(creds)) {
        return [
            { categoryId: 1, categoryName: 'Elektronik', commissionRate: 9 },
            { categoryId: 2, categoryName: 'Spor', commissionRate: 11 },
            { categoryId: 3, categoryName: 'Ev & Yaşam', commissionRate: 13 },
            { categoryId: 4, categoryName: 'Giyim', commissionRate: 16 },
        ];
    }

    return [];
}

export async function getProductBySku(
    creds: HepsiburadaCredentials,
    sku: string
): Promise<any | null> {
    if (isMockMode(creds)) {
        return MOCK_PRODUCTS.find(p => p.merchantSku === sku) ?? null;
    }

    const url = `${HB_LIST}/listings/merchantid/${creds.merchantId}?offset=0&limit=1&merchantSku=${encodeURIComponent(sku)}`;
    const headers = buildHeaders(creds);
    const res = await hbFetch(url, { headers });

    if (!res.ok) throw new Error(getHbErrorMessage(res.status));

    const data = await res.json();
    const items: any[] = data?.listings || data?.items || data || [];
    return items[0] ? mapProduct(items[0]) : null;
}

export async function getOrderDetail(
    creds: HepsiburadaCredentials,
    orderId: string
): Promise<any | null> {
    if (isMockMode(creds)) {
        return MOCK_ORDERS.find(o => o.siparisNo === orderId) ?? null;
    }

    const url = `${HB_OMS}/orders/merchantid/${creds.merchantId}?offset=0&limit=1&orderNumber=${encodeURIComponent(orderId)}`;
    const headers = buildHeaders(creds);
    const res = await hbFetch(url, { headers });

    if (!res.ok) throw new Error(getHbErrorMessage(res.status));

    const data = await res.json();
    const orders: any[] = data?.data || data?.orders || data?.content || [];
    return orders[0] ? mapOrder(orders[0]) : null;
}
