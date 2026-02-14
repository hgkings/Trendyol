import { calculateProAccounting } from '../utils/pro-accounting';
import { ProductInput } from '../types';

/**
 * USER EXAMPLE TEST CASE:
 * sale_price=399, sale_vat=20, includesVat=true => net_sales=332.5, sales_vat=66.5
 * product_cost=150 includesVat=false => net_cost=150
 * commission_pct=17 => commission=56.525 (17% of 332.5)
 */

const testInput: ProductInput = {
    marketplace: 'custom',
    product_name: 'Test Product',
    monthly_sales_volume: 1,
    sale_price: 399,
    sale_vat_pct: 20,
    sale_price_includes_vat: true,

    product_cost: 150,
    purchase_vat_pct: 20,
    product_cost_includes_vat: false,

    commission_pct: 17,
    marketplace_fee_vat_pct: 20,

    shipping_cost: 0,
    packaging_cost: 0,
    ad_cost_per_sale: 0,
    other_cost: 0,
    return_rate_pct: 0,
    payout_delay_days: 1,

    pro_mode: true
};

function runTest() {
    console.log("--- PRO ACCOUNTING MATH VERIFICATION ---");
    const result = calculateProAccounting(testInput);

    console.log("Input Sale Price:", testInput.sale_price);
    console.log("Calculated Net Sales:", result.sale_price_excl_vat, "(Expected: 332.5)");
    console.log("Calculated Sale VAT (Unit):", result.vat_amount, "(Expected: 66.5)");

    console.log("Calculated Commission (Net):", result.commission_amount, "(Expected: 56.525)");

    // Profit = Net Sales - Net Cost - Commission
    // Profit = 332.5 - 150 - 56.525 = 125.975
    console.log("Calculated Unit Profit:", result.unit_net_profit, "(Expected: 125.975)");

    const success =
        Math.abs(result.sale_price_excl_vat - 332.5) < 0.01 &&
        Math.abs(result.vat_amount - 66.5) < 0.01 &&
        Math.abs(result.commission_amount - 56.525) < 0.01 &&
        Math.abs(result.unit_net_profit - 125.975) < 0.01;

    if (success) {
        console.log("\n✅ MATH VERIFICATION SUCCESSFUL!");
    } else {
        console.log("\n❌ MATH VERIFICATION FAILED!");
        process.exit(1);
    }
}

runTest();
