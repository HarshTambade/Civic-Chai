export type AuditEntry = {
  id: string
  issue_id?: string
  actor_id?: string
  action: string
  details: Record<string, unknown>
  created_at: string
}

const KEY = '__civicchai_audit_store__'

function store() {
  const globalScope = globalThis as typeof globalThis & { [KEY]?: AuditEntry[] }
  if (!globalScope[KEY]) globalScope[KEY] = []
  return globalScope[KEY]!
}

export function recordFallbackAudit(action: string, issueId?: string, actorId?: string, details: Record<string, unknown> = {}) {
  store().unshift({ id: crypto.randomUUID(), issue_id: issueId, actor_id: actorId, action, details, created_at: new Date().toISOString() })
}

export function getFallbackAudit() {
  return store().slice(0, 200)
}
