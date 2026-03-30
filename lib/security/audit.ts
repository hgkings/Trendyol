// ----------------------------------------------------------------
// Audit Logger — tum onemli aksiyonlari loglar.
// FAZ5'te repository katmani kurulunca DB'ye yazacak.
// Simdilik structured console output (development only).
// ----------------------------------------------------------------

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.password_reset'
  | 'analysis.create'
  | 'analysis.update'
  | 'analysis.delete'
  | 'marketplace.connect'
  | 'marketplace.disconnect'
  | 'marketplace.sync'
  | 'payment.create'
  | 'payment.callback'
  | 'admin.activate_payment'
  | 'admin.user_update'
  | 'support.ticket_create'
  | 'support.ticket_reply'
  | 'email.send'

interface AuditEntry {
  action: AuditAction
  userId: string | null
  traceId: string
  metadata?: Record<string, unknown>
  ip?: string
}

/**
 * Audit log kaydi olusturur.
 * FAZ5 sonrasi: audit_logs tablosuna yazilacak.
 * Simdilik: structured log (sadece development).
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action: entry.action,
    userId: entry.userId,
    traceId: entry.traceId,
    metadata: entry.metadata ?? {},
    ip: entry.ip ?? 'unknown',
  }

  // TODO(FAZ5): audit_logs tablosuna BaseRepository uzerinden yaz
  if (process.env.NODE_ENV === 'development') {
    console.info('[audit]', JSON.stringify(logEntry))
  }
}

/**
 * Trace ID uretir — her istegi takip etmek icin.
 * Format: trc_{timestamp}_{random}
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `trc_${timestamp}_${random}`
}
