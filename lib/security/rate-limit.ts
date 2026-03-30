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
    console.warn('[rate-limit] UPSTASH env degiskenleri tanimlanmamis — rate limit devre disi')
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

// 5 istek / dakika — login, register, sifre sifirlama
const authLimiter = createLimiter('auth', 5, '1 m')

// 60 istek / dakika — genel API route'lari
const apiLimiter = createLimiter('api', 60, '1 m')

// 3 istek / dakika — email gonderimi
const emailLimiter = createLimiter('email', 3, '1 m')

// 1 istek / 5 dakika — marketplace sync (kullanici basina)
const syncLimiter = createLimiter('sync', 1, '5 m')

// 3 istek / dakika — blog yorumlari
const commentLimiter = createLimiter('comment', 3, '1 m')

// 10 istek / 15 dakika — admin islemleri (kullanici basina)
const adminLimiter = createLimiter('admin', 10, '15 m')

// 30 istek / dakika — analiz olusturma (kullanici basina)
const analysisLimiter = createLimiter('analysis', 30, '1 m')

export type RateLimitType = 'auth' | 'api' | 'email' | 'sync' | 'comment' | 'admin' | 'analysis'

const limiters: Record<RateLimitType, Ratelimit | null> = {
  auth: authLimiter,
  api: apiLimiter,
  email: emailLimiter,
  sync: syncLimiter,
  comment: commentLimiter,
  admin: adminLimiter,
  analysis: analysisLimiter,
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
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

  // Fail-open: limiter yoksa gecir (Redis baglantisi yoksa)
  if (!limiter) {
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
    // Fail-open: Redis hatasi durumunda gecir
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }
}
