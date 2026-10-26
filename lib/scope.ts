// Staff scope (SOP §15.1): an authority covers an area made of one or more PIN codes;
// department staff additionally only see their own department within that area.

type ScopedActor = { role?: string; pin?: string; servicePins?: string[]; department?: string } | null | undefined

/** Every PIN an account is responsible for: its primary PIN plus any extra service PINs. */
export function coveredPins(actor: ScopedActor) {
  return [...new Set([actor?.pin, ...(actor?.servicePins ?? [])].filter((pin): pin is string => typeof pin === 'string' && /^\d{6}$/.test(pin)))]
}

export function coversPin(actor: ScopedActor, pin: string) {
  return coveredPins(actor).includes(pin)
}

/** Whether issue-management staff may see and act on an issue. */
export function canSeeIssue(actor: ScopedActor, issue: { pin: string; department: string }) {
  if (actor?.role === 'authority_admin') return coversPin(actor, issue.pin)
  if (actor?.role === 'department_operator' || actor?.role === 'department_supervisor') {
    return Boolean(actor.department) && actor.department === issue.department && coversPin(actor, issue.pin)
  }
  return false
}
