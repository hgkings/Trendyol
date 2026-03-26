/**
 * Central Plan Configuration — Single Source of Truth
 *
 * ALL plan limits must be read from here.
 * Do NOT hardcode limit numbers anywhere else in the app.
 */

export const PLAN_LIMITS = {
    free: {
        maxProducts: 3,
        maxMarketplaces: 2,
        csvExport: false,
        csvImport: false,
        jsonExport: false,
        proAccounting: false,
        sensitivityAnalysis: false,
        breakEven: false,
        cashflow: false,
        marketplaceComparison: false,
        apiIntegration: false,
        pdfReportMonthly: 0,
        weeklyEmailReport: false,
        prioritySupport: false,
        competitorTracking: false,
    },
    starter: {
        maxProducts: 25,
        maxMarketplaces: 4,
        csvExport: true,
        csvImport: true,
        jsonExport: true,
        proAccounting: true,
        sensitivityAnalysis: true,
        breakEven: true,
        cashflow: false,
        marketplaceComparison: false,
        apiIntegration: false,
        pdfReportMonthly: 5,
        weeklyEmailReport: false,
        prioritySupport: false,
        competitorTracking: false,
    },
    pro: {
        maxProducts: Infinity,
        maxMarketplaces: Infinity,
        csvExport: true,
        csvImport: true,
        jsonExport: true,
        proAccounting: true,
        sensitivityAnalysis: true,
        breakEven: true,
        cashflow: true,
        marketplaceComparison: true,
        apiIntegration: true,
        pdfReportMonthly: Infinity,
        weeklyEmailReport: true,
        prioritySupport: true,
        competitorTracking: true,
    },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;

/**
 * Helper to get the limit for a given plan.
 * Defaults to 'free' if plan is undefined or unrecognized.
 */
export function getPlanLimits(plan: string | undefined) {
    if (plan === 'pro' || plan === 'admin') return PLAN_LIMITS.pro;
    if (plan === 'starter') return PLAN_LIMITS.starter;
    return PLAN_LIMITS.free; // Default to free for safety
}
