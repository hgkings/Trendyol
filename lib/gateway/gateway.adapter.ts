// ----------------------------------------------------------------
// GatewayAdapter — Katman 3
// Tum API istekleri buradan gecer.
// Trace ID uretir, rate limit kontrol eder, audit loglar.
// GlobalService'e yonlendirir.
// ----------------------------------------------------------------

import { generateTraceId, auditLog } from '@/lib/security/audit'
import { checkRateLimit } from '@/lib/security/rate-limit'
import type { RateLimitType } from '@/lib/security/rate-limit'
import { globalService } from './global.service'
import type { GatewayResponse, ServiceName } from './types'
import { ServiceError, SERVICE_RATE_LIMIT_MAP } from './types'

class GatewayAdapter {
  /**
   * Ana giris noktasi — API route'lar bunu cagirır.
   * 1. Trace ID uretir
   * 2. Rate limit kontrol eder
   * 3. GlobalService'e yonlendirir
   * 4. Audit log kaydeder
   * 5. Standart GatewayResponse dondurur
   */
  async handle<T = unknown>(
    serviceName: ServiceName,
    method: string,
    payload: unknown,
    userId: string,
    options?: {
      rateLimitType?: RateLimitType
      rateLimitIdentifier?: string
    }
  ): Promise<GatewayResponse<T>> {
    const traceId = generateTraceId()

    try {
      // Rate limit kontrolu
      const limitType = options?.rateLimitType ?? SERVICE_RATE_LIMIT_MAP[serviceName]
      const limitIdentifier = options?.rateLimitIdentifier ?? userId

      const rateCheck = await checkRateLimit(limitType, limitIdentifier)
      if (!rateCheck.success) {
        throw new ServiceError('Cok fazla istek gonderdiniz. Lutfen bekleyin.', {
          code: 'RATE_LIMIT_EXCEEDED',
          statusCode: 429,
          traceId,
        })
      }

      // GlobalService'e yonlendir
      const result = await globalService.callService(
        traceId,
        serviceName,
        method,
        payload,
        userId
      )

      // Audit log — fire-and-forget (await yok, response'u yavaşlatmaz)
      void auditLog({
        action: `${serviceName}.${method}` as Parameters<typeof auditLog>[0]['action'],
        userId,
        traceId,
        metadata: { method },
      }).catch(() => {
        // Audit log hatasi istegi engellememeli
      })

      return {
        success: true,
        data: result as T,
        error: null,
        traceId,
      }
    } catch (error: unknown) {
      // Audit log — fire-and-forget
      void auditLog({
        action: `${serviceName}.${method}` as Parameters<typeof auditLog>[0]['action'],
        userId,
        traceId,
        metadata: {
          method,
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        },
      }).catch(() => {
        // Audit log hatasi istegi engellememeli
      })

      // ServiceError ise bilgileri koru
      if (error instanceof ServiceError) {
        return {
          success: false,
          data: null,
          error: error.message,
          traceId: error.traceId,
        }
      }

      // Bilinmeyen hata
      return {
        success: false,
        data: null,
        error: 'Beklenmeyen bir hata olustu. Lutfen tekrar deneyin.',
        traceId,
      }
    }
  }
}

export const gateway = new GatewayAdapter()
