import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ----------------------------------------------------------------
// Upstash Redis rate limiter — fail-open deseni.
// Redis erisilemezse istek GECER (kullanici bloke edilmez).
// ----------------------------------------------------------------

function createRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    // UPSTASH env degiskenleri tanimlanmamis — rate limit devre disi
    return null
  }

  return new Redis({ url, token })
}

const redis = createRedis()

function createLimiter(
  prefix: string,
  tokens: number,
  window: `${number} s` | `${number} m` | `${number} h` | `${number} d`
): Ratelimit | null {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix: `karnet:ratelimit:${prefix}`,
    analytics: false,
  })
}

// AUTH profili — login, register, sifre sifirlama
const authLimiter = createLimiter('auth', 5, '15 m')

// API profili — genel API route'lari (kullanici basina)
const apiLimiter = createLimiter('api', 100, '1 m')

// EMAIL profili — email gonderimi
const emailLimiter = createLimiter('email', 3, '1 m')

// SYNC profili — marketplace tum islemler (kullanici basina)
// 30/saat: connect + test + sync×2 + normalize×2 + getStatus×N + finance + claims
const syncLimiter = createLimiter('sync', 30, '1 h')

// COMMENT profili — blog yorumlari
const commentLimiter = createLimiter('comment', 3, '1 m')

// ADMIN profili — admin islemleri
const adminLimiter = createLimiter('admin', 50, '1 m')

// ANALYSIS profili — analiz islemleri (race condition korunmasi icin dusuk)
const analysisLimiter = createLimiter('analysis', 5, '1 m')

// MFA profili — MFA dogrulama denemeleri
const mfaLimiter = createLimiter('mfa', 10, '5 m')

// PDF profili — PDF rapor uretimi
const pdfLimiter = createLimiter('pdf', 10, '1 h')

// REGISTER profili — kayit islemleri
const registerLimiter = createLimiter('register', 3, '1 h')

// FORGOT-PASSWORD profili — sifre sifirlama
const forgotPasswordLimiter = createLimiter('forgot-password', 3, '1 h')

// WEBHOOK profili — PayTR callback (IP bazli)
const webhookLimiter = createLimiter('webhook', 100, '1 m')

export type RateLimitType =
  | 'auth'
  | 'api'
  | 'email'
  | 'sync'
  | 'comment'
  | 'admin'
  | 'analysis'
  | 'mfa'
  | 'pdf'
  | 'register'
  | 'forgot-password'
  | 'webhook'

const limiters: Record<RateLimitType, Ratelimit | null> = {
  auth: authLimiter,
  api: apiLimiter,
  email: emailLimiter,
  sync: syncLimiter,
  comment: commentLimiter,
  admin: adminLimiter,
  analysis: analysisLimiter,
  mfa: mfaLimiter,
  pdf: pdfLimiter,
  register: registerLimiter,
  'forgot-password': forgotPasswordLimiter,
  webhook: webhookLimiter,
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Rate limit header'larini Response'a ekler.
 * 429 durumunda Retry-After header da eklenir.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  }
  if (!result.success) {
    const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
    headers['Retry-After'] = String(retryAfter)
  }
  return headers
}

/**
 * Rate limit kontrolu yapar.
 * @param type - Limit profili (auth, api, email, sync, comment)
 * @param identifier - Benzersiz tanimlayici (userId, IP, vb.)
 * @returns Fail-open: Redis erisemezse { success: true } doner
 */
export async function checkRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<RateLimitResult> {
  // Development'ta rate limit atla — performans icin
  if (process.env.NODE_ENV === 'development') {
    return { success: true, limit: -1, remaining: -1, reset: 0 }
  }

  const limiter = limiters[type]

  // Kritik endpoint'ler: auth, admin — Redis yoksa fail-closed
  const criticalTypes: RateLimitType[] = ['auth', 'admin']
  const isCritical = criticalTypes.includes(type)

  if (!limiter) {
    if (isCritical) {
      // Fail-closed: kritik endpoint'te Redis yoksa engelle
      return { success: false, limit: 0, remaining: 0, reset: Date.now() + 60000 }
    }
    return { success: true, limit: -1, remaining: -1, reset: 0 }
  }

  try {
    const result = await limiter.limit(identifier)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch {
    if (isCritical) {
      // Fail-closed: Redis hatasinda kritik endpoint'i engelle
      return { success: false, limit: 0, remaining: 0, reset: Date.now() + 60000 }
    }
    // Fail-open: diger endpoint'ler icin gecir
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }
}
