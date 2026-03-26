
export const PRICING = {
    starter: {
        monthly: 399,
        annual: 3990,
        label: 'Başlangıç',
        description: 'Küçük ve orta ölçekli satıcılar için',
    },
    pro: {
        monthly: 799,
        annual: 7990,
        label: 'Profesyonel',
        description: 'Büyük ölçekli ve profesyonel satıcılar için',
    },
    // Backward compatibility — used by protected create-payment route
    proMonthly: 799,
    proYearly: 7990,
    proMonthlyId: 'pro_monthly' as const,
    proYearlyId: 'pro_yearly' as const,
    currency: 'TRY',
    symbol: '₺',
} as const;

export type PlanId = 'pro_monthly' | 'pro_yearly' | 'starter_monthly' | 'starter_yearly';

export function getPlanAmount(planId: PlanId): number {
    if (planId === 'pro_monthly') return PRICING.pro.monthly;
    if (planId === 'pro_yearly') return PRICING.pro.annual;
    if (planId === 'starter_monthly') return PRICING.starter.monthly;
    if (planId === 'starter_yearly') return PRICING.starter.annual;
    return PRICING.pro.monthly;
}

export function getPlanDays(planId: PlanId): number {
    if (planId === 'pro_yearly' || planId === 'starter_yearly') return 365;
    return 30;
}

export const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: PRICING.currency,
        maximumFractionDigits: 0,
    }).format(amount).replace('TRY', '').trim() + PRICING.symbol;
};

export const monthlyLabel = () => `${PRICING.pro.monthly}${PRICING.symbol}/ay`;
export const yearlyLabel = () => `${PRICING.pro.annual}${PRICING.symbol}/yıl`;
