/**
 * Marketplace Normalizer — Server-only
 * 
 * Maps Trendyol raw data → Kârnet analyses table.
 * Does NOT touch calculation formulas — only fills input fields.
 */

import { getSupabaseAdmin } from '@/lib/supabase-server-client';

type Admin = ReturnType<typeof getSupabaseAdmin>;

/**
 * Normalize Trendyol products into Kârnet analyses + product_marketplace_map.
 * Matching priority: barcode → merchant_sku → product_name → new entry
 */
export async function normalizeProducts(userId: string, connectionId: string): Promise<{ matched: number; created: number; manual: number }> {
    const admin = getSupabaseAdmin();
    let matched = 0, created = 0, manual = 0;

    // 1. Fetch all raw Trendyol products for this connection
    const { data: rawProducts } = await admin
        .from('trendyol_products_raw')
        .select('*')
        .eq('connection_id', connectionId)
        .eq('user_id', userId);

    if (!rawProducts || rawProducts.length === 0) return { matched, created, manual };

    // 2. Fetch existing analyses for this user (for matching)
    const { data: existingAnalyses } = await admin
        .from('analyses')
        .select('id, product_name, inputs, barcode, merchant_sku')
        .eq('user_id', userId);

    const analyses = existingAnalyses || [];

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
        const barcode = raw.barcode?.trim() || '';
        const sku = raw.merchant_sku?.trim() || '';
        const title = raw.title?.trim() || 'İsimsiz Ürün';
        const salePrice = raw.sale_price ?? 0;

        // Try matching
        let internalId: string | null = null;
        let confidence: 'high' | 'medium' | 'manual_required' = 'manual_required';

        if (barcode && barcodeMap.has(barcode.toLowerCase())) {
            internalId = barcodeMap.get(barcode.toLowerCase())!;
            confidence = 'high';
        } else if (sku && skuMap.has(sku.toLowerCase())) {
            internalId = skuMap.get(sku.toLowerCase())!;
            confidence = 'high';
        } else if (nameMap.has(title.toLowerCase())) {
            internalId = nameMap.get(title.toLowerCase())!;
            confidence = 'medium';
        }

        if (internalId) {
            // Update the existing analysis with Trendyol data
            await updateAnalysisFromTrendyol(admin, internalId, raw, salePrice);
            matched++;
        } else {
            // Create a new analysis entry
            internalId = await createAnalysisFromTrendyol(admin, userId, raw, salePrice);
            if (internalId) {
                created++;
                confidence = 'manual_required'; // cost unknown, user must fill
            } else {
                manual++;
            }
        }

        // Upsert mapping
        await admin
            .from('product_marketplace_map')
            .upsert(
                {
                    user_id: userId,
                    marketplace: 'trendyol',
                    connection_id: connectionId,
                    external_product_id: externalId,
                    merchant_sku: sku || null,
                    barcode: barcode || null,
                    external_title: title,
                    internal_product_id: internalId,
                    match_confidence: confidence,
                },
                { onConflict: 'user_id,marketplace,external_product_id' }
            );
    }

    return { matched, created, manual };
}

