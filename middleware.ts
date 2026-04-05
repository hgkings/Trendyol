import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
    // CVE-2025-29927 korumasi — bypass header'lari varsa reddet
    if (
        request.headers.get('x-middleware-subrequest') ||
        request.headers.get('x-middleware-invoke')
    ) {
        return new NextResponse('Forbidden', { status: 403 })
    }

    // PayTR callback must NEVER go through auth - PayTR sends server-to-server POST without cookies
    if (request.nextUrl.pathname.startsWith('/api/paytr/')) {
        return NextResponse.next()
    }

    // Trendyol webhook — server-to-server POST, cookie yok, Basic Auth ile doğrulanır
    if (request.nextUrl.pathname === '/api/marketplace/trendyol/webhook') {
        return NextResponse.next()
    }
    return await updateSession(request)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/paytr/.*|api/marketplace/trendyol/webhook$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
