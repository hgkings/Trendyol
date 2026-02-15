/**
 * Central Pricing Configuration — Single Source of Truth
 * 
 * ALL price displays must reference this file.
 * Do NOT hardcode prices anywhere else in the app.
 */

export const PRICING = {
    monthly: 229,
    yearly: 2290,
    oldMonthly: 349, // Struck-through "was" price on pricing page
    currency: '₺',
} as const;

export function formatPrice(amount: number): string {
    return `${amount}${PRICING.currency}`;
}

export function monthlyLabel(): string {
    return `Aylık ${formatPrice(PRICING.monthly)}`;
}
