/**
 * Marketplace Normalizer — Pure transformation utilities, Server-only
 *
 * Maps marketplace raw data → Kârnet analysis/product structures.
 * Supports: trendyol, hepsiburada
 *
 * NO DB calls — data is passed in as parameters.
 * Callers (Logic Services) are responsible for fetching and persisting data.
 */

import { calculateProfit } from '@/utils/calculations'
import type { ProductInput } from '@/types'

// ─── Types ───────────────────────────────────────────────────

export interface RawProduct {
    external_product_id: string;
    barcode?: string;
    merchant_sku?: string;
    title?: string;
    sale_price?: number;
    [key: string]: unknown;
}

export interface ExistingAnalysis {
    id: string;
    product_name?: string;
    barcode?: string;
    merchant_sku?: string;
    inputs?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface NormalizedProductMatch {
    externalId: string;
    internalId: string | null;
    confidence: 'high' | 'medium' | 'manual_required';
    /** Populated when internalId is null — ready to insert into analyses */
    newAnalysis?: NewAnalysisPayload;
    /** Ready to upsert into product_marketplace_map */
    mapEntry: ProductMapEntry;
    /** When internalId exists — fields to update on the existing analysis */
    analysisUpdate?: AnalysisUpdate;
}

export interface NewAnalysisPayload {
    marketplace: string;
    product_name: string;
    barcode: string | null;
    merchant_sku: string | null;
    marketplace_source: string;
    auto_synced: true;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    risk_score: number;
    risk_level: string;
}

export interface AnalysisUpdate {
    analysisId: string;
    barcode?: string;
    merchant_sku?: string;
    marketplace_source: string;
    auto_synced: true;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
}

export interface ProductMapEntry {
    marketplace: string;
    external_product_id: string;
    merchant_sku: string | null;
    barcode: string | null;
    external_title: string;
    internal_product_id: string | null;
    match_confidence: 'high' | 'medium' | 'manual_required';
}

export interface NormalizeProductsResult {
    matched: number;
    created: number;
    manual: number;
    /** Detailed per-product results for the caller to persist */
    results: NormalizedProductMatch[];
}

export interface RawOrder {
    order_number?: string;
    order_date?: string;
    status?: string;
    raw_json?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface ProductMapping {
    external_product_id: string;
    internal_product_id: string | null;
}

export interface SalesMetricEntry {
    internal_product_id: string;
    marketplace: string;
    period_month: string;
    sold_qty: number;
    returned_qty: number;
    gross_revenue: number;
    net_revenue: number;
}

export interface AutoSalesQtyUpdate {
    productId: string;
    netQty: number;
}

export interface NormalizeOrderMetricsResult {
    metricsUpdated: number;
    unmatchedOrders: number;
    monthsCovered: number;
    currentMonthSales: number;
    /** Ready to upsert into product_sales_metrics */
    metrics: SalesMetricEntry[];
    /** Ready to update auto_sales_qty on analyses */
    autoSalesUpdates: AutoSalesQtyUpdate[];
}

// ─── Constants ───────────────────────────────────────────────

/**
 * İade/iptal sayılan durumlar — Trendyol resmi dokümanı
 * Bu statülerde satış eksiltilir, iade tutarı hesaplanır.
 */
const RETURN_STATUSES = new Set([
    'Cancelled',
    'Returned',
    'ReturnAccepted',
    'ReturnedAndRefunded',
    'UnDelivered',
    'UnSupplied',
]);

/**
 * Satış sayılan durumlar — Trendyol resmi dokümanı
 * NOT: 'Awaiting' dahil DEĞİLDİR — bu durumdaki siparişler işlenmemelidir.
 */
const SOLD_STATUSES = new Set([
    'Created',
    'Picking',
    'Invoiced',
    'Shipped',
    'Delivered',
    'AtCollectionPoint',
]);

/**
 * İşlenmemesi gereken durumlar.
 * Awaiting siparişler henüz kesinleşmemiştir — Created'a geçene kadar beklenmelidir.
 */
const IGNORED_STATUSES = new Set([
    'Awaiting',
    'UnPacked',
]);

/**
 * Marketplace-specific defaults — resmi verilere ve sektör ortalamalarına dayalı.
 * NOT: Trendyol komisyon oranı kategoriye göre değişir (%5-%35).
 * Bu değerler başlangıç tahmini — sipariş verilerinden gerçek oran çıkarılmalıdır.
 */
export function marketplaceDefaults(marketplace: string): {
    commission_pct: number;
    payout_delay_days: number;
    return_rate_pct: number;
} {
    switch (marketplace) {
        case 'trendyol':
            return { commission_pct: 18, payout_delay_days: 28, return_rate_pct: 12 };
        case 'hepsiburada':
            return { commission_pct: 20, payout_delay_days: 30, return_rate_pct: 12 };
        case 'n11':
            return { commission_pct: 16, payout_delay_days: 21, return_rate_pct: 10 };
        case 'amazon_tr':
            return { commission_pct: 17, payout_delay_days: 14, return_rate_pct: 13 };
        default:
            return { commission_pct: 15, payout_delay_days: 30, return_rate_pct: 10 };
    }
}

// ─── Product normalizer ───────────────────────────────────────

/**
 * Pure transformation: matches rawProducts against existingAnalyses
 * and returns structured results for the caller to persist.
 *
 * Matching priority: barcode → merchant_sku → product_name → new entry
 *
 * @param rawProducts   Raw product rows fetched by the caller
 * @param analyses      Existing analyses for the user fetched by the caller
 * @param marketplace   'trendyol' | 'hepsiburada'
 */
export function normalizeProducts(
    rawProducts: RawProduct[],
    analyses: ExistingAnalysis[],
    marketplace = 'trendyol'
): NormalizeProductsResult {
    let matched = 0;
    let created = 0;
    let manual = 0;
    const results: NormalizedProductMatch[] = [];

    // Build lookup maps
    const barcodeMap = new Map<string, string>();
    const skuMap = new Map<string, string>();
    const nameMap = new Map<string, string>();

    for (const a of analyses) {
        if (a.barcode) barcodeMap.set(a.barcode.toLowerCase(), a.id);
        if (a.merchant_sku) skuMap.set(a.merchant_sku.toLowerCase(), a.id);
        if (a.product_name) nameMap.set(a.product_name.toLowerCase().trim(), a.id);
    }

    for (const raw of rawProducts) {
        const externalId = raw.external_product_id;
        const barcode = raw.barcode?.trim() ?? '';
        const sku = raw.merchant_sku?.trim() ?? '';
        const title = raw.title?.trim() ?? 'İsimsiz Ürün';
        const salePrice = raw.sale_price ?? 0;

        let internalId: string | null = null;
        let confidence: 'high' | 'medium' | 'manual_required' = 'manual_required';

        if (barcode && barcodeMap.has(barcode.toLowerCase())) {
            internalId = barcodeMap.get(barcode.toLowerCase()) ?? null;
            confidence = 'high';
        } else if (sku && skuMap.has(sku.toLowerCase())) {
            internalId = skuMap.get(sku.toLowerCase()) ?? null;
            confidence = 'high';
        } else if (nameMap.has(title.toLowerCase())) {
            internalId = nameMap.get(title.toLowerCase()) ?? null;
            confidence = 'medium';
        }

        const mapEntry: ProductMapEntry = {
            marketplace,
            external_product_id: externalId,
            merchant_sku: sku || null,
            barcode: barcode || null,
            external_title: title,
            internal_product_id: internalId,
            match_confidence: confidence,
        };

        const result: NormalizedProductMatch = {
            externalId,
            internalId,
            confidence,
            mapEntry,
        };

        if (internalId) {
            const existingAnalysis = analyses.find(a => a.id === internalId);
            const existingInputs = (existingAnalysis?.inputs ?? {}) as Record<string, unknown>;
            const analysisUpdate: AnalysisUpdate = {
                analysisId: internalId,
                barcode: raw.barcode ?? undefined,
                merchant_sku: raw.merchant_sku ?? undefined,
                marketplace_source: marketplace,
                auto_synced: true,
            };

            // Stok, görsel ve satış fiyatı her sync'te güncelle
            const qty = typeof raw.quantity === 'number' ? raw.quantity : 0;
            if (qty >= 0) existingInputs.stock_quantity = qty;
            if (typeof raw.image_url === 'string' && raw.image_url) existingInputs.image_url = raw.image_url;
            if (salePrice > 0) existingInputs.sale_price = salePrice;

            analysisUpdate.inputs = { ...existingInputs };

            // Outputs'u yeniden hesapla (sıfır kalmasın)
            const recalcInput: ProductInput = {
                marketplace: (existingInputs.marketplace ?? marketplace) as ProductInput['marketplace'],
                product_name: (existingInputs.product_name ?? title) as string,
                sale_price: Number(existingInputs.sale_price ?? salePrice) || 0,
                product_cost: Number(existingInputs.product_cost ?? 0),
                commission_pct: Number(existingInputs.commission_pct ?? marketplaceDefaults(marketplace).commission_pct),
                shipping_cost: Number(existingInputs.shipping_cost ?? 0),
                packaging_cost: Number(existingInputs.packaging_cost ?? 0),
                ad_cost_per_sale: Number(existingInputs.ad_cost_per_sale ?? 0),
                return_rate_pct: Number(existingInputs.return_rate_pct ?? marketplaceDefaults(marketplace).return_rate_pct),
                vat_pct: Number(existingInputs.vat_pct ?? 20),
                other_cost: Number(existingInputs.other_cost ?? 0),
                monthly_sales_volume: Number(existingInputs.monthly_sales_volume ?? 0),
                payout_delay_days: Number(existingInputs.payout_delay_days ?? marketplaceDefaults(marketplace).payout_delay_days),
            }
            analysisUpdate.outputs = calculateProfit(recalcInput) as unknown as Record<string, unknown>

            result.analysisUpdate = analysisUpdate;
            matched++;
        } else {
            // Build new analysis payload — caller will insert and get the new id
            const defaults = marketplaceDefaults(marketplace);
            result.newAnalysis = {
                marketplace,
                product_name: title,
                barcode: barcode || null,
                merchant_sku: sku || null,
                marketplace_source: marketplace,
                auto_synced: true,
                inputs: {
                    marketplace,
                    product_name: title,
                    sale_price: salePrice,
                    monthly_sales_volume: 0,
                    product_cost: 0,
                    commission_pct: defaults.commission_pct,
                    shipping_cost: 0,
                    packaging_cost: 0,
                    ad_cost_per_sale: 0,
                    return_rate_pct: defaults.return_rate_pct,
                    vat_pct: 20,
                    other_cost: 0,
                    payout_delay_days: defaults.payout_delay_days,
                    stock_quantity: typeof raw.quantity === 'number' ? raw.quantity : 0,
                    image_url: typeof raw.image_url === 'string' ? raw.image_url : undefined,
                },
                outputs: (() => {
                    // Gerçek hesaplama yap — outputs sıfır olmasın
                    const calcInput: ProductInput = {
                        marketplace: marketplace as ProductInput['marketplace'],
                        product_name: title,
                        sale_price: salePrice,
                        product_cost: 0,
                        commission_pct: defaults.commission_pct,
                        shipping_cost: 0,
                        packaging_cost: 0,
                        ad_cost_per_sale: 0,
                        return_rate_pct: defaults.return_rate_pct,
                        vat_pct: 20,
                        other_cost: 0,
                        monthly_sales_volume: 0,
                        payout_delay_days: defaults.payout_delay_days,
                    }
                    const calc = calculateProfit(calcInput)
                    return { ...calc, sale_price: salePrice }
                })(),
                risk_score: 50,
                risk_level: 'moderate',
            };
            // When no match and no new analysis could be prepared, mark manual
            if (!result.newAnalysis.product_name) {
                manual++;
            } else {
                created++;
                confidence = 'manual_required'; // cost unknown, user must fill
            }
        }

        results.push(result);
    }

    return { matched, created, manual, results };
}

// ─── Order metrics normalizer ─────────────────────────────────

/**
 * Pure transformation: aggregates rawOrders into monthly sales metrics.
 * Returns structured data for the caller to persist.
 *
 * @param rawOrders    Raw order rows fetched by the caller
 * @param productMap   Mapping rows (external_product_id → internal_product_id) fetched by the caller
 * @param marketplace  'trendyol' | 'hepsiburada'
 */
export function normalizeOrderMetrics(
    rawOrders: RawOrder[],
    productMap: ProductMapping[],
    marketplace = 'trendyol'
): NormalizeOrderMetricsResult {
    if (rawOrders.length === 0) {
        return {
            metricsUpdated: 0,
            unmatchedOrders: 0,
            monthsCovered: 0,
            currentMonthSales: 0,
            metrics: [],
            autoSalesUpdates: [],
        };
    }

    // Build lookup
    const mapLookup = new Map<string, string>();
    for (const m of productMap) {
        if (m.internal_product_id) {
            mapLookup.set(m.external_product_id, m.internal_product_id);
        }
    }

    let unmatchedOrders = 0;
    const monthsSet = new Set<string>();

    type MonthKey = string; // "product_id|YYYY-MM-01"
    const agg = new Map<
        MonthKey,
        { sold: number; returned: number; grossRev: number; netRev: number; productId: string; month: string }
    >();

    for (const order of rawOrders) {
        const raw = order.raw_json ?? {};
        const lines = (raw.lines ?? raw.orderItems ?? []) as Record<string, unknown>[];
        const orderStatus = (
            typeof order.status === 'string'
                ? order.status
                : typeof raw.status === 'string'
                    ? raw.status
                    : ''
        ).trim();

        // Awaiting ve UnPacked siparişleri atla — henüz kesinleşmemiş
        if (IGNORED_STATUSES.has(orderStatus)) continue;

        const isReturn = RETURN_STATUSES.has(orderStatus);

        const orderDate = order.order_date ? new Date(order.order_date) : new Date();
        const monthStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-01`;

        for (const line of lines) {
            const extProductId = String(line.productId ?? line.id ?? '');
            const qty = typeof line.quantity === 'number' ? line.quantity : 1;
            const price = typeof line.price === 'number' ? line.price : typeof line.amount === 'number' ? line.amount : 0;
            const lineTotal = price * qty;

            const internalId = mapLookup.get(extProductId);
            if (!internalId) {
                unmatchedOrders++;
                continue;
            }

            const key = `${internalId}|${monthStr}`;
            const existing = agg.get(key) ?? {
                sold: 0,
                returned: 0,
                grossRev: 0,
                netRev: 0,
                productId: internalId,
                month: monthStr,
            };

            if (isReturn) {
                existing.returned += qty;
                existing.netRev -= lineTotal;
            } else {
                existing.sold += qty;
                existing.grossRev += lineTotal;
                existing.netRev += lineTotal;
            }

            agg.set(key, existing);
            monthsSet.add(monthStr);
        }
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const metrics: SalesMetricEntry[] = [];
    const productCurrentSales = new Map<string, number>();
    let currentMonthSales = 0;

    for (const [, data] of Array.from(agg)) {
        metrics.push({
            internal_product_id: data.productId,
            marketplace,
            period_month: data.month,
            sold_qty: data.sold,
            returned_qty: data.returned,
            gross_revenue: data.grossRev,
            net_revenue: data.netRev,
        });

        if (data.month === currentMonth) {
            const prev = productCurrentSales.get(data.productId) ?? 0;
            productCurrentSales.set(data.productId, prev + data.sold - data.returned);
            currentMonthSales += data.sold - data.returned;
        }
    }

    const autoSalesUpdates: AutoSalesQtyUpdate[] = Array.from(productCurrentSales).map(
        ([productId, netQty]) => ({ productId, netQty: Math.max(0, netQty) })
    );

    // SOLD_STATUSES ve IGNORED_STATUSES yukarıda dolaylı olarak kullanılıyor
    void SOLD_STATUSES;
    void IGNORED_STATUSES;

    return {
        metricsUpdated: metrics.length,
        unmatchedOrders,
        monthsCovered: monthsSet.size,
        currentMonthSales,
        metrics,
        autoSalesUpdates,
    };
}