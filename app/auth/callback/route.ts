import { createClient } from '@/lib/supabase-server-client'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const rawNext = searchParams.get('next') ?? '/dashboard'

    // ── SECURITY: Prevent open redirect ──
    // Only allow relative paths starting with / and not containing //
    const next = (rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('://'))
        ? rawNext
        : '/dashboard';

    if (code) {
        const supabase = createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // If code exchange fails, redirect back to auth with error
    return NextResponse.redirect(`${origin}/auth?error=oauth_failed`)
}
