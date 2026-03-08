import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shopier/health
 * Temporary health check to confirm Shopier routes are deployed.
 */
export async function GET() {
    return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        env: {
            has_SHOPIER_API_KEY: !!process.env.SHOPIER_API_KEY,
            has_SHOPIER_API_SECRET: !!process.env.SHOPIER_API_SECRET,
            has_SHOPIER_API_TOKEN: !!process.env.SHOPIER_API_TOKEN,
            has_SHOPIER_PRO_MONTHLY_URL: !!process.env.SHOPIER_PRO_MONTHLY_URL,
            has_SHOPIER_PRO_YEARLY_URL: !!process.env.SHOPIER_PRO_YEARLY_URL,
            has_SHOPIER_OSB_USERNAME: !!process.env.SHOPIER_OSB_USERNAME,
            has_SHOPIER_OSB_KEY: !!process.env.SHOPIER_OSB_KEY,
            has_SHOPIER_MONTHLY_PRODUCT_ID: !!process.env.SHOPIER_MONTHLY_PRODUCT_ID,
            has_SHOPIER_YEARLY_PRODUCT_ID: !!process.env.SHOPIER_YEARLY_PRODUCT_ID,
            has_SUPABASE_URL: !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
            has_SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        }
    });
}
