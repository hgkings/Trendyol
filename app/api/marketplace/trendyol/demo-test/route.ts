import { NextResponse } from 'next/server';
import { createClient, getSupabaseAdmin } from '@/lib/supabase-server-client';

export const dynamic = 'force-dynamic';

// Demo product data — realistic Trendyol-style products
const DEMO_PRODUCTS = [
    { id: 'DEMO-001', title: 'Bluetooth Kulaklık TWS Pro', sku: 'BT-KLK-001', barcode: '8690001000001', brand: 'TechSound', category: 'Elektronik > Kulaklık', salePrice: 349.90 },
    { id: 'DEMO-002', title: 'Telefon Kılıfı Silikon Şeffaf', sku: 'TK-SLK-002', barcode: '8690001000002', brand: 'CasePro', category: 'Telefon Aksesuarları > Kılıf', salePrice: 49.90 },
    { id: 'DEMO-003', title: 'USB-C Hızlı Şarj Kablosu 2m', sku: 'USB-C-003', barcode: '8690001000003', brand: 'CableTech', category: 'Elektronik > Kablo', salePrice: 79.90 },
    { id: 'DEMO-004', title: 'Spor Çanta Duffel 40L', sku: 'SP-CNT-004', barcode: '8690001000004', brand: 'FitBag', category: 'Spor > Çanta', salePrice: 299.90 },
    { id: 'DEMO-005', title: 'LED Masa Lambası Dokunmatik', sku: 'LED-LMP-005', barcode: '8690001000005', brand: 'LightUp', category: 'Ev & Yaşam > Aydınlatma', salePrice: 189.90 },
];

const ORDER_STATUSES = ['Created', 'Picking', 'Shipped', 'Delivered', 'Delivered'];

function generateDemoOrders(): any[] {
    const orders = [];
    const now = Date.now();
    for (let i = 1; i <= 10; i++) {
        const product = DEMO_PRODUCTS[i % DEMO_PRODUCTS.length];
        const daysAgo = Math.floor(Math.random() * 25) + 1;
        const orderDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
        const qty = Math.floor(Math.random() * 3) + 1;
        orders.push({
            orderNumber: `DEMO-ORD-${String(i).padStart(4, '0')}`,
            orderDate: orderDate.toISOString(),
            status: ORDER_STATUSES[i % ORDER_STATUSES.length],
            totalPrice: product.salePrice * qty,
            lines: [
                { productId: product.id, quantity: qty, title: product.title, price: product.salePrice },
            ],
        });
    }
    return orders;
}

export async function POST() {
    try {
        const supabase = createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const admin = getSupabaseAdmin();

        // 1) Upsert connection as demo
        const { data: connection, error: connErr } = await admin
            .from('marketplace_connections')
            .upsert(
                {
                    user_id: user.id,
                    marketplace: 'trendyol',
                    status: 'connected_demo',
                    store_name: 'Demo Mağaza',
                    seller_id: 'DEMO-000000',
                },
                { onConflict: 'user_id,marketplace' }
            )
            .select('id')
            .single();

        if (connErr || !connection) {
            console.error('[demo-test] Connection error:', connErr?.message);
            return NextResponse.json({ error: 'Demo bağlantı oluşturulamadı.' }, { status: 500 });
        }

        // 2) Insert demo products into trendyol_products_raw
        for (const p of DEMO_PRODUCTS) {
            await admin.from('trendyol_products_raw').upsert({
                user_id: user.id,
                connection_id: connection.id,
                external_product_id: p.id,
                merchant_sku: p.sku,
                barcode: p.barcode,
                title: p.title,
                brand: p.brand,
                category_path: p.category,
                sale_price: p.salePrice,
                raw_json: { id: p.id, title: p.title, stockCode: p.sku, barcode: p.barcode, brand: p.brand, categoryName: p.category, salePrice: p.salePrice, _demo: true },
            }, { onConflict: 'connection_id,external_product_id' });
        }

        // 3) Insert demo orders into trendyol_orders_raw
        const demoOrders = generateDemoOrders();
        for (const o of demoOrders) {
            await admin.from('trendyol_orders_raw').upsert({
                user_id: user.id,
                connection_id: connection.id,
                order_number: o.orderNumber,
                order_date: o.orderDate,
                status: o.status,
                total_price: o.totalPrice,
                raw_json: { ...o, _demo: true },
            }, { onConflict: 'connection_id,order_number' });
        }

        // 4) Update last_sync_at
        await admin.from('marketplace_connections')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('id', connection.id);

        // 5) Log
        await admin.from('marketplace_sync_logs').insert({
            connection_id: connection.id,
            sync_type: 'test',
            status: 'success',
            message: 'Demo test başarılı: 5 ürün + 10 sipariş oluşturuldu.',
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            message: 'Demo bağlantı kuruldu! 5 ürün ve 10 sipariş oluşturuldu.',
            status: 'connected_demo',
            store_name: 'Demo Mağaza',
            connection_id: connection.id,
        });
    } catch (err: any) {
        console.error('[demo-test] Error:', err?.message);
        return NextResponse.json({ error: 'Demo test başarısız.' }, { status: 500 });
    }
}
