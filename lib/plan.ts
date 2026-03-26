import { User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { PLAN_LIMITS, getPlanLimits } from '@/config/plans';

/**
 * Re-export the centralized check from utils/access.
 * Kept for backward compatibility — components that already
 * import { isPro } from '@/lib/plan' will keep working.
 */
export { isProUser as isPro } from '@/utils/access';

/**
 * Checks if the user is allowed to create another analysis.
 * Returns true if allowed, false if limit reached.
 *
 * Uses PLAN_LIMITS from config/plans.ts — the single source of truth.
 */
export async function checkAnalysisLimit(userId: string): Promise<boolean> {
    // Fetch user profile to determine plan — only select columns that EXIST
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .single();

    // CRITICAL DEBUG: Log what DB returned
    if (process.env.NODE_ENV === 'development') {
        console.log('[Plan Limit Check] Profile fetch:', {
            userId,
            profile,
            profileError: profileError?.message || null,
        });
    }

    // If profile fetch failed, check if it's an RLS/auth issue
    if (profileError || !profile) {
        console.error('[Plan Limit Check] FAILED to fetch profile for user:', userId, 'Error:', profileError?.message);
        // Don't block users just because profile fetch failed —
        // let them through but log the error
        return true;
    }

    const userPlan = profile.plan || 'free';

    // PRO users bypass ALL limits
    if (['pro', 'pro_monthly', 'pro_yearly'].includes(userPlan)) {
        if (process.env.NODE_ENV === 'development') {
            console.log('[Plan Limit Check] PRO active, no limits:', { userId });
        }
        return true;
    }

    // Count analyses for FREE users
    const { count, error } = await supabase
        .from('analyses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (error) {
        console.error('[Plan Limit Check] Error counting analyses:', error);
        return true; // Don't block on DB errors
    }

    const limit = PLAN_LIMITS.free.maxProducts;
    const currentCount = count || 0;
    const allowed = currentCount < limit;

    if (process.env.NODE_ENV === 'development') {
        console.log('[Plan Limit Check] FREE user check:', {
            userId,
            plan: userPlan,
            currentCount,
            limit,
            allowed,
        });
    }

    return allowed;
}

// Re-export for convenience
export { PLAN_LIMITS, getPlanLimits };
