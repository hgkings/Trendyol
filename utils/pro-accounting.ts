import { ProductInput, CalculationResult } from '@/types';
import { n, calculateBreakevenPrice } from '@/utils/calculations';

/**
 * Split a value into net and VAT components
 */
export function splitVat(amount: number, vatPct: number, includesVat: boolean) {
    const vatRate = n(vatPct) / 100;
    if (includesVat) {
        const net = amount / (1 + vatRate);
        return {
            net: Number.isFinite(net) ? net : 0,
            vat: Number.isFinite(amount - net) ? (amount - net) : 0
        };
    } else {
        const vat = amount * vatRate;
        return {
            net: amount,
            vat: Number.isFinite(vat) ? vat : 0
        };
    }
}

/**
 * Professional Accounting Mode (Granular Implementation)
 */
export function calculateProAccounting(input: ProductInput): CalculationResult {
    const volume = n(input.monthly_sales_volume);
    const r = n(input.return_rate_pct) / 100;

    // 1. Sales
    const saleVatPct = n(input.sale_vat_pct ?? input.vat_pct, 20);
    const sales = splitVat(n(input.sale_price), saleVatPct, input.sale_price_includes_vat !== false);

    // 2. Product Cost
    const purchaseVatPct = n(input.purchase_vat_pct ?? saleVatPct);
    const cost = splitVat(n(input.product_cost), purchaseVatPct, input.product_cost_includes_vat !== false);

    // 3. Marketplace Commission
    const commNet = sales.net * (n(input.commission_pct) / 100);
    const mpFeeVatPct = n(input.marketplace_fee_vat_pct, 20);
    const commVat = commNet * (mpFeeVatPct / 100);

    // 4. Expenses
    const shipping = splitVat(n(input.shipping_cost), n(input.shipping_vat_pct, 20), input.shipping_includes_vat !== false);
    const packaging = splitVat(n(input.packaging_cost), n(input.packaging_vat_pct, 20), input.packaging_includes_vat !== false);
    const ad = splitVat(n(input.ad_cost_per_sale), n(input.ad_vat_pct, 20), input.ad_includes_vat !== false);
    const other = splitVat(n(input.other_cost), n(input.other_cost_vat_pct, 20), input.other_cost_includes_vat !== false);

    const expensesNetTotal = shipping.net + packaging.net + ad.net + other.net;
    const expensesVatTotal = shipping.vat + packaging.vat + ad.vat + other.vat;

    // 5. Returns
    const lostNetSales = sales.net * r;
    const returnedCommNet = input.return_refunds_commission !== false ? (commNet * r) : 0;
    // Extra operational cost of return (e.g. return shipping)
    const returnExtraOpsCost = n(input.return_extra_cost) * r;

    const return_loss_net = lostNetSales - returnedCommNet + returnExtraOpsCost;

    // 6. Unit Profit (VAT-excluded)
    const unit_net_profit = sales.net - (cost.net + commNet + expensesNetTotal + return_loss_net);

    // 7. Monthly Aggregates
    const monthly_net_profit = unit_net_profit * volume;
    const monthly_net_sales = sales.net * volume;

    // 8. VAT Position (Monthly)
    // Output VAT is only collected on kept sales
    const output_vat_monthly = sales.vat * volume * (1 - r);
    // Input VAT is the sum of all deductible VATs (purchase, expenses, marketplace fee)
    const input_vat_monthly = (cost.vat * volume) + (expensesVatTotal * volume) + (commVat * volume);
    const vat_position_monthly = output_vat_monthly - input_vat_monthly;

    // 9. Legacy Fields for UI Compatibility
    const unit_variable_cost = cost.net + shipping.net + packaging.net + ad.net + other.net;
    const unit_total_cost = unit_variable_cost + commNet + return_loss_net;
    const margin_pct = sales.net > 0 ? (unit_net_profit / sales.net) * 100 : 0;

    // Breakeven price calculation needs the same logic (if possible) or fallback
    const breakeven_price = calculateBreakevenPrice(input);

    return {
        commission_amount: Number.isFinite(commNet) ? commNet : 0,
        vat_amount: Number.isFinite(sales.vat) ? sales.vat : 0, // Unit Output VAT
        expected_return_loss: Number.isFinite(return_loss_net) ? return_loss_net : 0,
        unit_variable_cost: Number.isFinite(unit_variable_cost) ? unit_variable_cost : 0,
        unit_total_cost: Number.isFinite(unit_total_cost) ? unit_total_cost : 0,
        unit_net_profit: Number.isFinite(unit_net_profit) ? unit_net_profit : 0,
        margin_pct: Number.isFinite(margin_pct) ? margin_pct : 0,
        monthly_net_profit: Number.isFinite(monthly_net_profit) ? monthly_net_profit : 0,
        monthly_revenue: n(input.sale_price) * volume, // Gross revenue for display
        monthly_total_cost: unit_total_cost * volume,
        breakeven_price: Number.isFinite(breakeven_price) ? breakeven_price : 0,
        sale_price: n(input.sale_price),
        sale_price_excl_vat: Number.isFinite(sales.net) ? sales.net : 0,

        // PRO specific
        output_vat_monthly: Number.isFinite(output_vat_monthly) ? output_vat_monthly : 0,
        input_vat_monthly: Number.isFinite(input_vat_monthly) ? input_vat_monthly : 0,
        vat_position_monthly: Number.isFinite(vat_position_monthly) ? vat_position_monthly : 0,
        monthly_net_sales: Number.isFinite(monthly_net_sales) ? monthly_net_sales : 0,
    };
}
