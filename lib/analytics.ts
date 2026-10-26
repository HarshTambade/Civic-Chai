import type { IssueRecord } from '@/lib/types'

// Operational KPIs from the SOP (§17) and Chai Heat integrity signals (§2.2, §15).

export type StatusEvent = { issue_id: string; new_status: string; created_at: string }
export type SupportEvent = { issue_id: string; created_at: string }

const ACKNOWLEDGED = new Set(['Acknowledged', 'Assigned', 'In Progress', 'Resolved', 'Community Verified', 'Closed'])
const ASSIGNED = new Set(['Assigned', 'In Progress', 'Resolved', 'Community Verified', 'Closed'])
const RESOLVED = new Set(['Resolved', 'Community Verified', 'Closed'])
const HOUR = 3_600_000

export function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  return Math.round(value * 10) / 10
}

const share = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)

/** Hours from filing to the first status in `stages`, per issue that reached it. */
function hoursToStage(issues: IssueRecord[], firstReached: Map<string, Map<string, number>>, stages: Set<string>) {
  const hours: number[] = []
  for (const issue of issues) {
    const reached = firstReached.get(issue.id)
    if (!reached) continue
    const times = [...reached.entries()].filter(([status]) => stages.has(status)).map(([, at]) => at)
    if (!times.length) continue
    const elapsed = (Math.min(...times) - Date.parse(issue.createdAt)) / HOUR
    if (elapsed >= 0) hours.push(elapsed)
  }
  return hours
}

export function buildAnalytics(issues: IssueRecord[], events: StatusEvent[], supports: SupportEvent[], now = Date.now()) {
  const live = issues.filter((issue) => !issue.isDemo)
  const firstReached = new Map<string, Map<string, number>>()
  for (const event of events) {
    const at = Date.parse(event.created_at)
    if (!Number.isFinite(at)) continue
    const reached = firstReached.get(event.issue_id) ?? new Map<string, number>()
    if (!reached.has(event.new_status) || at < reached.get(event.new_status)!) reached.set(event.new_status, at)
    firstReached.set(event.issue_id, reached)
  }

  const canonical = live.filter((issue) => issue.status !== 'Duplicate')
  const totalReports = live.reduce((sum, issue) => sum + Math.max(1, issue.reports), 0)
  const consolidated = live.filter((issue) => issue.status === 'Duplicate').length + canonical.reduce((sum, issue) => sum + Math.max(0, issue.reports - 1), 0)
  const open = canonical.filter((issue) => !RESOLVED.has(issue.status))

  const departments = [...new Set(canonical.map((issue) => issue.department))].sort().map((department) => {
    const scoped = canonical.filter((issue) => issue.department === department)
    return {
      department,
      total: scoped.length,
      open: scoped.filter((issue) => !RESOLVED.has(issue.status)).length,
      resolved: scoped.filter((issue) => RESOLVED.has(issue.status)).length,
      medianHoursToResolve: median(hoursToStage(scoped, firstReached, RESOLVED)),
    }
  })

  const channels = Object.entries(live.reduce<Record<string, number>>((counts, issue) => {
    const channel = issue.sourceChannel ?? 'web'
    counts[channel] = (counts[channel] ?? 0) + 1
    return counts
  }, {})).map(([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count)

  // Repeat issues: the same category reported 3+ times in one locality within 90 days.
  const recent = canonical.filter((issue) => now - Date.parse(issue.createdAt) <= 90 * 24 * HOUR)
  const repeatMap = new Map<string, { locality: string; pin: string; category: string; count: number }>()
  for (const issue of recent) {
    const key = `${issue.pin}|${issue.locality.toLowerCase()}|${issue.category}`
    const entry = repeatMap.get(key) ?? { locality: issue.locality, pin: issue.pin, category: issue.category, count: 0 }
    entry.count += 1
    repeatMap.set(key, entry)
  }

  const supportsByIssue = new Map<string, { day: number; week: number }>()
  for (const support of supports) {
    const age = now - Date.parse(support.created_at)
    if (!Number.isFinite(age)) continue
    const entry = supportsByIssue.get(support.issue_id) ?? { day: 0, week: 0 }
    if (age <= 24 * HOUR) entry.day += 1
    if (age <= 7 * 24 * HOUR) entry.week += 1
    supportsByIssue.set(support.issue_id, entry)
  }
  const trending = open.map((issue) => {
    const recentSupport = supportsByIssue.get(issue.id) ?? { day: 0, week: 0 }
    const flags: string[] = []
    // Integrity signals only flag for human review; they never change scores or hide issues.
    if (recentSupport.day >= 10 && recentSupport.day >= issue.supporters * 0.6 && now - Date.parse(issue.createdAt) > 48 * HOUR) flags.push('Sudden support spike in the last 24 hours')
    if (issue.supporters >= 25 && issue.reports <= 1) flags.push('High support with no independent corroborating reports')
    return { id: issue.id, documentId: issue.documentId, title: issue.title, locality: issue.locality, chaiHeat: issue.chaiHeat, priorityScore: issue.priorityScore ?? 0, supporters: issue.supporters, reports: issue.reports, supportLast24h: recentSupport.day, supportLast7d: recentSupport.week, flags }
  }).sort((a, b) => b.supportLast7d - a.supportLast7d || b.chaiHeat - a.chaiHeat).slice(0, 8)

  const current = new Date(now)
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(current.getFullYear(), current.getMonth() - 11 + index, 1)
    return {
      month: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
      count: live.filter((issue) => { const created = new Date(issue.createdAt); return created.getFullYear() === month.getFullYear() && created.getMonth() === month.getMonth() }).length,
    }
  })

  return {
    monthly,
    totals: { issues: canonical.length, open: open.length, resolved: canonical.length - open.length, syntheticExcluded: issues.length - live.length },
    kpis: {
      medianHoursToAcknowledge: median(hoursToStage(canonical, firstReached, ACKNOWLEDGED)),
      medianHoursToAssign: median(hoursToStage(canonical, firstReached, ASSIGNED)),
      medianHoursToResolve: median(hoursToStage(canonical, firstReached, RESOLVED)),
      duplicateReductionPercent: share(consolidated, totalReports),
      evidenceBackedPercent: share(canonical.filter((issue) => issue.hasEvidence).length, canonical.length),
      communityVerifiedPercent: share(canonical.filter((issue) => issue.status === 'Community Verified' || issue.status === 'Closed').length, Math.max(1, canonical.length - open.length)),
    },
    departments,
    channels,
    repeatIssues: [...repeatMap.values()].filter((entry) => entry.count >= 3).sort((a, b) => b.count - a.count).slice(0, 8),
    trending,
  }
}

export type AnalyticsReport = ReturnType<typeof buildAnalytics>
