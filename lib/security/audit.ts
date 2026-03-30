// ----------------------------------------------------------------
// Audit Logger — tum onemli aksiyonlari loglar.
// Production'da audit_logs tablosuna yazar (fire-and-forget).
// ----------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'

export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.password_reset'
  | 'auth.oauth'
  | 'analysis.create'
  | 'analysis.update'
  | 'analysis.delete'
  | 'analysis.upsertFull'
  | 'analysis.list'
  | 'marketplace.connect'
  | 'marketplace.disconnect'
  | 'marketplace.sync'
  | 'marketplace.normalizeTrendyol'
  | 'marketplace.normalizeHepsiburada'
  | 'payment.create'
  | 'payment.callback'
  | 'payment.callback_failed'
  | 'payment.verify'
  | 'payment.listPayments'
  | 'payment.activatePaymentManually'
  | 'payment.checkPayment'
  | 'admin.activate_payment'
  | 'admin.user_update'
  | 'admin.stats_view'
  | 'admin.user_search'
  | 'support.ticket_create'
  | 'support.ticket_reply'
  | 'support.ticket_delete'
  | 'email.send'
  | 'user.delete_account'
  | 'user.profile_update'
  | 'user.checkProExpiry'
  | 'product.manualMatch'
  | 'product.bulkMatch'
  | 'security.cron_auth_fail'
  | 'security.rate_limit_hit'
  | 'security.webhook_invalid_sig'
  // Gateway generic — serviceName.method formatinda
  | string

interface AuditEntry {
  action: AuditAction
  userId: string | null
  traceId: string
  metadata?: Record<string, unknown>
  ip?: string
}

/**
 * Audit log kaydi olusturur.
 * DB'ye yazma fire-and-forget — hata olursa sessizce gecer.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  const logEntry = {
    action: entry.action,
    user_id: entry.userId,
    trace_id: entry.traceId,
    metadata: entry.metadata ?? {},
    ip: entry.ip ?? 'unknown',
    created_at: new Date().toISOString(),
  }

  try {
    const supabase = createAdminClient()
    await supabase.from('audit_logs').insert(logEntry)
  } catch {
    // Fire-and-forget: audit hatasi ana istegi bloklamamali
  }
}

/**
 * Trace ID uretir — her istegi takip etmek icin.
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `trc_${timestamp}_${random}`
}
