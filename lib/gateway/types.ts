// ----------------------------------------------------------------
// Gateway Katmani — Tip Tanimlari
// Katman 3-5 arasinda paylasilan tipler.
// ----------------------------------------------------------------

import type { RateLimitType } from '@/lib/security/rate-limit'

/**
 * Kayitli servis isimleri.
 * FAZ4'te servisler eklendikce bu union genisler.
 */
export type ServiceName =
  | 'analysis'
  | 'user'
  | 'payment'
  | 'notification'
  | 'marketplace'
  | 'risk'
  | 'commission'
  | 'support'
  | 'pdf'
  | 'blog'

/**
 * Servis adi → rate limit tipi eslesmesi.
 * Her servisin varsayilan rate limit profili.
 */
export const SERVICE_RATE_LIMIT_MAP: Record<ServiceName, RateLimitType> = {
  analysis: 'api',
  user: 'api',
  payment: 'api',
  notification: 'api',
  marketplace: 'sync',
  risk: 'api',
  commission: 'api',
  support: 'api',
  pdf: 'api',
  blog: 'comment',
}

/**
 * Gateway'e gelen istek tipi.
 */
export interface GatewayRequest {
  serviceName: ServiceName
  method: string
  payload: unknown
  userId: string
  traceId: string
  rateLimitType?: RateLimitType
}

/**
 * Gateway'den donen standart cevap.
 */
export interface GatewayResponse<T = unknown> {
  success: boolean
  data: T | null
  error: string | null
  traceId: string
}

/**
 * Tipli hata sinifi — gateway uzerinden yukariya firlatilir.
 * Kullaniciya gosterilecek mesaj Turkce olmali.
 */
export class ServiceError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly traceId: string

  constructor(
    message: string,
    options: {
      code: string
      statusCode?: number
      traceId: string
      cause?: unknown
    }
  ) {
    super(message, { cause: options.cause })
    this.name = 'ServiceError'
    this.code = options.code
    this.statusCode = options.statusCode ?? 500
    this.traceId = options.traceId
  }
}

/**
 * Servis metod imzasi — tum LogicService metodlari bu formata uyar.
 */
export type ServiceMethod = (
  traceId: string,
  payload: unknown,
  userId: string
) => Promise<unknown>

/**
 * LogicService arayuzu — her servis bu interface'i implement eder.
 * Metodlar string key ile cagrilir (ServiceBridge uzerinden).
 */
export interface LogicService {
  [methodName: string]: ServiceMethod | unknown
}
