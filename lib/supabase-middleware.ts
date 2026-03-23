
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that should be publicly accessible without authentication
const PUBLIC_ROUTES = [
    '/',
    '/auth',
    '/pricing',
    '/demo',
    '/blog',
    '/hakkimizda',
    '/iletisim',
    '/gizlilik-politikasi',
    '/mesafeli-satis-sozlesmesi',
    '/iade-politikasi',
    '/kullanim-sartlari',
    '/support',
    '/hata',
];

function isPublicRoute(pathname: string): boolean {
    return PUBLIC_ROUTES.some(route =>
        pathname === route || pathname.startsWith(`${route}/`)
    );
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    // Middleware calls must instantiate the Supabase client
    // with a different cookie strategy
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // ── SECURITY: Redirect unauthenticated users to auth page ──
    const pathname = request.nextUrl.pathname;

    if (
        !user &&
        !pathname.startsWith('/auth') &&
        !pathname.startsWith('/_next') &&
        !pathname.startsWith('/api/') &&
        !isPublicRoute(pathname)
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth'
        url.searchParams.set('next', pathname)
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
