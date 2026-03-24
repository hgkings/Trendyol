import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Auth endpoint'leri için — çok sıkı
export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
  prefix: 'karnet:auth',
})

// Genel API için — normal
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  analytics: true,
  prefix: 'karnet:api',
})

// Email endpoint'leri için — çok sıkı
export const emailRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 m'),
  analytics: true,
  prefix: 'karnet:email',
})

export function getIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  return xff ? xff.split(',')[0].trim() : '127.0.0.1'
}
