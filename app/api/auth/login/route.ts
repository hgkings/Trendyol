import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { auditLog, generateTraceId } from '@/lib/security/audit'
import { getIp } from '@/lib/api/helpers'
import { z } from 'zod'

// ----------------------------------------------------------------
// POST /api/auth/login
// Server-side login proxy — rate limit + audit log + MFA destegi.
// Session cookie olarak set edilir, body'de session donmez.
// ----------------------------------------------------------------

const LoginSchema = z.object({
  email: z
    .string()
    .email('Geçerli bir e-posta adresi girin')
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(6, 'Şifre en az 6 karakter olmalıdır')
    .max(72, 'Şifre en fazla 72 karakter olabilir'),
})

export async function POST(request: Request) {
  const ip = getIp(request)
  const traceId = generateTraceId()

  // ── 1. IP bazlı rate limit (brute-force koruması) ──
  const ipCheck = await checkRateLimit('auth', `ip:${ip}`)
  if (!ipCheck.success) {
    void auditLog({
      action: 'auth.login_failed',
      userId: null,
      traceId,
      ip,
      metadata: { reason: 'rate_limit_ip' },
    })
    return NextResponse.json(
      { error: 'Çok fazla giriş denemesi. Lütfen biraz bekleyin.' },
      { status: 429 }
    )
  }

  // ── 2. Body parse + Zod validasyon ──
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Geçersiz istek formatı.' },
      { status: 400 }
    )
  }

  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    return NextResponse.json(
      { error: 'Doğrulama hatası.', fieldErrors },
      { status: 422 }
    )
  }

  const { email, password } = parsed.data

  // ── 3. Email bazlı rate limit (hesap başına brute-force) ──
  const emailCheck = await checkRateLimit('auth', `email:${email}`)
  if (!emailCheck.success) {
    void auditLog({
      action: 'auth.login_failed',
      userId: null,
      traceId,
      ip,
      metadata: { reason: 'rate_limit_email' },
    })
    return NextResponse.json(
      { error: 'Bu hesap için çok fazla giriş denemesi. Lütfen biraz bekleyin.' },
      { status: 429 }
    )
  }

  // ── 4. Supabase Auth — server client (cookie otomatik set edilir) ──
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      void auditLog({
        action: 'auth.login_failed',
        userId: null,
        traceId,
        ip,
        metadata: { reason: 'invalid_credentials' },
      })
      // Generic hata — user enumeration engellenir
      return NextResponse.json(
        { error: 'E-posta veya şifre hatalı.' },
        { status: 401 }
      )
    }

    // ── 5. MFA kontrolü — TOTP kayıtlıysa AAL2 gerekir ──
    const { data: factorsData } = await supabase.auth.mfa.listFactors()

    const verifiedTotpFactors = factorsData?.totp?.filter(
      (f: { status: string }) => f.status === 'verified'
    ) ?? []
    const hasTotp = verifiedTotpFactors.length > 0

    if (hasTotp) {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData && aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
        void auditLog({
          action: 'auth.login',
          userId: data.user.id,
          traceId,
          ip,
          metadata: { mfaRequired: true },
        })
        return NextResponse.json({
          success: true,
          mfaRequired: true,
          userId: data.user.id,
          email: data.user.email,
        })
      }
    }

    // ── 6. Başarılı giriş ──
    void auditLog({
      action: 'auth.login',
      userId: data.user.id,
      traceId,
      ip,
    })

    // Session body'de döndürülmez — cookie ile taşınır
    // userId + email client'ın profil çekmesi için döndürülür
    return NextResponse.json({
      success: true,
      mfaRequired: false,
      userId: data.user.id,
      email: data.user.email,
    })
  } catch (err: unknown) {
    void auditLog({
      action: 'auth.login_failed',
      userId: null,
      traceId,
      ip,
      metadata: { error: err instanceof Error ? err.message : 'unknown' },
    })
    return NextResponse.json(
      { error: 'Giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.' },
      { status: 500 }
    )
  }
}
