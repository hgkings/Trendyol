// ----------------------------------------------------------------
// ServiceBridge — Katman 5
// Servis adi ile gercek servis ornegini eslestirir.
// Servisler arasi bagimliligi keser.
// FAZ4'te servisler register() ile kaydedilecek.
// ----------------------------------------------------------------

import type { LogicService, ServiceMethod, ServiceName } from './types'
import { ServiceError } from './types'

class ServiceBridge {
  private registry = new Map<ServiceName, LogicService>()

  /**
   * Servis kaydeder. FAZ4'te her LogicService burada kayit edilir.
   */
  register(name: ServiceName, instance: LogicService): void {
    this.registry.set(name, instance)
  }

  /**
   * Isimle servis bulur. Bulamazsa tipli hata firlatir.
   */
  resolve(name: ServiceName, traceId: string): LogicService {
    const service = this.registry.get(name)
    if (!service) {
      throw new ServiceError(`Servis bulunamadi: ${name}`, {
        code: 'SERVICE_NOT_FOUND',
        statusCode: 500,
        traceId,
      })
    }
    return service
  }

  /**
   * Servis metodunu cagirip sonuc dondurur.
   * Metod bulunamazsa veya fonksiyon degilse tipli hata firlatir.
   */
  async call(
    name: ServiceName,
    method: string,
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<unknown> {
    const service = this.resolve(name, traceId)

    const fn = service[method]
    if (typeof fn !== 'function') {
      throw new ServiceError(`Metod bulunamadi: ${name}.${method}`, {
        code: 'METHOD_NOT_FOUND',
        statusCode: 400,
        traceId,
      })
    }

    const serviceMethod = fn as ServiceMethod
    return serviceMethod.call(service, traceId, payload, userId)
  }

  /**
   * Kayitli servis sayisini dondurur (test/debug icin).
   */
  get size(): number {
    return this.registry.size
  }
}

export const serviceBridge = new ServiceBridge()
