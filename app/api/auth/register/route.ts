import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { auditLog, generateTraceId } from '@/lib/security/audit'
import { getIp } from '@/lib/api/helpers'
import { z } from 'zod'

// ----------------------------------------------------------------
// POST /api/auth/register
// Server-side register proxy — rate limit + audit log.
// Session cookie olarak set edilir, body'de session donmez.
// ----------------------------------------------------------------

const RegisterSchema = z.object({
  email: z
    .string()
    .email('Geçerli bir e-posta adresi girin')
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(6, 'Şifre en az 6 karakter olmalıdır')
    .max(72, 'Şifre en fazla 72 karakter olabilir'),
  fullName: z
    .string()
    .max(200, 'İsim en fazla 200 karakter olabilir')
    .optional(),
})

export async function POST(request: Request) {
  const ip = getIp(request)
  const traceId = generateTraceId()

  // ── 1. IP bazlı rate limit (spam kayıt koruması) ──
  const ipCheck = await checkRateLimit('auth', `ip:${ip}`)
  if (!ipCheck.success) {
    void auditLog({
      action: 'auth.register',
      userId: null,
      traceId,
      ip,
      metadata: { reason: 'rate_limit_ip' },
    })
    return NextResponse.json(
      { error: 'Çok fazla kayıt denemesi. Lütfen biraz bekleyin.' },
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

  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    return NextResponse.json(
      { error: 'Doğrulama hatası.', fieldErrors },
      { status: 422 }
    )
  }

  const { email, password, fullName } = parsed.data

  // ── 3. Email bazlı rate limit (aynı email ile spam kayıt) ──
  const emailCheck = await checkRateLimit('auth', `email:${email}`)
  if (!emailCheck.success) {
    void auditLog({
      action: 'auth.register_failed',
      userId: null,
      traceId,
      ip,
      metadata: { reason: 'rate_limit_email' },
    })
    return NextResponse.json(
      { error: 'Çok fazla kayıt denemesi. Lütfen biraz bekleyin.' },
      { status: 429 }
    )
  }

  // ── 4. Supabase Auth — server client (cookie otomatik set edilir) ──
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: fullName
        ? { data: { full_name: fullName } }
        : undefined,
    })

    if (error) {
      void auditLog({
        action: 'auth.register_failed',
        userId: null,
        traceId,
        ip,
        metadata: { reason: error.message },
      })
      // Generic hata — Supabase mesajları gösterilmez
      return NextResponse.json(
        { error: 'Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.' },
        { status: 400 }
      )
    }

    // ── 5. "Fake user" kontrolü ──
    // Supabase, email confirmation açıkken mevcut email'e signUp yapılırsa
    // hata döndürmez, identities: [] ile "fake user" döndürür.
    // User enumeration engellenir — her iki durumda da aynı yanıt.
    const isExistingUser = data.user?.identities?.length === 0

    if (!data.user || isExistingUser) {
      // Mevcut kullanıcı olsa bile aynı başarılı yanıt — enumeration engellenir
      void auditLog({
        action: 'auth.register',
        userId: null,
        traceId,
        ip,
        metadata: { result: 'generic_success' },
      })
      return NextResponse.json({
        success: true,
        needsEmailConfirmation: true,
      })
    }

    void auditLog({
      action: 'auth.register',
      userId: data.user.id,
      traceId,
      ip,
    })

    // ── 6. Welcome email (fire-and-forget, güvenli URL) ──
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    try {
      fetch(`${baseUrl}/api/email/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id, email }),
      }).catch(() => {})
    } catch {
      // Welcome email hatası kayıt akışını engellemez
    }

    // Email doğrulaması gerekiyorsa session henüz aktif değildir
    const hasSession = !!data.session

    return NextResponse.json({
      success: true,
      needsEmailConfirmation: !hasSession,
      userId: hasSession ? data.user.id : undefined,
      email: hasSession ? data.user.email : undefined,
    })
  } catch (err: unknown) {
    void auditLog({
      action: 'auth.register_failed',
      userId: null,
      traceId,
      ip,
      metadata: { error: err instanceof Error ? err.message : 'unknown' },
    })
    return NextResponse.json(
      { error: 'Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.' },
      { status: 500 }
    )
  }
}
