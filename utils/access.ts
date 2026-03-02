import { User } from '@/types';

/**
 * Single source of truth: is this user PRO?
 *
 * Uses ONLY `user.plan` — the column that actually exists
 * in the Supabase `profiles` table.
 *
 * Every premium gate in the app MUST use this function.
 */
export function isProUser(user: User | null | undefined): boolean {
    if (!user) return false;

    // Check traditional plan
    if (user.plan === 'pro') return true;

    // Check time-based expiration (if plan is free but pro_until exists and is future)
    if (user.pro_until) {
        const expirationDate = new Date(user.pro_until);
        if (!isNaN(expirationDate.getTime()) && expirationDate > new Date()) {
            return true;
        }
    }

    return false;
}
