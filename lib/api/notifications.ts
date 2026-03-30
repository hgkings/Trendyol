import { Notification } from '@/types'

export async function getNotifications(): Promise<Notification[]> {
  const res = await fetch('/api/notifications')
  if (!res.ok) return []
  const json = await res.json()
  // Gateway { success, data } veya direkt array dönebilir
  const rows = Array.isArray(json) ? json : (json.data ?? [])
  return rows as Notification[]
}

export async function upsertNotifications(notifications: Partial<Notification>[]): Promise<void> {
  if (notifications.length === 0) return
  await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notifications),
  })
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await fetch('/api/notifications/read-all', { method: 'PATCH' })
}
