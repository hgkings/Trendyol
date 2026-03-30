// ----------------------------------------------------------------
// GlobalService — Katman 4
// Istekleri dogru LogicService'e yonlendirir.
// Servisler arasi koordinasyonu saglar.
// Trace ID'yi her katmana tasir.
// ----------------------------------------------------------------

import { serviceBridge } from './service.bridge'
import type { ServiceName } from './types'
import { ServiceError } from './types'

class GlobalService {
  /**
   * Servisi ServiceBridge uzerinden cagirip sonucu dondurur.
   * Tum hatalar ServiceError'a cevrilerek firlatilir.
   */
  async callService(
    traceId: string,
    serviceName: ServiceName,
    method: string,
    payload: unknown,
    userId: string
  ): Promise<unknown> {
    try {
      const result = await serviceBridge.call(
        serviceName,
        method,
        traceId,
        payload,
        userId
      )
      return result
    } catch (error: unknown) {
      // Zaten ServiceError ise tekrar sarmala
      if (error instanceof ServiceError) {
        throw error
      }

      // Bilinmeyen hatalari ServiceError'a cevir
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
      throw new ServiceError(message, {
        code: 'SERVICE_CALL_FAILED',
        statusCode: 500,
        traceId,
        cause: error,
      })
    }
  }
}

export const globalService = new GlobalService()
