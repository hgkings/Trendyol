/**
 * Central Plan Configuration — Single Source of Truth
 * 
 * ALL plan limits must be read from here.
 * Do NOT hardcode limit numbers anywhere else in the app.
 */

export const PLAN_LIMITS = {
    free: {
        maxProducts: 5,
        csvExport: false,
        csvImport: false,
        jsonExport: true,
        marketplaceComparison: false,
        competitorTracking: false,
        cashflow: false,
        proAccounting: false,
        sensitivityAnalysis: false,
    },
    pro: {
        maxProducts: Infinity,
        csvExport: true,
        csvImport: true,
        jsonExport: true,
        marketplaceComparison: true,
        competitorTracking: true,
        cashflow: true,
        proAccounting: true,
        sensitivityAnalysis: true,
    },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;

/**
 * Helper to get the limit for a given plan.
 * Defaults to 'free' if plan is undefined.
 */
export function getPlanLimits(plan: string | undefined) {
    if (plan === 'pro') return PLAN_LIMITS.pro;
    return PLAN_LIMITS.free; // Default to free for safety
}
