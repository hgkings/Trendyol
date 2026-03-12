import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase-middleware'

export async function middleware(request: NextRequest) {
    // PayTR callback must NEVER go through auth - PayTR sends server-to-server POST without cookies
    if (request.nextUrl.pathname.startsWith('/api/paytr/')) {
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
        '/((?!_next/static|_next/image|favicon.ico|api/paytr/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
