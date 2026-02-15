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
    return user.plan === 'pro';
}
