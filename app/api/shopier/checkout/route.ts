import { NextRequest } from 'next/server';
import { generateShopierForm } from '@/lib/shopier';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shopier/checkout?orderId=...&plan=...&amount=...&...
 * 
 * Renders the auto-submitting Shopier payment form.
 * The browser navigates here via window.location.href after create-order.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const orderId = searchParams.get('orderId') || '';
    const amount = parseInt(searchParams.get('amount') || '0', 10);
    const product = searchParams.get('product') || 'Kârnet Pro';
    const name = searchParams.get('name') || 'Müşteri';
    const surname = searchParams.get('surname') || 'Karnet';
    const email = searchParams.get('email') || '';

    if (!orderId || !amount || !email) {
        return new Response('Eksik parametreler.', { status: 400 });
    }

    try {
        console.log('[checkout] Checking Shopier env before generating form:', {
            has_SHOPIER_ACCESS_TOKEN: !!process.env.SHOPIER_ACCESS_TOKEN,
            has_SHOPIER_API_KEY: !!process.env.SHOPIER_API_KEY
        });

        const formHtml = generateShopierForm({
            platformOrderId: orderId,
            productName: product,
            totalAmount: amount,
            currency: 0, // TRY
            buyer: {
                name,
                surname,
                email,
                phone: '05000000000',
                address: 'Türkiye',
                city: 'İstanbul',
                country: 'TR',
                postcode: '34000',
            },
        });

        return new Response(formHtml, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    } catch (error: any) {
        console.error('[checkout] generateShopierForm error:', error.message);
        return new Response(`Sistem Hatasi: ${error.message}`, { status: 500 });
    }
}
