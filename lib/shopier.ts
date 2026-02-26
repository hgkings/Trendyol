/**
 * Shopier Payment Integration Service
 * 
 * Handles:
 * - Building payment form data with HMAC-SHA256 signature
 * - Verifying callback signatures from Shopier webhooks
 * 
 * Shopier uses a form-based checkout where we POST hidden fields
 * to https://www.shopier.com/ShowProduct/api_pay4.php
 * 
 * ENV: SHOPIER_ACCESS_TOKEN (contains API key + secret separated by ":")
 *   or SHOPIER_API_KEY and SHOPIER_API_SECRET separately
 */

import crypto from 'crypto';

const SHOPIER_CHECKOUT_URL = 'https://www.shopier.com/ShowProduct/api_pay4.php';

function getCredentials() {
    // 1. Log which env vars are present (only names, not values!)
    console.log('[Shopier] Checking env vars:', {
        has_SHOPIER_ACCESS_TOKEN: !!process.env.SHOPIER_ACCESS_TOKEN,
        has_SHOPIER_API_KEY: !!process.env.SHOPIER_API_KEY,
        has_SHOPIER_API_SECRET: !!process.env.SHOPIER_API_SECRET
    });

    // 2. Read exactly process.env.SHOPIER_ACCESS_TOKEN (fallback to SHOPIER_API_KEY)
    const token = process.env.SHOPIER_ACCESS_TOKEN || process.env.SHOPIER_API_KEY;
    const secret = process.env.SHOPIER_API_SECRET || '';

    if (!token) {
        throw new Error("Missing SHOPIER_ACCESS_TOKEN or SHOPIER_API_KEY in environment");
    }

    if (token && token.includes(':')) {
        const [key, secretPart] = token.split(':');
        return { apiKey: key, apiSecret: secretPart };
    }

    return {
        apiKey: token,
        apiSecret: secret,
    };
}

export interface ShopierBuyer {
    name: string;
    surname: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    postcode: string;
}

export interface ShopierOrderParams {
    platformOrderId: string;
    productName: string;
    totalAmount: number;       // e.g. 229 for 229 TRY
    currency: number;          // 0 = TRY, 1 = USD, 2 = EUR
    buyer: ShopierBuyer;
}

/**
 * Generates the Shopier payment form (auto-submitting HTML)
 * that the user's browser will POST to Shopier's checkout page.
 */
export function generateShopierForm(params: ShopierOrderParams): string {
    const { apiKey, apiSecret } = getCredentials();

    const randomNr = crypto.randomInt(100000, 999999).toString();

    // Signature: base64(hmac_sha256(secret, random_nr + platform_order_id + total_order_value + currency))
    const dataToSign = `${randomNr}${params.platformOrderId}${params.totalAmount}${params.currency}`;

    let signature = '';
    if (apiSecret) {
        const hmac = crypto.createHmac('sha256', apiSecret);
        hmac.update(dataToSign);
        signature = hmac.digest('base64');
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://xn--krnet-3qa.com';

    const fields: Record<string, string> = {
        'API_key': apiKey,
        'website_index': '1',
        'platform_order_id': params.platformOrderId,
        'product_name': params.productName,
        'product_type': '1', // 1 = digital
        'buyer_name': params.buyer.name,
        'buyer_surname': params.buyer.surname,
        'buyer_email': params.buyer.email,
        'buyer_phone': params.buyer.phone,
        'buyer_id_nr': '',
        'billing_address': params.buyer.address,
        'billing_city': params.buyer.city,
        'billing_country': params.buyer.country,
        'billing_postcode': params.buyer.postcode,
        'shipping_address': params.buyer.address,
        'shipping_city': params.buyer.city,
        'shipping_country': params.buyer.country,
        'shipping_postcode': params.buyer.postcode,
        'total_order_value': params.totalAmount.toString(),
        'currency': params.currency.toString(),
        'platform': '0',
        'is_in_frame': '0',
        'current_language': '0', // 0 = Turkish
        'modul_version': '1.0.4',
        'random_nr': randomNr,
        'signature': signature,
        'success_url': `${appUrl}/payment/success`,
        'fail_url': `${appUrl}/payment/fail`,
        'callback_url': `${appUrl}/api/shopier/callback`,
    };

    // Build auto-submitting HTML form
    const hiddenInputs = Object.entries(fields)
        .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}" />`)
        .join('\n    ');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Shopier Ödeme Sayfasına Yönlendiriliyor...</title>
  <style>
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0f; color: #fff; font-family: system-ui, sans-serif; }
    .loader { text-align: center; }
    .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { font-size: 14px; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Shopier ödeme sayfasına yönlendiriliyorsunuz…</p>
  </div>
  <form id="shopier-form" method="POST" action="${SHOPIER_CHECKOUT_URL}">
    ${hiddenInputs}
  </form>
  <script>document.getElementById('shopier-form').submit();</script>
</body>
</html>`;
}

/**
 * Verifies a Shopier callback signature.
 * Returns true if the signature matches.
 */
export function verifyShopierCallback(body: Record<string, string>): boolean {
    const { apiSecret } = getCredentials();

    if (!apiSecret) {
        // If no secret configured, we can't verify — log warning but allow
        console.warn('[Shopier] No API secret configured, cannot verify callback signature.');
        return true; // Permissive mode when secret not set
    }

    const randomNr = body.random_nr || '';
    const orderId = body.platform_order_id || '';
    const totalValue = body.total_order_value || '';
    const currency = body.currency || '';
    const receivedSignature = body.signature || '';

    const dataToSign = `${randomNr}${orderId}${totalValue}${currency}`;
    const hmac = crypto.createHmac('sha256', apiSecret);
    hmac.update(dataToSign);
    const expectedSignature = hmac.digest('base64');

    return expectedSignature === receivedSignature;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
