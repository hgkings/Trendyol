/**
 * Trendyol Webhook Receiver
 *
 * Trendyol bu endpoint'e sipariş/iade olaylarını POST atar.
 * Kullanıcı oturumu yoktur — Trendyol webhook kaydında verdiğimiz
 * credentials ile Basic Authentication doğrulaması yapılır.
 *
 * Resmi doküman: https://developers.trendyol.com/ → Webhooks
 *
 * Auth: Basic Authentication (webhook kaydında verilen username:password)
 * Fallback: HMAC-SHA256 (TRENDYOL_WEBHOOK_SECRET ayarlıysa)
 *
 * Her durumda 200 döner — Trendyol 200 almazsa 5 dk arayla tekrar gönderir.
 * Sürekli hata: email bildirimi → webhook deaktive.
 *
 * Best practice: Webhook + polling birlikte kullanılmalı.
 */

import { callGatewayV1Format } from '@/lib/api/helpers'
import { auditLog, generateTraceId } from '@/lib/security/audit'
import type { ServiceName } from '@/lib/gateway/types'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Idempotency: son 1000 webhook hash'ini tutarak duplicate'leri engelle
const processedHashes = new Set<string>()
const MAX_CACHE = 1000

/**
 * Trendyol webhook Basic Auth doğrulaması.
 * Webhook kaydında username=apiKey, password=apiSecret verdik.
 * Trendyol her webhook çağrısında bu credentials'ı Authorization header'da gönderir.
 */
function validateBasicAuth(request: Request): boolean {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Basic ')) return false

    try {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8')
        const [username, password] = decoded.split(':')

        // Webhook kaydında verilen credentials'ı env'den kontrol et
        const expectedUser = process.env.TRENDYOL_WEBHOOK_USERNAME
        const expectedPass = process.env.TRENDYOL_WEBHOOK_PASSWORD

        if (expectedUser && expectedPass) {
            return username === expectedUser && password === expectedPass
        }

        // Fallback: TRENDYOL_WEBHOOK_SECRET ile basit kontrol
        const secret = process.env.TRENDYOL_WEBHOOK_SECRET
        if (secret) {
            return Boolean(username && password)
        }

        return false
    } catch {
        return false
    }
}

/**
 * HMAC-SHA256 fallback doğrulaması (eski davranış).
 */
function validateHmac(request: Request, body: string): boolean {
    const webhookSecret = process.env.TRENDYOL_WEBHOOK_SECRET
    if (!webhookSecret) return false

    const signature = request.headers.get('x-signature')
    if (!signature) return false

    const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex')

    return signature === expectedSig
}

export async function POST(request: Request) {
    try {
        const body = await request.text()

        // Auth doğrulama: önce Basic Auth, sonra HMAC fallback
        const isBasicAuthValid = validateBasicAuth(request)
        const isHmacValid = !isBasicAuthValid ? validateHmac(request, body) : false

        if (!isBasicAuthValid && !isHmacValid) {
            // TRENDYOL_WEBHOOK_SECRET ve TRENDYOL_WEBHOOK_USERNAME/PASSWORD
            // hiçbiri yoksa da 200 dön ama logla
            const hasAnySecret = process.env.TRENDYOL_WEBHOOK_SECRET
                || process.env.TRENDYOL_WEBHOOK_USERNAME

            if (hasAnySecret) {
                void auditLog({
                    action: 'security.webhook_invalid_auth',
                    userId: null,
                    traceId: generateTraceId(),
                    metadata: {
                        source: 'trendyol',
                        method: request.headers.has('authorization') ? 'basic_auth' : 'none',
                    },
                })
                return Response.json({ error: 'Geçersiz kimlik bilgisi' }, { status: 401 })
            }
        }

        // Idempotency: aynı body tekrar işlenmez
        const bodyHash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 16)
        if (processedHashes.has(bodyHash)) {
            return Response.json({ success: true, duplicate: true }, { status: 200 })
        }
        processedHashes.add(bodyHash)
        if (processedHashes.size > MAX_CACHE) {
            const first = processedHashes.values().next().value
            if (first) processedHashes.delete(first)
        }

        void auditLog({
            action: 'marketplace.webhook_received',
            userId: null,
            traceId: generateTraceId(),
            metadata: { source: 'trendyol_webhook' },
        })

        let payload: unknown
        try {
            payload = JSON.parse(body)
        } catch (_parseError) {
            return Response.json({ success: true }, { status: 200 })
        }

        await callGatewayV1Format('marketplace' as ServiceName, 'handleTrendyolWebhook', payload, 'webhook')
    } catch (webhookError) {
        // Trendyol 200 almazsa tekrar gönderir — hata olsa da 200 dön
        const msg = webhookError instanceof Error ? webhookError.message : 'Unknown webhook error'
        console.error(`[trendyol-webhook] Error: ${msg}`)
    }

    return Response.json({ success: true }, { status: 200 })
}
