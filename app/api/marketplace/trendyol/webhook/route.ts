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
import type { ServiceName } from '@/lib/gateway/types'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.TRENDYOL_WEBHOOK_SECRET
    const signature = request.headers.get('x-signature')

    const body = await request.text()

    // Imza dogrulama (secret tanimliysaa)
    if (webhookSecret) {
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex')

      if (!signature || signature !== expectedSig) {
        return Response.json({ error: 'Gecersiz imza' }, { status: 401 })
      }
    }

    let payload: unknown
    try {
      payload = JSON.parse(body)
    } catch {
      // Gecersiz JSON — yine de 200 don
      return Response.json({ success: true }, { status: 200 })
    }

    await callGatewayV1Format('marketplace' as ServiceName, 'handleTrendyolWebhook', payload, 'webhook')
  } catch {
    // Trendyol 200 almazsa tekrar gonderir — hata olsa da 200 don
  }

  return Response.json({ success: true }, { status: 200 })
}
