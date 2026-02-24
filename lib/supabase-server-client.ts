
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
    const cookieStore = cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

/**
 * Creates a server-side Supabase client using the Service Role Key.
 * WARNING: This client bypasses RLS policies. Use only in secure server environments
 * (e.g., API routes, server actions) where elevated privileges are strictly necessary
 * and user input is validated.
 */
export function createAdminClient() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            cookies: {
                getAll() {
                    return cookies().getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookies().set(name, value, options)
                        )
                    } catch {
                        // ignore setAll in server component
                    }
                },
            },
        }
    )
}

// Lazy singleton — only created on first access, never at build time
let _supabaseAdmin: ReturnType<typeof createServerClient> | null = null;

export function getSupabaseAdmin() {
    if (!_supabaseAdmin) {
        _supabaseAdmin = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { cookies: { getAll: () => [], setAll: () => { } } }
        );
    }
    return _supabaseAdmin;
}

// Backward-compat: proxy object that lazily gets the real client
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createServerClient>, {
    get(_target, prop) {
        const real = getSupabaseAdmin();
        return (real as any)[prop];
    }
});
