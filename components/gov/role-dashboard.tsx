'use client'

import { useEffect, useMemo, useState } from 'react'
import { civicFetch } from '@/lib/client-api'
import { useAuth } from '@/components/auth-provider'
import type { AppRole } from '@/lib/roles'
import type { IssueRecord } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Clock3,
  FileClock,
  Flame,
  MapPinned,
  MessageSquareWarning,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react'

export type DashboardDestination = 'overview' | 'complaints' | 'gis' | 'analytics' | 'registry' | 'audit' | 'moderation' | 'privacy' | 'system'

type ModerationReport = {
  id: string
  reason?: string
  status?: string
  issue_id?: string | null
  comment_id?: string | null
  created_at?: string
}

type AuditEvent = {
  id: string
  action: string
  issue_id?: string | null
  created_at: string
}

type PrivacyRequest = { id: string; status: string; request_type: string; created_at: string }

type SystemHealth = {
  mode: string
  database: string
  serviceRole: boolean
  authProvider: string
  profileCount: number | null
  checkedAt: string
}

type Props = { role: Exclude<AppRole, 'citizen'>; onNavigate: (destination: DashboardDestination) => void }

const COPY: Record<Exclude<AppRole, 'citizen'>, { eyebrow: string; title: string; description: string }> = {
  moderator: {
    eyebrow: 'Community safety',
    title: 'Moderation desk',
    description: 'Review reported content fairly, preserve good-faith civic criticism, and track appeals through a documented decision.',
  },
  department_operator: {
    eyebrow: 'Department operations',
    title: 'My action queue',
    description: 'Work the civic issues routed to your department and PIN. Update assignment, status, notes and resolution evidence from each case.',
  },
  department_supervisor: {
    eyebrow: 'Department performance',
    title: 'Team operations',
    description: 'Monitor workload, service targets and escalations across your department, then open the queue or analytics for follow-up.',
  },
  authority_admin: {
    eyebrow: 'Jurisdiction operations',
    title: 'Ward command view',
    description: 'Coordinate departments, public routing, community hotspots and governance for your authorized jurisdiction.',
  },
  system_admin: {
    eyebrow: 'Platform operations',
    title: 'System administration',
    description: 'Check platform and database readiness, then route data-rights requests to the privacy workflow. Civic case content stays outside this role.',
  },
  auditor: {
    eyebrow: 'Independent oversight',
    title: 'Audit & compliance',
    description: 'Review a read-only governance trail for your authorized scope, including status, moderation, duplicate and privacy actions.',
  },
}

const CLOSED = new Set(['Resolved', 'Community Verified', 'Closed', 'Duplicate'])
const ACTIONS = new Set(['actioned', 'dismissed'])
const isLiveCanonicalIssue = (issue: IssueRecord) => !issue.isDemo && issue.status !== 'Duplicate' && !issue.duplicateOf && issue.duplicateDecision !== 'merged'

async function loadPayload(path: string) {
  const response = await civicFetch(path)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error ?? `Unable to load ${path}.`)
  return payload
}

function Metric({ label, value, caption, tone = 'text-cream', icon: Icon }: { label: string; value: string | number; caption: string; tone?: string; icon: typeof Activity }) {
  return <article className="rounded-xl border border-sidebar-border bg-sidebar-accent p-4 sm:p-5">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-cream/50">{label}</p>
      <Icon aria-hidden="true" className={cn('h-4 w-4', tone)} />
    </div>
    <p className={cn('mt-3 font-display text-3xl font-extrabold tabular-nums', tone)}>{value}</p>
    <p className="mt-1 text-[11px] leading-relaxed text-cream/45">{caption}</p>
  </article>
}

function Panel({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: { label: string; onClick: () => void } }) {
  return <section className="rounded-xl border border-sidebar-border bg-sidebar-accent p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-sm font-semibold text-cream">{title}</h2>{description && <p className="mt-1 text-xs leading-relaxed text-cream/50">{description}</p>}</div>
      {action && <button type="button" onClick={action.onClick} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-sidebar-border px-3 py-2 text-xs font-semibold text-gold transition hover:bg-sidebar">
        {action.label}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </button>}
    </div>
    <div className="mt-4">{children}</div>
  </section>
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-sidebar-border px-4 py-5 text-center text-xs leading-relaxed text-cream/45">{children}</p>
}

