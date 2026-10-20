export type CivicNotification = {
  id: string
  user_id: string
  issue_id: string | null
  kind: string
  title: string
  body: string
  read_at: string | null
  created_at: string
}

const STORE_KEY = '__civicchai_notification_store__'

function fallbackStore() {
  const root = globalThis as typeof globalThis & { [STORE_KEY]?: CivicNotification[] }
  if (!root[STORE_KEY]) root[STORE_KEY] = []
  return root[STORE_KEY]!
}

export function listFallbackNotifications(userId: string) {
  return fallbackStore().filter((item) => item.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function addFallbackNotification(input: Omit<CivicNotification, 'id' | 'created_at' | 'read_at'>) {
  const notification: CivicNotification = { ...input, id: `local-notification-${crypto.randomUUID()}`, read_at: null, created_at: new Date().toISOString() }
  fallbackStore().unshift(notification)
  return notification
}

export function markFallbackNotificationsRead(userId: string, ids?: string[]) {
  const selected = ids ? new Set(ids) : null
  const now = new Date().toISOString()
  for (const notification of fallbackStore()) {
    if (notification.user_id === userId && !notification.read_at && (!selected || selected.has(notification.id))) notification.read_at = now
  }
  return listFallbackNotifications(userId)
}
