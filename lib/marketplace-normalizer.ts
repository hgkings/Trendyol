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
 * Normalize Trendyol orders → update monthly_sales_volume in analyses inputs.
 * Counts orders for each product in the last 30 days.
 */
export async function normalizeOrders(userId: string, connectionId: string): Promise<{ updated: number }> {
    const admin = getSupabaseAdmin();
    let updated = 0;

    // 1. Get all mappings for this user
    const { data: mappings } = await admin
        .from('product_marketplace_map')
        .select('external_product_id, internal_product_id')
        .eq('user_id', userId)
        .eq('marketplace', 'trendyol')
        .not('internal_product_id', 'is', null);

    if (!mappings || mappings.length === 0) return { updated };

    // 2. Get orders from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders } = await admin
        .from('trendyol_orders_raw')
        .select('raw_json')
        .eq('connection_id', connectionId)
        .eq('user_id', userId)
        .gte('order_date', thirtyDaysAgo);

    if (!orders || orders.length === 0) return { updated };

    // 3. Count orders per product (by matching Trendyol product ID in order lines)
    const productSalesCount = new Map<string, number>();

    for (const order of orders) {
        const raw = order.raw_json;
        const lines = raw?.lines || raw?.orderItems || [];
        for (const line of lines) {
            const productId = String(line.productId || line.id || '');
            const qty = line.quantity || 1;
            if (productId) {
                productSalesCount.set(productId, (productSalesCount.get(productId) || 0) + qty);
            }
        }
    }

    // 4. Update analyses with monthly_sales_volume
    for (const mapping of mappings) {
        const salesQty = productSalesCount.get(mapping.external_product_id);
        if (salesQty == null || !mapping.internal_product_id) continue;

        const { data: analysis } = await admin
            .from('analyses')
            .select('inputs')
            .eq('id', mapping.internal_product_id)
            .single();

        if (!analysis) continue;

        const inputs = (analysis.inputs || {}) as Record<string, unknown>;

        // Only update if auto_synced or current value is 0
        const currentVolume = (inputs.monthly_sales_volume as number) || 0;
        if (currentVolume === 0 || true) { // always update from order data
            await admin
                .from('analyses')
                .update({
                    inputs: { ...inputs, monthly_sales_volume: salesQty },
                    auto_synced: true,
                })
                .eq('id', mapping.internal_product_id);
            updated++;
        }
    }

    return { updated };
}
