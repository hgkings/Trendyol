import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog, generateTraceId } from '@/lib/security/audit'
import crypto from 'crypto'

interface AuthUser {
  id: string
  email: string
}

/**
 * Authenticated user'i dondurur veya null.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user || !user.email) return null

  return { id: user.id, email: user.email }
}

/**
 * Auth zorunlu — user yoksa 401 Response dondurur.
 */
export async function requireAuth(): Promise<AuthUser | Response> {
  const user = await getAuthUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return user
}

/**
 * Admin zorunlu — profiles.plan !== 'admin' ise 403 dondurur.
 */
export async function requireAdmin(): Promise<AuthUser | Response> {
  const result = await requireAuth()
  if (result instanceof Response) return result

  const adminClient = createAdminClient()
  const { data: profile, error } = await adminClient
    .from('profiles')
    .select('plan')
    .eq('id', result.id)
    .single()

  const profileData = profile as { plan: string } | null
  if (error || !profileData || profileData.plan !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return result
}

/**
 * Cron secret dogrulama — Authorization header'i CRON_SECRET ile karsilastirir.
 */
export function requireCronSecret(request: Request): true | Response {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  // Replay attack korunmasi: x-cron-timestamp header'i varsa 60 saniye icinde olmali
  const timestampHeader = request.headers.get('x-cron-timestamp')
  if (timestampHeader) {
    const ts = parseInt(timestampHeader, 10)
    if (isNaN(ts) || Math.abs(Date.now() - ts) > 60_000) {
      return Response.json({ error: 'Request expired' }, { status: 401 })
    }
  }

  const expected = `Bearer ${cronSecret}`
  if (!cronSecret || !authHeader || authHeader.length !== expected.length
    || !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
    void auditLog({
      action: 'security.cron_auth_fail',
      userId: null,
      traceId: generateTraceId(),
      ip: request.headers.get('x-forwarded-for') ?? 'unknown',
    })
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return true
}

/**
 * Kullanıcının belirli marketplace için aktif bağlantı ID'sini bulur.
 * Her kullanıcının her marketplace'de max 1 bağlantısı vardır (UNIQUE constraint).
 * connectionId route'larda gereklidir ancak UI tarafından gönderilmez.
 */
export async function resolveConnectionId(
  userId: string,
  marketplace: 'trendyol' | 'hepsiburada'
): Promise<string | Response> {
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('marketplace_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('marketplace', marketplace)
    .eq('status', 'connected')
    .single()

  if (error || !data) {
    return Response.json(
      { error: `${marketplace === 'trendyol' ? 'Trendyol' : 'Hepsiburada'} bağlantısı bulunamadı. Önce mağaza bağlantısını kurun.` },
      { status: 404 }
    )
  }

  return data.id as string
}

// Gateway singleton — ilk cagride import edilir, sonra cache'lenir
let _gatewayReady = false
async function ensureGateway() {
  if (_gatewayReady) return
  const { initializeServices } = await import('@/services/registry')
  initializeServices()
  _gatewayReady = true
}

/**
 * Gateway uzerinden servis cagirip V1 formatinda (data direkt) dondurur.
 */
export async function callGatewayV1Format(
  serviceName: import('@/lib/gateway/types').ServiceName,
  method: string,
  payload: unknown,
  userId: string
): Promise<Response> {
  await ensureGateway()
  const { gateway } = await import('@/lib/gateway/gateway.adapter')
  const result = await gateway.handle(serviceName, method, payload, userId)

  if (!result.success) {
    return Response.json(
      { error: result.error ?? 'İşlem başarısız' },
      { status: 400 }
    )
  }

  return Response.json(result.data)
}

/**
 * Gateway uzerinden servis cagirip V2 formatinda ({success, data, traceId}) dondurur.
 */
export async function callGateway(
  serviceName: import('@/lib/gateway/types').ServiceName,
  method: string,
  payload: unknown,
  userId: string
): Promise<Response> {
  await ensureGateway()
  const { gateway } = await import('@/lib/gateway/gateway.adapter')
  const result = await gateway.handle(serviceName, method, payload, userId)

  if (!result.success) {
    return Response.json(
      { success: false, error: result.error, traceId: result.traceId },
      { status: 400 }
    )
  }

  return Response.json({
    success: true,
    data: result.data,
    traceId: result.traceId,
  })
}

/**
 * Genel 500 hata response'u dondurur.
 */
export function errorResponse(error: unknown): Response {
  const message =
    error instanceof Error ? error.message : 'Beklenmeyen bir hata olustu'
  return Response.json(
    { error: 'Sunucu hatasi', message },
    { status: 500 }
  )
}

/**
 * IP adresini request header'larindan cikarir.
 */
export function getIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}
