import { User } from '@/types';

/**
 * Single source of truth: is this user PRO?
 *
 * Uses `user.plan` and expiration fields from the Supabase `profiles` table.
 *
 * Every premium gate in the app MUST use this function.
 *
 * Logic:
 * 1. plan === 'pro' or 'admin' → check expiration
 * 2. pro_until is future → pro (legacy field)
 * 3. pro_expires_at is null → pro does NOT expire (null = no expiry)
 * 4. pro_expires_at is future → pro still active
 * 5. pro_expires_at is past → pro expired
 */
const PRO_PLANS: string[] = ['pro', 'pro_monthly', 'pro_yearly'];

export function isProUser(user: User | null | undefined): boolean {
    if (!user) return false;

    // Admin always has access
    if (user.plan === 'admin') return true;

    // Check plan + expiration (NULL-safe: null means no expiry)
    if (PRO_PLANS.includes(user.plan)) {
        // If pro_expires_at is null/undefined → pro is active (no expiry set)
        if (!user.pro_expires_at) return true;

        // If pro_expires_at exists, check if it's still in the future
        const expiresAt = new Date(user.pro_expires_at);
        if (!isNaN(expiresAt.getTime()) && expiresAt > new Date()) {
            return true;
        }

        // Expired — fall through to check pro_until as fallback
    }

    // Check time-based expiration (legacy field: pro_until)
    if (user.pro_until) {
        const expirationDate = new Date(user.pro_until);
        if (!isNaN(expirationDate.getTime()) && expirationDate > new Date()) {
            return true;
        }
    }

    return false;
}

/**
 * Returns true if the user is on the starter plan (and not pro/admin).
 * Pro and admin users get everything starter has, so check isProUser separately
 * if you need to distinguish between starter and pro.
 */
export function isStarterUser(user: User | null | undefined): boolean {
    if (!user) return false;
    return user.plan === 'starter';
}