export function RoleDashboard({ role, onNavigate }: Props) {
  const { user } = useAuth()
  const [issues, setIssues] = useState<IssueRecord[]>([])
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([])
  const [system, setSystem] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const copy = COPY[role]
  const isIssueRole = role === 'department_operator' || role === 'department_supervisor' || role === 'authority_admin'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const jobs: Array<Promise<void>> = []
    const capture = <T,>(promise: Promise<T>, update: (value: T) => void) => jobs.push(
      promise.then((value) => { if (!cancelled) update(value) }).catch((reason) => {
        if (!cancelled) setError((current) => current || (reason instanceof Error ? reason.message : 'Some dashboard data could not be loaded.'))
      }),
    )

    if (isIssueRole) capture(loadPayload('/api/issues').then((payload) => Array.isArray(payload.issues) ? payload.issues as IssueRecord[] : []), setIssues)
    if (role === 'moderator') capture(loadPayload('/api/moderation').then((payload) => Array.isArray(payload.reports) ? payload.reports as ModerationReport[] : []), setReports)
    if (role === 'authority_admin' || role === 'auditor') capture(loadPayload('/api/audit').then((payload) => Array.isArray(payload.events) ? payload.events as AuditEvent[] : []), setEvents)
    if (role === 'system_admin') {
      capture(loadPayload('/api/system/health'), setSystem)
      capture(loadPayload('/api/privacy-requests').then((payload) => Array.isArray(payload.requests) ? payload.requests as PrivacyRequest[] : []), setPrivacyRequests)
    }

    void Promise.all(jobs).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isIssueRole, role])

  const now = Date.now()
  const openIssues = useMemo(() => issues.filter((issue) => !CLOSED.has(issue.status)), [issues])
  const overdue = openIssues.filter((issue) => Boolean(issue.slaDueAt && Date.parse(issue.slaDueAt) < now))
  const highPriority = openIssues.filter((issue) => issue.priority === 'Critical' || issue.priority === 'High')
  const resolved = issues.filter((issue) => ['Resolved', 'Community Verified', 'Closed'].includes(issue.status))
  const unassigned = openIssues.filter((issue) => !issue.officer || /unassigned|pending/i.test(issue.officer))
  const duplicateCount = issues.filter((issue) => issue.status === 'Duplicate' || issue.duplicateOf || issue.duplicateDecision === 'merged').length
  const syntheticCount = issues.filter((issue) => issue.isDemo).length
  const hottest = [...openIssues].filter(isLiveCanonicalIssue).sort((a, b) => ((b.chaiHeat ?? 0) + (b.priorityScore ?? 0) * 0.35 + b.reports * 2) - ((a.chaiHeat ?? 0) + (a.priorityScore ?? 0) * 0.35 + a.reports * 2)).slice(0, 4)
  const byStatus = openIssues.reduce<Record<string, number>>((counts, issue) => { counts[issue.status] = (counts[issue.status] ?? 0) + 1; return counts }, {})
  const pendingReports = reports.filter((report) => !ACTIONS.has(report.status ?? 'open'))
  const appeals = reports.filter((report) => report.status === 'appealed')
  const recentEvents = events.slice(0, 5)
  const sensitiveEvents = events.filter((event) => /moderation|duplicate\.(merged|unmerged)|override|privacy_request/i.test(event.action))
  const pendingPrivacy = privacyRequests.filter((request) => !['fulfilled', 'declined'].includes(request.status))

  const reportAttention = [...pendingReports].sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? '')).slice(0, 5)
  const actionQueue = [...openIssues].sort((a, b) => {
    const rank = (issue: IssueRecord) => (issue.priority === 'Critical' ? 3 : issue.priority === 'High' ? 2 : issue.priority === 'Moderate' ? 1 : 0) + (issue.slaDueAt && Date.parse(issue.slaDueAt) < now ? 4 : 0)
    return rank(b) - rank(a) || Date.parse(a.createdAt) - Date.parse(b.createdAt)
  }).slice(0, 5)
  const clusters = useMemo(() => {
    const currentStart = now - 7 * 86400000
    const previousStart = now - 14 * 86400000
    const counts = new Map<string, { current: number; previous: number }>()
    for (const issue of issues.filter(isLiveCanonicalIssue)) {
      const created = Date.parse(issue.createdAt)
      if (!Number.isFinite(created) || created < previousStart) continue
      const key = issue.locality || `PIN ${issue.pin}`
      const bucket = counts.get(key) ?? { current: 0, previous: 0 }
      if (created >= currentStart) bucket.current += 1
      else bucket.previous += 1
      counts.set(key, bucket)
    }
    return [...counts.entries()].map(([locality, value]) => ({ locality, ...value, change: value.current - value.previous })).sort((a, b) => b.change - a.change || b.current - a.current).slice(0, 5)
  }, [issues, now])

  const action = (label: string, destination: DashboardDestination) => ({ label, onClick: () => onNavigate(destination) })

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-sidebar-accent via-sidebar-accent to-terracotta/10 p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">{copy.eyebrow}</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-cream sm:text-3xl">{copy.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-cream/60">{copy.description}</p>
          <p className="mt-3 text-[11px] font-medium text-cream/40">{user?.department ? `${user.department} · ` : ''}{user?.pin ? `PIN ${user.pin}` : role === 'authority_admin' || role === 'auditor' ? 'Authorized jurisdiction scope' : 'Role-scoped workspace'}</p>
        </div>
        {role === 'department_operator' && <button type="button" onClick={() => onNavigate('complaints')} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-charcoal">Open my queue<ArrowRight aria-hidden="true" className="h-4 w-4" /></button>}
        {role === 'moderator' && <button type="button" onClick={() => onNavigate('moderation')} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-charcoal">Review reports<ArrowRight aria-hidden="true" className="h-4 w-4" /></button>}
      </div>
    </section>

    {error && <p role="status" className="rounded-lg border border-heat/30 bg-heat/10 p-3 text-xs leading-relaxed text-heat">{error}</p>}

    {isIssueRole && syntheticCount > 0 && <p className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-[11px] leading-relaxed text-gold">{syntheticCount} clearly labeled synthetic seed example{syntheticCount === 1 ? '' : 's'} included for dashboard walkthroughs. Synthetic records are excluded from live heat and locality trend signals.</p>}

    {role === 'moderator' && <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Needs review" value={loading ? '—' : pendingReports.length} caption="New reports and active reviews" tone="text-gold" icon={MessageSquareWarning} />
        <Metric label="Appeals" value={loading ? '—' : appeals.length} caption="Decisions citizens have appealed" tone="text-heat" icon={AlertTriangle} />
        <Metric label="Actioned" value={loading ? '—' : reports.filter((report) => report.status === 'actioned').length} caption="Content currently restricted" tone="text-terracotta" icon={ShieldCheck} />
        <Metric label="Dismissed" value={loading ? '—' : reports.filter((report) => report.status === 'dismissed').length} caption="Reports reviewed and closed" tone="text-leaf" icon={BadgeCheck} />
      </div>
      <Panel title="Review queue" description="Work reports in order, document the decision, and preserve appeal history." action={action('Open moderation desk', 'moderation')}>
        {loading ? <EmptyState>Loading community reports…</EmptyState> : reportAttention.length ? <div className="divide-y divide-sidebar-border">{reportAttention.map((report) => <article key={report.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="text-sm font-semibold capitalize text-cream">{(report.reason ?? 'other').replaceAll('_', ' ')} · {report.issue_id ? 'Civic issue' : report.comment_id ? 'Community comment' : 'Community content'}</p><p className="mt-1 text-[11px] text-cream/45">{report.status ?? 'open'} · {report.created_at ? new Date(report.created_at).toLocaleString() : 'Date unavailable'}</p></div><span className="rounded-full bg-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gold">{report.status ?? 'open'}</span></article>)}</div> : <EmptyState>No community reports need review. New reports and appeals will appear here.</EmptyState>}
      </Panel>
      <p className="text-[10px] leading-relaxed text-cream/35">Moderator access is limited to reported content and review actions. This workspace does not expose the administrative issue queue.</p>
    </>}

    {(role === 'department_operator' || role === 'department_supervisor') && <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label={role === 'department_operator' ? 'My open queue' : 'Open workload'} value={loading ? '—' : openIssues.length} caption="Open issues routed to this department and PIN" icon={ClipboardCheck} />
        <Metric label="Urgent" value={loading ? '—' : highPriority.length} caption="Critical and high-priority open issues" tone="text-heat" icon={AlertTriangle} />
        <Metric label="Past service target" value={loading ? '—' : overdue.length} caption="Only verified SLA targets are counted" tone="text-terracotta" icon={Clock3} />
        <Metric label="Unassigned" value={loading ? '—' : unassigned.length} caption="Open cases without an assigned officer" tone="text-gold" icon={Users} />
      </div>
      {role === 'department_supervisor' && <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="Department performance" description="Current status distribution in your assigned queue." action={action('Open analytics', 'analytics')}>
          {loading ? <EmptyState>Loading team workload…</EmptyState> : Object.keys(byStatus).length ? <div className="space-y-3">{Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => <div key={status}><div className="mb-1 flex justify-between text-xs"><span className="text-cream/65">{status}</span><span className="font-semibold text-cream">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-sidebar"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(5, count / Math.max(1, openIssues.length) * 100)}%` }} /></div></div>)}</div> : <EmptyState>No open workload in this department.</EmptyState>}
        </Panel>
        <Panel title="Escalation watch" description="Highest-priority and past-target cases for supervisor review." action={action('Open department queue', 'complaints')}>
          {loading ? <EmptyState>Loading escalations…</EmptyState> : actionQueue.length ? <div className="space-y-2">{actionQueue.slice(0, 4).map((issue) => <article key={issue.id} className="rounded-lg border border-sidebar-border bg-sidebar p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-cream">{issue.title}</p><p className="mt-1 text-[10px] text-cream/45">{issue.documentId} · {issue.locality} · {issue.status}</p></div><span className={cn('shrink-0 text-[10px] font-bold uppercase', issue.priority === 'Critical' ? 'text-heat' : issue.priority === 'High' ? 'text-terracotta' : 'text-gold')}>{issue.priority}</span></div></article>)}</div> : <EmptyState>No unresolved issues require escalation.</EmptyState>}
        </Panel>
      </div>}
      {role === 'department_operator' && <Panel title="Next cases to action" description="Urgency and verified overdue targets are considered before queue age." action={action('View and update cases', 'complaints')}>
        {loading ? <EmptyState>Loading your department queue…</EmptyState> : actionQueue.length ? <div className="space-y-2">{actionQueue.map((issue) => <article key={issue.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sidebar-border bg-sidebar p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-cream">{issue.title}</p><p className="mt-1 text-[10px] text-cream/45">{issue.documentId} · {issue.locality} · {issue.status}</p></div><div className="flex shrink-0 items-center gap-2"><span className="text-[10px] font-bold uppercase text-gold">{issue.priority}</span>{issue.slaDueAt && Date.parse(issue.slaDueAt) < now && <span className="rounded bg-heat/10 px-2 py-1 text-[9px] font-bold uppercase text-heat">Overdue</span>}</div></article>)}</div> : <EmptyState>Your assigned queue is clear. New routed cases will appear here.</EmptyState>}
      </Panel>}
      <p className="text-[10px] leading-relaxed text-cream/35">Issue details show citizen-submitted text, AI classification and confidence, evidence, score factors, duplicate review, verified routing references and the action timeline according to your role.</p>
    </>}

    {role === 'authority_admin' && <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
        <Metric label="All jurisdiction issues" value={loading ? '—' : issues.length} caption="Active and closed cases in your PIN scope" icon={ClipboardCheck} />
        <Metric label="High priority" value={loading ? '—' : highPriority.length} caption="Critical or high open issues" tone="text-heat" icon={AlertTriangle} />
        <Metric label="Overdue" value={loading ? '—' : overdue.length} caption="Beyond configured service targets" tone="text-terracotta" icon={Clock3} />
        <Metric label="Unassigned" value={loading ? '—' : unassigned.length} caption="Accepted open issues without owner" tone="text-gold" icon={Users} />
        <Metric label="Duplicate links" value={loading ? '—' : duplicateCount} caption="Reports linked to canonical cases" tone="text-leaf" icon={Activity} />
        <Metric label="Resolved" value={loading ? '—' : `${issues.length ? Math.round(resolved.length / issues.length * 100) : 0}%`} caption={`${resolved.length} resolved or community verified`} tone="text-leaf" icon={BadgeCheck} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Hottest Chai" description="A balanced signal combines community heat, priority and corroborating reports." action={action('Open issue queue', 'complaints')}>
          {loading ? <EmptyState>Loading jurisdiction signals…</EmptyState> : hottest.length ? <div className="space-y-2">{hottest.map((issue) => <article key={issue.id} className="flex items-center justify-between gap-3 rounded-lg border border-sidebar-border bg-sidebar p-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-cream">{issue.title}</p><p className="mt-1 text-[10px] text-cream/45">{issue.locality} · {issue.reports} reports · {issue.priority}</p></div><span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-terracotta"><Flame aria-hidden="true" className="h-3.5 w-3.5" />{issue.chaiHeat ?? 0}°</span></article>)}</div> : <EmptyState>No real community issues are available in this jurisdiction yet.</EmptyState>}
        </Panel>
        <Panel title="Rising issue clusters" description="New canonical reports by locality, comparing the last 7 days with the previous 7 days." action={action('View geographic hotspots', 'gis')}>
          {loading ? <EmptyState>Loading locality trends…</EmptyState> : clusters.length ? <div className="space-y-3">{clusters.map((cluster) => <div key={cluster.locality} className="flex items-center justify-between gap-3 rounded-lg bg-sidebar p-3"><div className="flex min-w-0 items-center gap-2"><MapPinned aria-hidden="true" className="h-4 w-4 shrink-0 text-gold" /><span className="truncate text-xs font-semibold text-cream">{cluster.locality}</span></div><span className="shrink-0 text-[10px] text-cream/55">{cluster.current} new · <b className={cluster.change > 0 ? 'text-terracotta' : 'text-cream/60'}>{cluster.change > 0 ? `+${cluster.change}` : cluster.change} vs prior week</b></span></div>)}</div> : <EmptyState>Recent issue reports will surface here as locality trends once the jurisdiction feed has activity.</EmptyState>}
        </Panel>
      </div>
      <Panel title="Jurisdiction control shortcuts" description="Continue into the administrative workflow for authorized departments, maps and public routing." >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Complaint queue', 'Triage, assign and update cases', 'complaints'],
            ['GIS hotspots', 'Explore privacy-safe heat layers', 'gis'],
            ['Reports & analytics', 'Compare queues and outcomes', 'analytics'],
            ['Officer & hub registry', 'Maintain source-verified routes', 'registry'],
          ].map(([title, detail, destination]) => <button key={destination} type="button" onClick={() => onNavigate(destination as DashboardDestination)} className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-sidebar-border bg-sidebar p-3 text-left transition hover:border-gold/40"><span><span className="block text-xs font-semibold text-cream">{title}</span><span className="mt-1 block text-[10px] text-cream/45">{detail}</span></span><ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-gold" /></button>)}
        </div>
      </Panel>
    </>}

    {role === 'system_admin' && <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Application mode" value={loading ? '…' : system?.mode === 'connected deployment' ? 'Connected' : 'Local preview'} caption={system?.authProvider ?? 'Checking authentication provider'} tone={system?.mode === 'connected deployment' ? 'text-leaf' : 'text-gold'} icon={Server} />
        <Metric label="Database" value={loading ? '…' : system?.database ?? 'Unknown'} caption="Server-side connectivity check" tone={system?.database === 'connected' ? 'text-leaf' : 'text-heat'} icon={Activity} />
        <Metric label="Service key" value={loading ? '…' : system?.serviceRole ? 'Ready' : 'Missing'} caption="Presence only; secret value is never returned" tone={system?.serviceRole ? 'text-leaf' : 'text-heat'} icon={ShieldCheck} />
        <Metric label="Privacy requests" value={loading ? '—' : pendingPrivacy.length} caption="Open data-rights requests requiring workflow" tone="text-gold" icon={FileClock} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Platform health" description="Safe infrastructure checks. System administration does not grant access to complaint content." action={action('Open system status', 'system')}>
          {loading ? <EmptyState>Checking platform health…</EmptyState> : system ? <dl className="space-y-3 text-xs">{[
            ['Runtime', system.mode], ['Database connection', system.database], ['Authentication', system.authProvider], ['Server key', system.serviceRole ? 'Configured' : 'Not configured'], ['Account profiles', system.profileCount == null ? 'Not available' : String(system.profileCount)], ['Last checked', new Date(system.checkedAt).toLocaleString()],
          ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-sidebar-border pb-2 last:border-0"><dt className="text-cream/50">{label}</dt><dd className="text-right font-medium text-cream">{value}</dd></div>)}</dl> : <EmptyState>System health information is unavailable.</EmptyState>}
        </Panel>
        <Panel title="Data-rights workflow" description="Access, correction, erasure and grievance requests with a recorded outcome." action={action('Review privacy requests', 'privacy')}>
          {loading ? <EmptyState>Loading privacy workflow…</EmptyState> : pendingPrivacy.length ? <div className="space-y-2">{pendingPrivacy.slice(0, 5).map((request) => <article key={request.id} className="flex items-center justify-between gap-3 rounded-lg bg-sidebar p-3"><span className="text-xs font-semibold capitalize text-cream">{request.request_type} request</span><span className="text-[10px] uppercase text-gold">{request.status}</span></article>)}</div> : <EmptyState>No open data-rights requests are waiting for review.</EmptyState>}
        </Panel>
      </div>
      <p className="text-[10px] leading-relaxed text-cream/35">This role is separated from civic case review. Platform health exposes configuration status and profile counts only, never secret values or issue records.</p>
    </>}

    {role === 'auditor' && <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Events in scope" value={loading ? '—' : events.length} caption="Most recent records returned for your jurisdiction" icon={Activity} />
        <Metric label="Last 24 hours" value={loading ? '—' : events.filter((event) => Date.parse(event.created_at) >= now - 86400000).length} caption="Recent governance activity" tone="text-gold" icon={Clock3} />
        <Metric label="Sensitive actions" value={loading ? '—' : sensitiveEvents.length} caption="Moderation, merge, override and rights events" tone="text-terracotta" icon={ShieldCheck} />
        <Metric label="Read-only access" value="Active" caption="Audit records are available without case controls" tone="text-leaf" icon={ClipboardCheck} />
      </div>
      <Panel title="Recent audit activity" description="Actor, action, object and timestamp provide a reviewable governance trail." action={action('Open full audit trail', 'audit')}>
        {loading ? <EmptyState>Loading authorized audit records…</EmptyState> : recentEvents.length ? <div className="divide-y divide-sidebar-border">{recentEvents.map((event) => <article key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="flex min-w-0 items-center gap-3"><Activity aria-hidden="true" className="h-4 w-4 shrink-0 text-gold" /><div className="min-w-0"><p className="truncate text-xs font-semibold text-cream">{event.action}</p><p className="mt-1 text-[10px] text-cream/45">{event.issue_id ? `Issue ${event.issue_id}` : 'Platform event'}</p></div></div><time className="shrink-0 text-[10px] text-cream/45">{new Date(event.created_at).toLocaleString()}</time></article>)}</div> : <EmptyState>No audit events are available in this authorized scope.</EmptyState>}
      </Panel>
      <p className="text-[10px] leading-relaxed text-cream/35">Auditor access is read-only and scope-limited. Citizen account details, private evidence and unrelated jurisdiction cases are not shown here.</p>
    </>}
  </div>
}

export function SystemHealthView() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [message, setMessage] = useState('Checking platform health…')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadPayload('/api/system/health').then((payload) => {
      if (!cancelled) { setHealth(payload as SystemHealth); setMessage('') }
    }).catch((reason) => {
      if (!cancelled) setMessage(reason instanceof Error ? reason.message : 'Platform status is unavailable.')
    })
    return () => { cancelled = true }
  }, [retry])

  return <div className="space-y-4">
    <section className="rounded-xl border border-sidebar-border bg-sidebar-accent p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-cream"><Server aria-hidden="true" className="h-4 w-4 text-gold" />Platform status</h2><p className="mt-2 max-w-2xl text-xs leading-relaxed text-cream/50">This view reports safe operational checks only. Secret values and civic issue data are never returned to the system administrator view.</p></div><button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-9 rounded-md border border-sidebar-border px-3 py-2 text-xs font-semibold text-gold">Refresh status</button></div>
      {message && <p role="status" className="mt-4 rounded-lg bg-sidebar p-3 text-xs text-cream/65">{message}</p>}
    </section>
    {health && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
      ['Runtime mode', health.mode], ['Database', health.database], ['Authentication', health.authProvider], ['Service role', health.serviceRole ? 'Configured' : 'Not configured'], ['Account profiles', health.profileCount == null ? 'Not available' : String(health.profileCount)], ['Last checked', new Date(health.checkedAt).toLocaleString()],
    ].map(([label, value]) => <article key={label} className="rounded-lg border border-sidebar-border bg-sidebar-accent p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-cream/45">{label}</p><p className="mt-2 text-sm font-semibold text-cream">{value}</p></article>)}</section>}
    <section className="rounded-xl border border-sidebar-border bg-sidebar-accent p-5"><h3 className="text-sm font-semibold text-cream">Access boundary</h3><p className="mt-2 text-xs leading-relaxed text-cream/55">Civic case records remain restricted to citizens for their own activity, assigned department staff for their queue, jurisdiction administrators for authorized PINs, and auditors for the approved audit trail.</p></section>
  </div>
}
