import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const rawNext = searchParams.get('next') ?? '/dashboard'

    // ── SECURITY: Prevent open redirect ──
    const next = (rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('://'))
        ? rawNext
        : '/dashboard';

    const supabase = createClient()

    // ── Email doğrulama: token_hash + type (Supabase PKCE / magic link flow) ──
    if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any,
        })
        if (!error) {
            return NextResponse.redirect(`${origin}/dashboard`)
        }
        return NextResponse.redirect(`${origin}/auth?error=verification_failed`)
    }

    // ── OAuth / magic link code exchange ──
    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // Tüm akışlar başarısız
    return NextResponse.redirect(`${origin}/auth?error=oauth_failed`)
}
