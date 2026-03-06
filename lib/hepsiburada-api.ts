/**
 * Hepsiburada Merchant API Client — Server-only
 * 
 * Base URL: https://mpop-sit.hepsiburada.com/merchants (sandbox)
 *           https://mpop.hepsiburada.com/merchants     (production)
 * Auth: Basic (merchantId:apiKey → base64)
 * Rate limit: Exponential backoff on 429/5xx (max 3 retries)
 * 
 * NEVER log credentials, auth headers, or tokens.
 */

const BASE_URL = 'https://mpop.hepsiburada.com';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export interface HepsiburadaCredentials {
    apiKey: string;
    apiSecret: string;
    merchantId: string;
}

function buildHeaders(creds: HepsiburadaCredentials): Record<string, string> {
    const token = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64');
    return {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
}

async function fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(url, { headers, method: 'GET' });

            if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
                return res;
            }

            if (res.status === 429 || res.status >= 500) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                console.log(`[hepsiburada-api] Status ${res.status}, retry ${attempt + 1}/${MAX_RETRIES} after ${backoff}ms`);
                await sleep(backoff);
                continue;
            }

            return res;
        } catch (err: any) {
            lastError = err;
            if (attempt < MAX_RETRIES) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                console.log(`[hepsiburada-api] Network error, retry ${attempt + 1}/${MAX_RETRIES} after ${backoff}ms`);
                await sleep(backoff);
            }
        }
    }

    throw lastError || new Error('Max retries exceeded');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Test Connection ───
export async function testConnection(creds: HepsiburadaCredentials): Promise<{ success: boolean; message: string }> {
    try {
        const url = `${BASE_URL}/product/api/products/get-all-products?merchantId=${creds.merchantId}&offset=0&limit=1`;
        const headers = buildHeaders(creds);
        const res = await fetchWithRetry(url, headers);

        if (res.ok) {
            const data = await res.json();
            const total = data?.totalCount ?? data?.totalElements ?? '?';
            return {
                success: true,
                message: `Bağlantı başarılı. Toplam ${total} ürün bulundu.`,
            };
        }

        return {
            success: false,
            message: `Bağlantı hatası: HTTP ${res.status}`,
        };
    } catch (err: any) {
        return {
            success: false,
            message: `Bağlantı hatası: ${err?.message || 'Bilinmeyen hata'}`,
        };
    }
}

// ─── Fetch Products (paginated) ───
export interface HepsiburadaProductPage {
    content: any[];
    totalElements: number;
    totalPages: number;
    page: number;
    size: number;
}

export async function fetchProducts(
    creds: HepsiburadaCredentials,
    page = 0,
    size = 50
): Promise<HepsiburadaProductPage> {
    const offset = page * size;
    const url = `${BASE_URL}/product/api/products/get-all-products?merchantId=${creds.merchantId}&offset=${offset}&limit=${size}`;
    const headers = buildHeaders(creds);
    const res = await fetchWithRetry(url, headers);

    if (!res.ok) {
        throw new Error(`Hepsiburada ürün API hatası: HTTP ${res.status}`);
    }

    const data = await res.json();
    const products = data?.products || data?.content || [];
    const total = data?.totalCount || data?.totalElements || 0;
    return {
        content: products,
        totalElements: total,
        totalPages: Math.ceil(total / size),
        page,
        size,
    };
}

// ─── Fetch Orders (paginated) ───
export interface HepsiburadaOrderPage {
    content: any[];
    totalElements: number;
    totalPages: number;
    page: number;
    size: number;
}

export async function fetchOrders(
    creds: HepsiburadaCredentials,
    startDate: number,  // epoch millis
    endDate: number,    // epoch millis
    page = 0,
    size = 50
): Promise<HepsiburadaOrderPage> {
    const offset = page * size;
    const startISO = new Date(startDate).toISOString();
    const endISO = new Date(endDate).toISOString();
    const url = `${BASE_URL}/order/api/orders?merchantId=${creds.merchantId}&offset=${offset}&limit=${size}&beginDate=${startISO}&endDate=${endISO}`;
    const headers = buildHeaders(creds);
    const res = await fetchWithRetry(url, headers);

    if (!res.ok) {
        throw new Error(`Hepsiburada sipariş API hatası: HTTP ${res.status}`);
    }

    const data = await res.json();
    const orders = data?.orders || data?.content || [];
    const total = data?.totalCount || data?.totalElements || 0;
    return {
        content: orders,
        totalElements: total,
        totalPages: Math.ceil(total / size),
        page,
        size,
    };
}
