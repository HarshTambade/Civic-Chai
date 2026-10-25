export const APP_ROLES = [
  'citizen',
  'moderator',
  'department_operator',
  'department_supervisor',
  'authority_admin',
  'system_admin',
  'auditor',
] as const

export type AppRole = (typeof APP_ROLES)[number]

export type AppUser = {
  id: string
  email: string
  name: string
  role: AppRole
  pin?: string
  department?: string
  demo?: boolean
}

export const ROLE_LABELS: Record<AppRole, string> = {
  citizen: 'Citizen',
  moderator: 'Moderator',
  department_operator: 'Department operator',
  department_supervisor: 'Department supervisor',
  authority_admin: 'Authority administrator',
  system_admin: 'System administrator',
  auditor: 'Auditor',
}

export const DEMO_ACCOUNTS: Array<AppUser & { password: string }> = [
  { id: 'demo-citizen', email: 'citizen@civicchai.local', password: 'CivicChai!2026', name: 'Riya Kulkarni', role: 'citizen', pin: '401208', demo: true },
  { id: 'demo-moderator', email: 'moderator@civicchai.local', password: 'CivicChai!2026', name: 'Asha Deshmukh', role: 'moderator', pin: '401208', demo: true },
  { id: 'demo-operator', email: 'operator@civicchai.local', password: 'CivicChai!2026', name: 'R. Kulkarni', role: 'department_operator', pin: '401208', department: 'Municipal Public Lighting', demo: true },
  { id: 'demo-supervisor', email: 'supervisor@civicchai.local', password: 'CivicChai!2026', name: 'S. Mehta', role: 'department_supervisor', pin: '401208', department: 'Municipal Public Lighting', demo: true },
  { id: 'demo-authority-admin', email: 'authority@civicchai.local', password: 'CivicChai!2026', name: 'Ward Authority Admin', role: 'authority_admin', pin: '401208', demo: true },
  { id: 'demo-system-admin', email: 'system-admin@civicchai.local', password: 'CivicChai!2026', name: 'CivicChai System Admin', role: 'system_admin', demo: true },
  { id: 'demo-auditor', email: 'auditor@civicchai.local', password: 'CivicChai!2026', name: 'Independent Auditor', role: 'auditor', pin: '401208', demo: true },
]

export const GOV_ROLES: AppRole[] = [
  'moderator',
  'department_operator',
  'department_supervisor',
  'authority_admin',
  'system_admin',
  'auditor',
]

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole)
}

export function canManageIssues(role: AppRole) {
  return ['department_operator', 'department_supervisor', 'authority_admin'].includes(role)
}

export function canManageRegistry(role: AppRole) {
  return role === 'authority_admin'
}

export function canModerate(role: AppRole) {
  return ['moderator', 'authority_admin'].includes(role)
}

export function canAudit(role: AppRole) {
  return role === 'auditor' || role === 'authority_admin'
}

export function requiresMfa(role: AppRole) {
  return role !== 'citizen'
}

/** True for the seeded shared demo identities (all on the reserved .local domain). */
export function isDemoAccountEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase()
  return Boolean(normalized && DEMO_ACCOUNTS.some((account) => account.email === normalized))
}
