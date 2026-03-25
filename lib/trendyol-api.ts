/**
 * Trendyol Seller API Client — Server-only
 *
 * Base URL: https://api.trendyol.com/sapigw/suppliers/{supplierId}
 * Auth: Basic (apiKey:apiSecret → base64)
 * User-Agent: {supplierId}-KarnetApp
 * Rate limit: Exponential backoff on 429/5xx (max 3 retries), 10s timeout
 *
 * Mock mode: apiKey === "TRENDYOL_TEST" — gerçek API çağrısı yapılmaz.
 *
 * NEVER log credentials, auth headers, or tokens.
 */

const BASE_URL = 'https://api.trendyol.com/sapigw';
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

// ─── Helpers ─────────────────────────────────────────────────

function isMockMode(creds: TrendyolCredentials): boolean {
    return creds.apiKey === TRENDYOL_TEST_KEY;
}

function buildHeaders(creds: TrendyolCredentials): Record<string, string> {
    const token = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64');
    return {
        'Authorization': `Basic ${token}`,
        'User-Agent': `${creds.sellerId}-KarnetApp`,
        'Content-Type': 'application/json',
    };
}

async function fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(url, {
                headers,
                method: 'GET',
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });

            // Success or non-retryable 4xx → return immediately
            if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
                return res;
            }

            // 429 or 5xx → retry with backoff
            if (res.status === 429 || res.status >= 500) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
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

        return { success: false, message: `Bağlantı hatası: HTTP ${res.status}` };
    } catch (err: any) {
        return { success: false, message: `Bağlantı hatası: ${err?.message || 'Bilinmeyen hata'}` };
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

    if (!res.ok) throw new Error(`Trendyol ürün API hatası: HTTP ${res.status}`);

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

    if (!res.ok) throw new Error(`Trendyol barkod sorgulama hatası: HTTP ${res.status}`);

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

    const url = `${BASE_URL}/suppliers/${creds.sellerId}/orders?startDate=${startDate}&endDate=${endDate}&page=${page}&size=${size}`;
    const headers = buildHeaders(creds);
    const res = await fetchWithRetry(url, headers);

    if (!res.ok) throw new Error(`Trendyol sipariş API hatası: HTTP ${res.status}`);

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

    const url = `${BASE_URL}/suppliers/${creds.sellerId}/orders/${orderId}`;
    const headers = buildHeaders(creds);
    const res = await fetchWithRetry(url, headers);

    if (!res.ok) throw new Error(`Trendyol sipariş detay hatası: HTTP ${res.status}`);
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

    if (!res.ok) throw new Error(`Trendyol komisyon oranları hatası: HTTP ${res.status}`);

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

    if (!res.ok) throw new Error(`Trendyol kargo sağlayıcıları hatası: HTTP ${res.status}`);

    const data = await res.json();
    return data.shipmentProviders || data || [];
}