async function updateAnalysisFromTrendyol(admin: Admin, analysisId: string, raw: any, salePrice: number) {
    // Fetch current inputs
    const { data: analysis } = await admin
        .from('analyses')
        .select('inputs')
        .eq('id', analysisId)
        .single();

    if (!analysis) return;

    const inputs = (analysis.inputs || {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    // Only update sale_price if current one is 0 or not set
    if (salePrice > 0 && (!inputs.sale_price || inputs.sale_price === 0)) {
        updates['inputs'] = { ...inputs, sale_price: salePrice };
    }

    await admin
        .from('analyses')
        .update({
            barcode: raw.barcode || undefined,
            merchant_sku: raw.merchant_sku || undefined,
            marketplace_source: 'trendyol',
            auto_synced: true,
            ...updates,
        })
        .eq('id', analysisId);
}

async function createAnalysisFromTrendyol(admin: Admin, userId: string, raw: any, salePrice: number): Promise<string | null> {
    const inputs = {
        marketplace: 'trendyol',
        product_name: raw.title || 'İsimsiz Ürün',
        sale_price: salePrice || 0,
        monthly_sales_volume: 0,
        product_cost: 0,
        commission_pct: 21, // Trendyol default
        shipping_cost: 0,
        packaging_cost: 0,
        ad_cost_per_sale: 0,
        return_rate_pct: 3,
        vat_pct: 20,
        other_cost: 0,
        payout_delay_days: 14,
    };

    const outputs = {
        commission_amount: 0,
        vat_amount: 0,
        expected_return_loss: 0,
        unit_variable_cost: 0,
        unit_total_cost: 0,
        unit_net_profit: 0,
        margin_pct: 0,
        monthly_net_profit: 0,
        monthly_revenue: 0,
        monthly_total_cost: 0,
        breakeven_price: 0,
        sale_price: salePrice,
        sale_price_excl_vat: 0,
        output_vat_monthly: 0,
        input_vat_monthly: 0,
        vat_position_monthly: 0,
        monthly_net_sales: 0,
    };

    const { data, error } = await admin
        .from('analyses')
        .insert({
            user_id: userId,
            marketplace: 'trendyol',
            product_name: raw.title || 'İsimsiz Ürün',
            inputs,
            outputs,
            risk_score: 50,
            risk_level: 'moderate',
            barcode: raw.barcode || null,
            merchant_sku: raw.merchant_sku || null,
            marketplace_source: 'trendyol',
            auto_synced: true,
        })
        .select('id')
        .single();

    if (error || !data) {
        console.error('[normalizer] createAnalysis error:', error?.message);
        return null;
    }
    return data.id;
}

/**
 * Normalize Trendyol orders → product_sales_metrics (monthly aggregation)
 * + auto_sales_qty suggestion on analyses.
 * 
 * Handles returns/cancels by checking order status.
 * Does NOT override user-set monthly_sales_volume.
 */

const RETURN_STATUSES = new Set(['Cancelled', 'Returned', 'ReturnAccepted', 'ReturnedAndRefunded', 'UnDelivered']);
const SOLD_STATUSES = new Set(['Created', 'Picking', 'Shipped', 'Delivered', 'InvoiceWaiting']);

interface OrderMetricsResult {
    metricsUpdated: number;
    unmatchedOrders: number;
    monthsCovered: number;
    currentMonthSales: number;
}

export async function normalizeOrderMetrics(
    userId: string,
    connectionId: string
): Promise<OrderMetricsResult> {
    const admin = getSupabaseAdmin();
    let metricsUpdated = 0;
    let unmatchedOrders = 0;
    const monthsSet = new Set<string>();
    let currentMonthSales = 0;

    // 1. Get all mappings for this user
    const { data: mappings } = await admin
        .from('product_marketplace_map')
        .select('external_product_id, internal_product_id')
        .eq('user_id', userId)
        .eq('marketplace', 'trendyol')
        .not('internal_product_id', 'is', null);

    const mapLookup = new Map<string, string>();
    for (const m of mappings || []) {
        if (m.internal_product_id) {
            mapLookup.set(m.external_product_id, m.internal_product_id);
        }
    }

    // 2. Fetch all raw orders
    const { data: orders } = await admin
        .from('trendyol_orders_raw')
        .select('order_number, order_date, status, raw_json')
        .eq('connection_id', connectionId)
        .eq('user_id', userId);

    if (!orders || orders.length === 0) {
        return { metricsUpdated: 0, unmatchedOrders: 0, monthsCovered: 0, currentMonthSales: 0 };
    }

    // 3. Aggregate by (internal_product_id, month)
    type MonthKey = string; // "product_id|YYYY-MM-01"
    const agg = new Map<MonthKey, { sold: number; returned: number; grossRev: number; netRev: number; productId: string; month: string }>();

    for (const order of orders) {
        const raw = order.raw_json;
        const lines = raw?.lines || raw?.orderItems || [];
        const orderStatus = (order.status || raw?.status || '').trim();
        const isReturn = RETURN_STATUSES.has(orderStatus);

        const orderDate = order.order_date ? new Date(order.order_date) : new Date();
        const monthStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-01`;

        for (const line of lines) {
            const extProductId = String(line.productId || line.id || '');
            const qty = line.quantity || 1;
            const price = line.price || line.amount || 0;
            const lineTotal = price * qty;

            const internalId = mapLookup.get(extProductId);
            if (!internalId) {
                unmatchedOrders++;
                continue;
            }

            const key = `${internalId}|${monthStr}`;
            const existing = agg.get(key) || { sold: 0, returned: 0, grossRev: 0, netRev: 0, productId: internalId, month: monthStr };

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

    // 4. Upsert product_sales_metrics
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const productCurrentSales = new Map<string, number>();

    for (const [, data] of Array.from(agg)) {
        await admin
            .from('product_sales_metrics')
            .upsert(
                {
                    user_id: userId,
                    internal_product_id: data.productId,
                    marketplace: 'trendyol',
                    period_month: data.month,
                    sold_qty: data.sold,
                    returned_qty: data.returned,
                    gross_revenue: data.grossRev,
                    net_revenue: data.netRev,
                },
                { onConflict: 'user_id,internal_product_id,marketplace,period_month' }
            );
        metricsUpdated++;

        // Track current month
        if (data.month === currentMonth) {
            const prev = productCurrentSales.get(data.productId) || 0;
            productCurrentSales.set(data.productId, prev + data.sold - data.returned);
            currentMonthSales += data.sold - data.returned;
        }
    }

    // 5. Update auto_sales_qty on analyses (suggestion only — does not override monthly_sales_volume)
    for (const [productId, netQty] of Array.from(productCurrentSales)) {
        await admin
            .from('analyses')
            .update({ auto_sales_qty: Math.max(0, netQty) })
            .eq('id', productId);
    }

    return {
        metricsUpdated,
        unmatchedOrders,
        monthsCovered: monthsSet.size,
        currentMonthSales,
    };
}
