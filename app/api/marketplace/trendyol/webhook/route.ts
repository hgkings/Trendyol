/**
 * Trendyol Webhook Receiver
 *
 * Trendyol bu endpoint'e siparis/iade olaylarini POST atar.
 * Kullanici oturumu yoktur — HMAC imzasi ile dogrulama yapilir.
 * Her durumda 200 doner (Trendyol 200 almazsa tekrar gonderir).
 *
 * TRENDYOL_WEBHOOK_SECRET env var ayarliysa HMAC-SHA256 imzasi dogrulanir.
 */

import { callGatewayV1Format } from '@/lib/api/helpers'
import { auditLog, generateTraceId } from '@/lib/security/audit'
import type { ServiceName } from '@/lib/gateway/types'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.TRENDYOL_WEBHOOK_SECRET
    if (!webhookSecret) {
      return Response.json({ error: 'Webhook yapilandirmasi eksik' }, { status: 500 })
    }

    const signature = request.headers.get('x-signature')
    const body = await request.text()

    // HMAC-SHA256 imza dogrulama (zorunlu)
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex')

    if (!signature || signature !== expectedSig) {
      void auditLog({
        action: 'security.webhook_invalid_sig',
        userId: null,
        traceId: generateTraceId(),
        metadata: { source: 'trendyol', signature: signature?.substring(0, 8) },
      })
      return Response.json({ error: 'Gecersiz imza' }, { status: 401 })
    }

    void auditLog({
      action: 'marketplace.sync',
      userId: null,
      traceId: generateTraceId(),
      metadata: { source: 'trendyol_webhook' },
    })

    let payload: unknown
    try {
      payload = JSON.parse(body)
    } catch (_parseError) {
      // Gecersiz JSON — yine de 200 don
      return Response.json({ success: true }, { status: 200 })
    }

    await callGatewayV1Format('marketplace' as ServiceName, 'handleTrendyolWebhook', payload, 'webhook')
  } catch (_webhookError) {
    // Trendyol 200 almazsa tekrar gonderir — hata olsa da 200 don
  }

  return Response.json({ success: true }, { status: 200 })
}
