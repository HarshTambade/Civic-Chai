'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useMap as useMapHook } from 'react-leaflet'
import { cn } from '@/lib/utils'
import { civicFetch } from '@/lib/client-api'
import { useAuth } from '@/components/auth-provider'
import { canManageIssues, canManageRegistry, canModerate, ROLE_LABELS } from '@/lib/roles'
import type { IssueRecord } from '@/lib/types'
import type { AppRole } from '@/lib/roles'
import type { HeatmapData, HeatmapMetric } from '@/lib/heatmap'
import { HeatmapCanvas } from '@/components/gov/heatmap-canvas'
import { PriorityBadge, StatusBadge, TrustBadge } from '@/components/brand/badges'
import { ChaiHeatMeter } from '@/components/brand/chai-heat-meter'
import { CivicTimeline } from '@/components/brand/civic-timeline'
import {
  TriangleAlert,
  Clock,
  CircleCheck,
  Layers,
  Search,
  MapPin,
  ShieldCheck,
  History,
  ShieldAlert,
} from 'lucide-react'
const MapContainer = dynamic(
  async () => (await import('react-leaflet')).MapContainer,
  { ssr: false },
)
const TileLayer = dynamic(
  async () => (await import('react-leaflet')).TileLayer,
  { ssr: false },
)

/* ---------------- Overview ---------------- */
export function OverviewView() {
  const [issues, setIssues] = useState<IssueRecord[]>([])
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    let cancelled = false
    civicFetch('/api/issues').then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load issue metrics.'))).then((payload) => {
      if (!cancelled) setIssues(Array.isArray(payload.issues) ? payload.issues : [])
    }).catch((error) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load issue metrics.') })
    return () => { cancelled = true }
  }, [])
  const open = issues.filter((issue) => !['Resolved', 'Community Verified', 'Closed', 'Duplicate'].includes(issue.status))
  const critical = issues.filter((issue) => issue.priority === 'Critical').length
  const high = issues.filter((issue) => issue.priority === 'High').length
  const unassigned = open.filter((issue) => !issue.officer || /unassigned|pending/i.test(issue.officer)).length
  const inProgress = issues.filter((issue) => issue.status === 'In Progress').length
  const resolved = issues.filter((issue) => ['Resolved', 'Community Verified', 'Closed'].includes(issue.status)).length
  const duplicates = issues.filter((issue) => issue.status === 'Duplicate').length
  const overdue = issues.filter((issue) => issue.slaDueAt && new Date(issue.slaDueAt).getTime() < Date.now() && !['Resolved', 'Community Verified', 'Closed'].includes(issue.status)).length
  const stats = [
    { k: 'Total issues', v: issues.length.toLocaleString('en-IN'), icon: Layers, tone: 'text-cream' },
    { k: 'Critical', v: critical.toLocaleString('en-IN'), icon: TriangleAlert, tone: 'text-heat' },
    { k: 'High priority', v: high.toLocaleString('en-IN'), icon: TriangleAlert, tone: 'text-terracotta' },
    { k: 'Unassigned', v: unassigned.toLocaleString('en-IN'), icon: Clock, tone: 'text-gold' },
    { k: 'In progress', v: inProgress.toLocaleString('en-IN'), icon: Clock, tone: 'text-gold' },
    { k: 'Overdue (configured SLA)', v: overdue.toLocaleString('en-IN'), icon: Clock, tone: 'text-heat' },
    { k: 'Resolved', v: resolved.toLocaleString('en-IN'), icon: CircleCheck, tone: 'text-leaf' },
    { k: 'Duplicate issues linked', v: duplicates.toLocaleString('en-IN'), icon: Layers, tone: 'text-leaf' },
  ]
  const deptLoads = [...new Set(open.map((issue) => issue.department))].map((name) => ({ name, count: open.filter((issue) => issue.department === name).length })).sort((a, b) => b.count - a.count).slice(0, 6)
  const maxLoad = Math.max(1, ...deptLoads.map((item) => item.count))
  return (
    <div className="space-y-6">
      {loadError && <p role="status" className="rounded-lg border border-heat/30 bg-heat/10 p-3 text-sm text-heat">{loadError}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.k}
            className="rounded-lg border border-sidebar-border bg-sidebar-accent p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-cream/50">
                {s.k}
              </span>
              <s.icon className={cn('h-4 w-4', s.tone)} />
            </div>
            <p className={cn('mt-2 font-display text-2xl font-extrabold', s.tone)}>
              {s.v}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent p-5">
          <h3 className="text-sm font-semibold text-cream">
            Department load (open issues)
          </h3>
          <ul className="mt-4 space-y-3">
            {deptLoads.map(({ name, count }) => {
              const pct = Math.round((count / maxLoad) * 100)
              return (
              <li key={name}>
                <div className="mb-1 flex items-center justify-between text-xs text-cream/70">
                  <span>{name}</span>
                  <span className="font-semibold text-cream">{count} open · {pct}% of largest queue</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-sidebar-border">
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
              )
            })}
            {deptLoads.length === 0 && <li className="text-xs text-cream/50">No open issues in this jurisdiction.</li>}
          </ul>
        </div>

        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent p-5">
          <h3 className="text-sm font-semibold text-cream">
            Priority model — how it&apos;s scored
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-cream/60">
            Priority is never raw votes. It combines severity, community support
            (Chai Heat), persistence, geographic impact, evidence confidence and
            SLA factors.
          </p>
          <div className="mt-4 space-y-2 text-xs">
            {[
              ['Severity / urgency', 25],
              ['Community support', 25],
              ['Independent reports', 15],
              ['Persistence', 10],
              ['Geographic impact', 10],
              ['Evidence quality', 10],
              ['Configured SLA', 5],
            ].map(([label, w]) => (
              <div key={label as string} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-cream/70">{label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sidebar-border">
                  <div
                    className="h-full bg-terracotta"
                    style={{ width: `${(w as number) * 2.6}%` }}
                  />
                </div>
                <span className="w-8 text-right text-cream/60">{w as number}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Complaints table ---------------- */
export function ComplaintsView() {
  const { user } = useAuth()
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [issues, setIssues] = useState<IssueRecord[]>([])
  const [filters, setFilters] = useState({ state: '', district: '', municipality: '', ward: '', department: '', category: '', pin: '', locality: '', priority: '', status: '', source: '', trust: '', sla: '', period: '' })

  async function loadIssues() {
    const res = await civicFetch('/api/issues')
    if (!res.ok) throw new Error('Unable to load complaint queue.')
    const payload = await res.json()
    const rows = Array.isArray(payload?.issues) ? payload.issues as IssueRecord[] : []
    setIssues(rows)
    setSelected((current) => current && rows.some((issue) => issue.id === current) ? current : rows[0]?.id ?? null)
  }

  useEffect(() => {
    let cancelled = false

    civicFetch('/api/issues')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Failed')))
      .then((payload) => { if (!cancelled && Array.isArray(payload?.issues)) { setIssues(payload.issues); if (payload.issues[0]) setSelected(payload.issues[0].id) } })
      .catch(() => {
        if (!cancelled) setIssues([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const now = Date.now()
  const rows = issues.filter((i) =>
    `${i.title} ${i.description} ${i.documentId} ${i.locality}`.toLowerCase().includes(query.toLowerCase()) &&
    (!filters.department || i.department === filters.department) &&
    (!filters.state || i.state === filters.state) &&
    (!filters.district || i.district === filters.district) &&
    (!filters.municipality || i.municipality === filters.municipality) &&
    (!filters.ward || i.ward === filters.ward) &&
    (!filters.category || i.category === filters.category) &&
    (!filters.pin || i.pin === filters.pin) &&
    (!filters.locality || i.locality === filters.locality) &&
    (!filters.priority || i.priority === filters.priority) &&
    (!filters.status || i.status === filters.status) &&
    (!filters.source || i.sourceChannel === filters.source) &&
    (!filters.trust || (filters.trust === 'High' ? i.trust >= 70 : filters.trust === 'Medium' ? i.trust >= 40 && i.trust < 70 : i.trust < 40)) &&
    (!filters.period || Date.parse(i.createdAt) >= now - Number(filters.period) * 86400000) &&
    (!filters.sla || (filters.sla === 'Overdue' ? Boolean(i.slaDueAt && Date.parse(i.slaDueAt) < now && !['Resolved', 'Community Verified', 'Closed'].includes(i.status)) : filters.sla === 'On track' ? Boolean(i.slaDueAt && (Date.parse(i.slaDueAt) >= now || ['Resolved', 'Community Verified', 'Closed'].includes(i.status))) : !i.slaDueAt)),
  )
  const active = issues.find((i) => i.id === selected)
  const options = {
    state: [...new Set(issues.map((i) => i.state).filter((value): value is string => Boolean(value)))],
    district: [...new Set(issues.map((i) => i.district).filter((value): value is string => Boolean(value)))],
    municipality: [...new Set(issues.map((i) => i.municipality).filter((value): value is string => Boolean(value)))],
    ward: [...new Set(issues.map((i) => i.ward).filter((value): value is string => Boolean(value)))],
    department: [...new Set(issues.map((i) => i.department))],
    category: [...new Set(issues.map((i) => i.category))],
    pin: [...new Set(issues.map((i) => i.pin))],
    locality: [...new Set(issues.map((i) => i.locality))],
    priority: ['Critical', 'High', 'Moderate', 'Low'],
    status: [...new Set(issues.map((i) => i.status))],
    source: ['web', 'pwa', 'voice', 'keypad', 'assisted'],
    trust: ['High', 'Medium', 'Low'],
    sla: ['Overdue', 'On track', 'No verified target'],
    period: ['7', '30', '90'],
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues..."
            className="w-full rounded-md border border-sidebar-border bg-sidebar-accent py-2 pl-9 pr-3 text-sm text-cream outline-none placeholder:text-cream/40 focus:border-gold"
          />
        </div>
        {(Object.keys(options) as Array<keyof typeof options>).map((filter) => (
          <select key={filter} value={filters[filter]} onChange={(event) => setFilters((current) => ({ ...current, [filter]: event.target.value }))} aria-label={`Filter by ${filter}`} className="rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2 text-xs text-cream/80 outline-none focus:border-gold">
            <option value="">All {filter === 'source' ? 'channels' : filter === 'period' ? 'dates' : filter === 'sla' ? 'SLA states' : filter}</option>{options[filter].map((option) => <option key={option} value={option}>{filter === 'source' ? option.toUpperCase() : filter === 'period' ? `Last ${option} days` : option}</option>)}
          </select>
        ))}
        <button onClick={() => setFilters({ state: '', district: '', municipality: '', ward: '', department: '', category: '', pin: '', locality: '', priority: '', status: '', source: '', trust: '', sla: '', period: '' })} className="rounded-md border border-sidebar-border px-3 py-2 text-xs text-cream/60">Clear</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-sidebar-border">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-sidebar-accent text-xs uppercase tracking-wide text-cream/50">
            <tr>
              {['Issue ID', 'Issue', 'PIN', 'Dept', 'Priority', 'Trust', 'Heat', 'Reports', 'Status', 'Age'].map(
                (h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-sidebar-border bg-sidebar">
            {rows.map((i) => (
              <tr
                key={i.id}
                onClick={() => setSelected(i.id)}
                className="cursor-pointer text-cream/80 transition-colors hover:bg-sidebar-accent"
              >
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-cream/60">
                  {i.documentId}
                </td>
                <td className="px-3 py-2.5 font-medium text-cream">{i.title}</td>
                <td className="px-3 py-2.5">{i.pin}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs">{i.department}</td>
                <td className="px-3 py-2.5">
                  <PriorityBadge priority={i.priority} />
                </td>
                <td className="px-3 py-2.5">{i.trust}%</td>
                <td className="px-3 py-2.5 font-semibold text-heat">{i.chaiHeat}&deg;</td>
                <td className="px-3 py-2.5">{i.reports}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={i.status} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                  {i.daysUnresolved}d
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-cream/50">No complaints match the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {active && (
        <IssueDetail key={active.id} issue={active} role={user?.role ?? 'citizen'} onClose={() => setSelected(null)} onUpdated={(updated) => { setIssues((current) => current.map((issue) => issue.id === updated.id ? updated : issue)); void loadIssues() }} />
      )}
    </div>
  )
}

function IssueDetail({
  issue,
  role,
  onClose,
  onUpdated,
}: {
  issue: IssueRecord
  role: AppRole
  onClose: () => void
  onUpdated: (issue: IssueRecord) => void
}) {
  const [status, setStatus] = useState(issue.status)
  const [department, setDepartment] = useState(issue.department)
  const [officer, setOfficer] = useState(issue.officer)
  const [note, setNote] = useState('')
  const [resolutionEvidence, setResolutionEvidence] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [evidence, setEvidence] = useState<Array<{ id: string; media_type: string; caption?: string; created_at?: string; url: string }>>([])
  const [evidenceNotice, setEvidenceNotice] = useState('Loading protected evidence…')
  const [duplicateCandidates, setDuplicateCandidates] = useState<Array<{ issue: { id: string; documentId: string; title: string; pin: string; locality: string; status: string }; similarity: number; band: string; signals: string[] }>>([])
  const [duplicateNotice, setDuplicateNotice] = useState('')
  const [verifiedRegistry, setVerifiedRegistry] = useState<{ hubs: Array<{ id: string; name: string; address: string; public_phone?: string; public_email?: string; source_url: string }>; officers: Array<{ id: string; name: string; role: string; department: string; public_phone?: string; public_email?: string; source_url: string }>; documents: Array<{ id: string; title: string; authority: string; source_url: string; published_at: string }> }>({ hubs: [], officers: [], documents: [] })
  const canReviewDuplicates = canModerate(role) || role === 'department_supervisor'
  const canChangeDepartment = role === 'authority_admin'
  const canAssignOfficer = role === 'department_supervisor' || role === 'authority_admin'
  const statusChoices = [...new Set([
    issue.status,
    ...(role === 'department_operator' ? ['Acknowledged', 'In Progress', 'Resolved', 'Under Review'] : ['Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed']),
  ])]

  useEffect(() => {
    if (!canReviewDuplicates) return
    let cancelled = false
    civicFetch(`/api/issues/${issue.id}/duplicates`).then((response) => response.ok ? response.json() : response.json().then((payload) => Promise.reject(new Error(payload.error ?? 'Unable to load duplicate candidates.')))).then((payload) => {
      if (!cancelled) setDuplicateCandidates(Array.isArray(payload.candidates) ? payload.candidates : [])
    }).catch((error) => { if (!cancelled) setDuplicateNotice(error instanceof Error ? error.message : 'Unable to load duplicate candidates.') })
    return () => { cancelled = true }
  }, [issue.id, canReviewDuplicates])

  useEffect(() => {
    let cancelled = false
    civicFetch('/api/issues/' + issue.id + '/evidence').then((response) => response.ok ? response.json() : response.json().then((payload) => Promise.reject(new Error(payload.error ?? 'Unable to load evidence.')))).then((payload) => {
      if (!cancelled) { setEvidence(Array.isArray(payload.evidence) ? payload.evidence : []); setEvidenceNotice('') }
    }).catch((error) => { if (!cancelled) setEvidenceNotice(error instanceof Error ? error.message : 'Unable to load protected evidence.') })
    return () => { cancelled = true }
  }, [issue.id])

  useEffect(() => {
    let cancelled = false
    fetch('/api/public/registry?pin=' + encodeURIComponent(issue.pin)).then((response) => response.ok ? response.json() : null).then((payload) => {
      if (!cancelled && payload) setVerifiedRegistry({ hubs: payload.hubs ?? [], officers: payload.officers ?? [], documents: payload.documents ?? [] })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [issue.pin])

  const verifiedOfficers = verifiedRegistry.officers.filter((record) => record.department === department)

  async function saveAction(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const response = await civicFetch(`/api/issues/${issue.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(canChangeDepartment ? { department } : {}), ...(canAssignOfficer ? { officer } : {}), note, resolutionEvidence }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Unable to save this action.')
      onUpdated(payload.issue)
      setMessage('Action saved and added to the audit trail.')
      setNote('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save this action.')
    } finally {
      setSaving(false)
    }
  }

  async function decideDuplicate(action: 'distinct' | 'merged' | 'unmerged', targetId?: string) {
    setDuplicateNotice('')
    try {
      const response = await civicFetch(`/api/issues/${issue.id}/duplicates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, target_id: targetId }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Unable to save duplicate decision.')
      setDuplicateNotice(`Duplicate decision saved: ${action}.`)
      onUpdated(payload.issue)
    } catch (error) { setDuplicateNotice(error instanceof Error ? error.message : 'Unable to save duplicate decision.') }
  }

  const priorityFactors = Object.entries(issue.priorityFactors ?? {})
  const trustFactors = Object.entries(issue.trustFactors ?? {})
  const canAct = canManageIssues(role)
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-charcoal/60 backdrop-blur-sm">
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-sidebar-border bg-sidebar p-5 text-cream/85">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-cream/50">{issue.documentId}</p>
            <h3 className="font-display text-lg font-extrabold text-cream">
              {issue.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-sidebar-border px-2 py-1 text-xs text-cream/60"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={issue.priority} />
          <StatusBadge status={issue.status} />
          <TrustBadge trust={issue.trust} />
        </div>

        <Section title="Original citizen complaint">
          <p className="text-sm text-cream/70">{issue.description}</p>
        </Section>
        <Section title="AI normalized">
          <dl className="space-y-1.5 text-sm">
            {[
              ['Category', issue.category],
              ['Department', issue.department],
              ['AI confidence', `${issue.aiConfidence ?? 0}%`],
              ['Analysis version', issue.modelVersion ?? 'civicchai-rules-v1'],
              ['Priority score', `${issue.priorityScore ?? 0}/100`],
              ['Location', `PIN ${issue.pin} · ${issue.locality}`],
              ['Exact location', issue.latitude != null && issue.longitude != null ? `${issue.latitude.toFixed(5)}, ${issue.longitude.toFixed(5)} (authorized view)` : 'No precise coordinates attached'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-cream/50">{k}</dt>
                <dd className="text-right font-medium text-cream">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section title="Protected evidence">
          {evidenceNotice && <p role="status" className="text-xs text-cream/50">{evidenceNotice}</p>}
          {evidence.length > 0 ? <div className="mt-2 grid grid-cols-2 gap-2">{evidence.map((item) => item.media_type.startsWith('video/') ? <video key={item.id} src={item.url} controls preload="metadata" aria-label={item.caption ?? 'Protected civic complaint evidence'} className="w-full rounded-md border border-sidebar-border" /> : <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block"><img src={item.url} alt={item.caption ?? 'Protected civic complaint evidence'} className="aspect-square w-full rounded-md border border-sidebar-border object-cover" /></a>)}</div> : !evidenceNotice && <p className="text-xs text-cream/50">No accessible evidence files are attached to this report.</p>}
          <p className="mt-2 text-[10px] leading-relaxed text-cream/40">Signed evidence links expire after two minutes. Access is limited to this report’s creator and authorized department or jurisdiction staff.</p>
        </Section>
        <Section title="Score factors">
          <p className="text-[11px] text-cream/45">Priority and evidence trust are separate. Trust describes this report’s evidence quality, never a citizen’s worthiness.</p>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {priorityFactors.map(([name, value]) => <div key={`priority-${name}`} className="flex justify-between gap-2"><span className="capitalize text-cream/55">{name.replaceAll('_', ' ')}</span><span>{value}%</span></div>)}
            {trustFactors.map(([name, value]) => <div key={`trust-${name}`} className="flex justify-between gap-2"><span className="capitalize text-cream/55">Trust · {name.replaceAll('_', ' ')}</span><span>{value}%</span></div>)}
          </div>
        </Section>
        <Section title="Community & heat">
          <ChaiHeatMeter heat={issue.chaiHeat ?? 0} size="md" className="text-cream" />
          <p className="mt-1 text-xs text-cream/60">
            {issue.supporters.toLocaleString('en-IN')} supporters ·{' '}
            {issue.reports} independent reports
          </p>
        </Section>
        <Section title="Routing & verified public directory">
          <p className="text-sm text-cream/75">Suggested department: {issue.department}</p>
          <p className="mt-1 text-xs text-cream/50">Internal assigned office: {issue.officer || 'Not assigned'}</p>
          {verifiedRegistry.hubs.length ? verifiedRegistry.hubs.map((hub) => <div key={hub.id} className="mt-3 rounded-md border border-sidebar-border bg-sidebar-accent p-3"><p className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-gold" />{hub.name}</p><p className="mt-1 text-xs text-cream/65">{hub.address}</p><p className="mt-1 text-xs text-cream/55">{[hub.public_phone, hub.public_email].filter(Boolean).join(' · ')}</p><a href={hub.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] text-gold underline">Verified source</a></div>) : <p className="mt-2 text-xs text-cream/45">No authority-verified public hub is registered for this PIN.</p>}
          {verifiedOfficers.map((officer) => <div key={officer.id} className="mt-3 rounded-md border border-sidebar-border bg-sidebar-accent p-3"><p className="text-sm font-semibold">{officer.name} · {officer.role}</p><p className="mt-1 text-xs text-cream/60">{officer.department} · {[officer.public_phone, officer.public_email].filter(Boolean).join(' · ')}</p><a href={officer.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] text-gold underline">Verified source</a></div>)}
        </Section>
        <Section title="Civic education">
          <p className="text-sm text-cream/70">The department above is a suggested route based on the complaint category. The authority must acknowledge, assign, record action and add resolution evidence before the citizen can verify the outcome.</p>
          {verifiedRegistry.documents.length ? <ul className="mt-2 space-y-2">{verifiedRegistry.documents.map((document) => <li key={document.id} className="text-xs"><a href={document.source_url} target="_blank" rel="noreferrer" className="text-gold underline">{document.title}</a><span className="text-cream/45"> · {document.authority} · {new Date(document.published_at).toLocaleDateString()}</span></li>)}</ul> : <p className="mt-2 text-xs text-cream/45">No verified legal or service-standard document is registered for this issue. No statutory deadline is implied.</p>}
        </Section>
        <Section title="Status history">
          <div className="rounded-lg bg-sidebar-accent p-3">
            <CivicTimeline status={issue.status} issueId={issue.id} />
          </div>
        </Section>

        {canReviewDuplicates && <Section title="Duplicate review"><p className="text-xs leading-relaxed text-cream/55">Suggestions rank similar wording, locality, category, time and evidence presence within the same PIN. They never merge automatically. A merge preserves both reports and can be reversed.</p>{duplicateNotice && <p role="status" className="mt-2 text-xs text-gold">{duplicateNotice}</p>}{duplicateCandidates.map((candidate) => <div key={candidate.issue.id} className="mt-3 rounded-md border border-sidebar-border bg-sidebar-accent p-3"><p className="text-xs font-semibold text-cream">{candidate.issue.title}</p><p className="mt-1 text-[10px] text-cream/50">{candidate.issue.documentId} · {Math.round(candidate.similarity * 100)}% match · {candidate.band}</p><p className="mt-1 text-[10px] text-cream/45">Signals: {candidate.signals.join(' · ') || 'same PIN'}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => void decideDuplicate('merged', candidate.issue.id)} className="rounded bg-gold px-2 py-1 text-[10px] font-semibold text-charcoal">Link as duplicate</button><button type="button" onClick={() => void decideDuplicate('distinct', candidate.issue.id)} className="rounded border border-sidebar-border px-2 py-1 text-[10px] text-cream/70">Keep separate</button></div></div>)}{issue.duplicateOf && <button type="button" onClick={() => void decideDuplicate('unmerged')} className="mt-3 rounded border border-sidebar-border px-3 py-2 text-xs text-cream/70">Reverse merge</button>}{!duplicateCandidates.length && !issue.duplicateOf && !duplicateNotice && <p className="mt-2 text-xs text-cream/50">No same-PIN candidates above the suggestion threshold.</p>}</Section>}

        {canAct && <form onSubmit={saveAction} className="mt-5 space-y-3 rounded-lg border border-sidebar-border bg-sidebar-accent p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">Administrative action</p>
          <label className="block text-xs text-cream/60">Status<select value={status} onChange={(event) => setStatus(event.target.value as IssueRecord['status'])} className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream">
            {statusChoices.map((value) => <option key={value}>{value}</option>)}
          </select></label>
          {canChangeDepartment && <label className="block text-xs text-cream/60">Route to department<input value={department} onChange={(event) => { setDepartment(event.target.value); setOfficer('') }} maxLength={120} className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream" /><span className="mt-1 block text-[10px] text-cream/40">The route must match a configured department.</span></label>}
          {canAssignOfficer && <label className="block text-xs text-cream/60">Assign a verified officer<select value={officer} onChange={(event) => setOfficer(event.target.value)} className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream"><option value="">{verifiedOfficers.length ? 'Leave assignment pending' : 'No verified officers in this department'}</option>{officer && !verifiedOfficers.some((record) => record.name === officer) && <option value={officer}>Current: {officer}</option>}{verifiedOfficers.map((record) => <option key={record.id} value={record.name}>{record.name} · {record.role}</option>)}</select><span className="mt-1 block text-[10px] text-cream/40">Only authority-verified staff for this PIN and department can be selected.</span></label>}
          <label className="block text-xs text-cream/60">Official update<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} placeholder="Record an action, acknowledgement, or reason." className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream" /></label>
          {status === 'Resolved' && <label className="block text-xs text-cream/60">Official resolution record URL<input value={resolutionEvidence} onChange={(event) => setResolutionEvidence(event.target.value)} type="url" required maxLength={500} placeholder="https://department.gov.in/..." className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream" /><span className="mt-1 block text-[10px] text-cream/40">Citizens can open this public HTTPS record. Use an official .gov.in or .nic.in source.</span></label>}
          {message && <p role="status" className="text-xs text-cream/70">{message}</p>}
          <button disabled={saving} className="w-full rounded-md bg-gold px-3 py-2 text-xs font-semibold text-charcoal disabled:opacity-50">{saving ? 'Saving…' : 'Save action'}</button>
        </form>}
        {!canAct && <p className="mt-5 rounded-lg bg-sidebar-accent p-3 text-xs text-cream/55">{ROLE_LABELS[role]} access is read-only for administrative issue actions.</p>}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-cream/40">
          <History className="h-3.5 w-3.5" />
          Every sensitive action is written to the audit log.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-sidebar-border pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cream/50">
        {title}
      </p>
      {children}
    </div>
  )
}

/* ---------------- GIS Hotspots ---------------- */
function MapFocus({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMapHook()

  useEffect(() => {
    map.setView(center, zoom, { animate: false })
  }, [center[0], center[1], map, zoom])

  return null
}

const EMPTY_HEATMAP: HeatmapData = {
  totalIssues: 0,
  syntheticSeedCount: 0,
  mappedIssueCount: 0,
  unmappedIssueCount: 0,
  cells: [],
  regions: [],
  filters: { departments: [], categories: [] },
}

const MAP_METRICS: Array<{ value: HeatmapMetric; label: string }> = [
  { value: 'chai', label: 'Chai heat' },
  { value: 'density', label: 'Issue density' },
  { value: 'priority', label: 'Priority' },
  { value: 'resolution', label: 'Resolution' },
]

export function GISView() {
  const [data, setData] = useState<HeatmapData>(EMPTY_HEATMAP)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeRegionKey, setActiveRegionKey] = useState('')
  const [metric, setMetric] = useState<HeatmapMetric>('chai')
  const [department, setDepartment] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    if (department) params.set('department', department)
    if (category) params.set('category', category)
    civicFetch(`/api/gis/heatmap${params.size ? `?${params}` : ''}`)
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error ?? 'Unable to load location data.')
        return payload as HeatmapData
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setActiveRegionKey((current) => payload.regions.some((region) => region.key === current) ? current : payload.regions[0]?.key ?? '')
        }
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load location data.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [department, category])

  const active = data.regions.find((region) => region.key === activeRegionKey) ?? data.regions[0]
  const hasActiveCenter = active?.latitude != null && active.longitude != null
  const firstCell = data.cells[0]
  const center: [number, number] = hasActiveCenter
    ? [active.latitude!, active.longitude!]
    : firstCell ? [firstCell.latitude, firstCell.longitude] : [20.5937, 78.9629]
  const zoom = hasActiveCenter ? 12 : firstCell ? 6 : 5
  const metricLabels: Record<HeatmapMetric, string> = {
    chai: 'Community Chai heat',
    density: 'Number of issue reports',
    priority: 'Average civic priority score',
    resolution: 'Resolved issue share',
  }

  return (
    <div className="space-y-4">
      {error && <p role="status" className="rounded-lg border border-heat/30 bg-heat/10 p-3 text-sm text-heat">{error}</p>}

      <div className="grid gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent p-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-cream/60">Department
          <select value={department} onChange={(event) => setDepartment(event.target.value)} className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream outline-none focus:border-gold">
            <option value="">All departments</option>
            {data.filters.departments.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-cream/60">Issue category
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream outline-none focus:border-gold">
            <option value="">All categories</option>
            {data.filters.categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MAP_METRICS.map((item) => <button key={item.value} type="button" onClick={() => setMetric(item.value)} aria-pressed={metric === item.value} className={cn('min-h-10 rounded-md border px-3 py-2 text-xs font-semibold transition-colors', metric === item.value ? 'border-gold bg-gold text-charcoal' : 'border-sidebar-border bg-sidebar-accent text-cream/65 hover:text-cream')}>{item.label}</button>)}
      </div>
      {data.syntheticSeedCount > 0 && <p className="text-[11px] text-gold">{data.syntheticSeedCount} synthetic seed example{data.syntheticSeedCount === 1 ? '' : 's'} excluded from the live heatmap.</p>}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-sidebar-border bg-sidebar-accent">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sidebar-border px-3 py-2 text-xs font-medium text-cream/70">
            <span>OpenStreetMap · {metricLabels[metric]}</span>
            <span>{data.cells.length} generalized map cells · {data.mappedIssueCount}/{data.totalIssues} reports located</span>
          </div>
          <div className="relative h-[460px] w-full">
            <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full" style={{ background: '#201c1a' }}>
              <MapFocus center={center} zoom={zoom} />
              <TileLayer attribution={process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} url={process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
              <HeatmapCanvas cells={data.cells} metric={metric} />
            </MapContainer>
            <div className="pointer-events-none absolute bottom-3 left-3 right-36 z-[700] flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar/90 px-3 py-2 text-[10px] text-cream/75 shadow-lg sm:right-40">
              <span className="shrink-0">{metric === 'resolution' ? 'Lower' : 'Less'}</span>
              <span className="h-2 flex-1 rounded-full" style={{ background: metric === 'resolution' ? 'linear-gradient(90deg,#c84630,#d99a3d,#3f6b45)' : 'linear-gradient(90deg,#3f6b45,#d99a3d,#c84630)' }} />
              <span className="shrink-0">{metric === 'resolution' ? 'Higher' : 'More'}</span>
              <span className="ml-1 hidden sm:inline">{metricLabels[metric]}</span>
            </div>
            {!data.cells.length && <div className="pointer-events-none absolute inset-x-5 top-5 z-[700] rounded-md border border-sidebar-border bg-sidebar/90 px-3 py-2 text-center text-xs text-cream/75">{loading ? 'Loading consented location aggregates…' : 'No consented report coordinates in this filter yet. The map only plots reports where the citizen shared device location.'}</div>}
          </div>
          <p className="flex flex-wrap items-center justify-between gap-2 border-t border-sidebar-border px-3 py-2 text-[10px] leading-relaxed text-cream/45"><span>Map cells generalize device coordinates to approximately 1 km before leaving the server. Exact report coordinates are never returned by this map endpoint.</span><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer" className="shrink-0 underline underline-offset-2">Report a map issue</a></p>
        </div>

        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent p-5">
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-cream/50">Selected locality</p><h3 className="mt-1 font-display text-lg font-extrabold text-cream">{active?.locality ?? 'No locality data'}</h3></div>
            {active && <span className="rounded bg-sidebar px-2 py-1 text-xs font-semibold text-gold">PIN {active.pin}</span>}
          </div>
          {active ? <>
            <dl className="mt-4 space-y-2 text-sm">
              {[['Issues', String(active.issueCount)], ['Average Chai heat', `${active.averageChaiHeat}°`], ['Average priority', `${active.averagePriority}%`], ['Resolution rate', `${active.resolutionRate}%`], ['With shared map location', String(active.mappedIssueCount)]].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-cream/50">{label}</dt><dd className="font-semibold text-cream">{value}</dd></div>)}
            </dl>
            {active.categories.length > 0 && <><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-cream/50">Top categories</p><ul className="mt-2 flex flex-wrap gap-2">{active.categories.map((value) => <li key={value} className="rounded-full bg-sidebar px-2.5 py-1 text-[10px] text-cream/70">{value}</li>)}</ul></>}
          </> : <p className="mt-3 text-sm text-cream/55">{loading ? 'Loading locality aggregates…' : 'No issue data is available in this scope.'}</p>}

          <div className="mt-5 border-t border-sidebar-border pt-4">
            <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-cream/50">Locality hotspots</p><span className="text-[10px] text-cream/40">{data.regions.length}</span></div>
            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {data.regions.slice(0, 10).map((region) => <button key={region.key} type="button" onClick={() => setActiveRegionKey(region.key)} aria-pressed={active?.key === region.key} className={cn('w-full rounded-md border p-2.5 text-left transition-colors', active?.key === region.key ? 'border-gold/50 bg-gold/10' : 'border-transparent hover:bg-sidebar')}>
                <span className="flex items-center justify-between gap-2 text-xs"><span className="truncate font-semibold text-cream">{region.locality || `PIN ${region.pin}`}</span><span className="shrink-0 text-cream/55">{region.issueCount} issue{region.issueCount === 1 ? '' : 's'}</span></span>
                <span className="mt-1 block text-[10px] text-cream/45">PIN {region.pin} · {region.averageChaiHeat}° heat · {region.resolutionRate}% resolved</span>
              </button>)}
              {!data.regions.length && <p className="py-3 text-xs text-cream/45">No issue clusters for the selected filters.</p>}
            </div>
          </div>
          <p className="mt-4 text-[10px] leading-relaxed text-cream/40">Only real, non-seed reports are counted. Location is shown only when a citizen opted into device-location sharing.</p>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Analytics ---------------- */
export function AnalyticsView() {
  const [issues, setIssues] = useState<IssueRecord[]>([])
  const [message, setMessage] = useState('Loading analytics…')
  useEffect(() => {
    let cancelled = false
    civicFetch('/api/issues').then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load analytics.'))).then((payload) => {
      if (!cancelled) { setIssues(Array.isArray(payload.issues) ? payload.issues : []); setMessage('') }
    }).catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Unable to load analytics.') })
    return () => { cancelled = true }
  }, [])
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 11 + index, 1))
  const trend = months.map((month) => ({
    label: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(month),
    count: issues.filter((issue) => { const createdAt = new Date(issue.createdAt); return createdAt.getFullYear() === month.getFullYear() && createdAt.getMonth() === month.getMonth() }).length,
  }))
  const max = Math.max(1, ...trend.map((item) => item.count))
  const resolved = issues.filter((issue) => ['Resolved', 'Community Verified', 'Closed'].includes(issue.status)).length
  const unresolved = issues.filter((issue) => !['Resolved', 'Community Verified', 'Closed', 'Duplicate'].includes(issue.status))
  const resolutionRate = issues.length ? Math.round((resolved / issues.length) * 100) : 0
  const averageOpenAge = unresolved.length ? (unresolved.reduce((sum, issue) => sum + issue.daysUnresolved, 0) / unresolved.length).toFixed(1) : '0.0'
  const configuredSla = issues.filter((issue) => issue.slaDueAt)
  const metSla = configuredSla.filter((issue) => ['Resolved', 'Community Verified', 'Closed'].includes(issue.status) && new Date(issue.updatedAt ?? issue.createdAt).getTime() <= new Date(issue.slaDueAt!).getTime()).length
  const slaRate = configuredSla.length ? `${Math.round((metSla / configuredSla.length) * 100)}% (${configuredSla.length} configured)` : 'No verified SLA data'
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent p-5">
        <h3 className="text-sm font-semibold text-cream">Issues filed by month (last 12 months)</h3>
        {message && <p role="status" className="mt-3 text-xs text-cream/55">{message}</p>}
        <div className="mt-6 flex h-48 items-end gap-2">
          {trend.map((item) => (
            <div key={`${item.label}-${item.count}`} className="flex flex-1 flex-col items-center gap-2">
              <div
                title={`${item.count} filed`}
                className="w-full rounded-t bg-gold/80"
                style={{ height: `${Math.max(item.count ? 4 : 0, (item.count / max) * 100)}%` }}
              />
              <span className="text-[10px] text-cream/50">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ['Issues in scope', issues.length.toLocaleString('en-IN')],
          ['Resolved now', `${resolutionRate}%`],
          ['Average open age', `${averageOpenAge} days`],
          ['Verified SLA met', slaRate],
        ].map(([k, v]) => (
          <div
            key={k}
            className="rounded-lg border border-sidebar-border bg-sidebar-accent p-5"
          >
            <p className="text-xs uppercase tracking-wide text-cream/50">{k}</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-cream">
              {v}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RegistryView() {
  const { user } = useAuth()
  const [registry, setRegistry] = useState<{ jurisdictions: Record<string, unknown>[]; hubs: Record<string, unknown>[]; officers: Record<string, unknown>[]; documents: Record<string, unknown>[]; sla_targets: Record<string, unknown>[] }>({ jurisdictions: [], hubs: [], officers: [], documents: [], sla_targets: [] })
  const [kind, setKind] = useState<'jurisdiction' | 'hub' | 'officer' | 'document' | 'sla'>('jurisdiction')
  const [form, setForm] = useState<Record<string, string>>({ pin: '', source_url: '', name: '', level: 'pin', address: '', ward: '', municipality: '', district: '', state: '', public_phone: '', public_email: '', role: '', department: '', hub: '', title: '', authority: '', document_number: '', published_at: '', effective_at: '', version: '1' })
  const [verified, setVerified] = useState(false)
  const [notice, setNotice] = useState('Loading verified registry…')
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)
  const savedPin = user?.pin
  useEffect(() => {
    if (savedPin) setForm((current) => current.pin ? current : { ...current, pin: savedPin })
  }, [savedPin])
  useEffect(() => {
    let cancelled = false
    civicFetch('/api/registry').then((response) => response.ok ? response.json() : response.json().then((payload) => Promise.reject(new Error(payload.error ?? 'Unable to load the registry.')))).then((payload) => {
      if (!cancelled) { setRegistry({ jurisdictions: payload.jurisdictions ?? [], hubs: payload.hubs ?? [], officers: payload.officers ?? [], documents: payload.documents ?? [], sla_targets: payload.sla_targets ?? [] }); setNotice('') }
    }).catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : 'Unable to load the registry.') })
    return () => { cancelled = true }
  }, [reload])
  const fields: Record<typeof kind, Array<[string, string, boolean?]>> = {
    jurisdiction: [['name', 'Jurisdiction name'], ['level', 'Hierarchy level']],
    hub: [['name', 'Public hub name'], ['address', 'Public address'], ['ward', 'Ward'], ['municipality', 'Municipality'], ['district', 'District'], ['state', 'State'], ['public_phone', 'Public phone'], ['public_email', 'Public email']],
    officer: [['name', 'Public officer name'], ['role', 'Office role'], ['department', 'Department'], ['hub', 'Hub name'], ['public_phone', 'Public phone'], ['public_email', 'Public email']],
    document: [['title', 'Document title'], ['authority', 'Issuing authority'], ['document_number', 'Document number'], ['published_at', 'Published date'], ['effective_at', 'Effective date'], ['version', 'Version']],
    sla: [['target_hours', 'Service target in hours'], ['department', 'Department name (optional)'], ['category', 'Category name (optional)'], ['effective_at', 'Effective date'], ['expires_at', 'Expiry date']],
  }
  async function addRecord(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setNotice('')
    try {
      const response = await civicFetch('/api/registry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, kind, is_verified: verified }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Unable to add registry record.')
      setNotice('Registry record added with source provenance.')
      setReload((current) => current + 1)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to add registry record.') } finally { setSaving(false) }
  }
  const str = (value: unknown) => typeof value === 'string' ? value : ''
  const records: Array<{ type: string; primary: string; detail: string; contact: string; source: string; verified: boolean }> = [
    ...registry.jurisdictions.map((row) => ({ type: 'Jurisdiction', primary: str(row.name), detail: `${str(row.level)} · PIN ${str(row.pin)}`, contact: '', source: str(row.source_url), verified: row.is_verified === true })),
    ...registry.hubs.map((row) => ({ type: 'Hub', primary: str(row.name), detail: `${str(row.address)} · PIN ${str(row.pin)}`, contact: [str(row.public_phone), str(row.public_email)].filter(Boolean).join(' · '), source: str(row.source_url), verified: row.is_verified === true })),
    ...registry.officers.map((row) => ({ type: 'Officer', primary: str(row.name), detail: `${str(row.role)} · ${str(row.department)} · PIN ${str(row.pin)}`, contact: [str(row.public_phone), str(row.public_email)].filter(Boolean).join(' · '), source: str(row.source_url), verified: row.is_verified === true })),
    ...registry.documents.map((row) => ({ type: 'Document', primary: str(row.title), detail: `${str(row.authority)} · ${str(row.document_number) || 'No document number'}`, contact: row.published_at ? `Published ${new Date(String(row.published_at)).toLocaleDateString()}` : '', source: str(row.source_url), verified: row.is_verified === true })),
    ...registry.sla_targets.map((row) => ({ type: 'SLA', primary: `${str(row.target_hours)} hour service target`, detail: `Effective ${row.effective_at ? new Date(String(row.effective_at)).toLocaleDateString() : 'date not set'}${row.expires_at ? ` · expires ${new Date(String(row.expires_at)).toLocaleDateString()}` : ''}`, contact: '', source: str(row.source_url), verified: row.is_verified === true })),
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent p-5">
        <h3 className="text-sm font-semibold text-cream">Authority registry & official sources</h3>
        <p className="mt-2 text-xs leading-relaxed text-cream/55">Only source-backed records marked verified are presented as official. Verify the source and scope before publishing a contact or document.</p>
        {notice && <p role="status" className="mt-3 rounded-md bg-sidebar px-3 py-2 text-xs text-cream/70">{notice}</p>}
        <div className="mt-4 overflow-x-auto">
          <div className="grid gap-3 md:grid-cols-2">{records.map((record, index) => <article key={`${record.type}-${record.primary}-${index}`} className="rounded-md border border-sidebar-border bg-sidebar p-4"><div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-wide text-gold">{record.type}</span><span className={cn('rounded px-2 py-1 text-[10px] uppercase', record.verified ? 'bg-leaf/15 text-leaf' : 'bg-gold/10 text-gold')}>{record.verified ? 'Verified' : 'Unverified'}</span></div><h4 className="mt-2 text-sm font-semibold text-cream">{record.primary}</h4><p className="mt-1 text-xs text-cream/60">{record.detail}</p>{record.contact && <p className="mt-2 text-xs text-cream/70">{record.contact}</p>}<p className="mt-3 break-all text-[10px] text-cream/40">Source: {record.source || 'Not provided'}</p></article>)}{records.length === 0 && !notice && <p className="text-sm text-cream/55">No authority registry records have been added for this scope.</p>}</div>
        </div>
      </div>
      <form onSubmit={addRecord} className="rounded-lg border border-sidebar-border bg-sidebar-accent p-5"><h3 className="text-sm font-semibold text-cream">Add a source-backed record</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-cream/60">Record type<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream"><option value="jurisdiction">Jurisdiction</option><option value="hub">Public service hub</option><option value="officer">Public officer routing</option><option value="document">Official document</option><option value="sla">Service-level target (SLA)</option></select></label><label className="text-xs text-cream/60">Six-digit PIN<input required pattern="[0-9]{6}" value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value })} className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream" /></label>{fields[kind].map(([name, label]) => <label key={name} className="text-xs text-cream/60">{label}{name === 'level' ? <select required value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream"><option value="state">State</option><option value="district">District</option><option value="municipality">Municipality</option><option value="ward">Ward</option><option value="pin">PIN</option><option value="locality">Locality</option></select> : <input required={['name', 'address', 'role', 'department', 'title', 'authority', 'target_hours'].includes(name)} type={name.endsWith('_at') ? 'date' : name === 'target_hours' ? 'number' : 'text'} min={name === 'target_hours' ? 1 : undefined} max={name === 'target_hours' ? 87600 : undefined} value={form[name] ?? ''} onChange={(event) => setForm({ ...form, [name]: event.target.value })} className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream" />}</label>)}<label className="text-xs text-cream/60 sm:col-span-2">Source URL (HTTPS)<input required type="url" value={form.source_url} onChange={(event) => setForm({ ...form, source_url: event.target.value })} className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream" /></label><label className="flex items-center gap-2 text-xs text-cream/70 sm:col-span-2"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />I checked this source and authorize marking it verified.</label></div><button disabled={saving} className="mt-4 rounded-md bg-gold px-4 py-2 text-xs font-semibold text-charcoal disabled:opacity-50">{saving ? 'Saving…' : 'Add registry record'}</button></form>
    </div>
  )
}

export function AuditView() {
  const [events, setEvents] = useState<Array<{ id: string; issue_id?: string; actor_id?: string; action: string; details?: Record<string, unknown>; created_at: string }>>([])
  const [notice, setNotice] = useState('Loading audit trail…')
  useEffect(() => {
    let cancelled = false
    civicFetch('/api/audit').then((response) => response.ok ? response.json() : response.json().then((payload) => Promise.reject(new Error(payload.error ?? 'Unable to load the audit trail.')))).then((payload) => {
      if (!cancelled) { setEvents(Array.isArray(payload.events) ? payload.events : []); setNotice('') }
    }).catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : 'Unable to load the audit trail.') })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent p-5">
        <h3 className="text-sm font-semibold text-cream">Audit & compliance trail</h3>
        {notice && <p role="status" className="mt-3 text-xs text-cream/55">{notice}</p>}
        <div className="mt-4 space-y-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-md border border-sidebar-border bg-sidebar p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-cream">{event.action}</p>
                <span className="text-[10px] uppercase tracking-wide text-cream/50">{new Date(event.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-xs text-cream/60">Actor reference: {event.actor_id ? event.actor_id.slice(0, 8) : 'system'} · Issue: {event.issue_id ?? 'platform event'}</p>
              {event.details && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-cream/75">{JSON.stringify(event.details, null, 2)}</pre>}
            </div>
          ))}
        </div>
        {!events.length && !notice && <p className="mt-4 text-sm text-cream/55">No audit events are available in this authorized scope.</p>}
      </div>
    </div>
  )
}

export function PrivacyRequestsView() {
  const [requests, setRequests] = useState<Array<{ id: string; user_id: string; request_type: string; details: string | null; status: string; response_note: string | null; created_at: string }>>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('Loading data-rights requests…')
  const [busy, setBusy] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    civicFetch('/api/privacy-requests').then((response) => response.ok ? response.json() : response.json().then((payload) => Promise.reject(new Error(payload.error ?? 'Unable to load data-rights requests.')))).then((payload) => {
      if (!cancelled) { setRequests(Array.isArray(payload.requests) ? payload.requests : []); setNotice('') }
    }).catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : 'Unable to load data-rights requests.') })
    return () => { cancelled = true }
  }, [reload])

  async function review(id: string, status: 'in_review' | 'fulfilled' | 'declined') {
    setBusy(id); setNotice('')
    try {
      const response = await civicFetch('/api/privacy-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, response_note: notes[id] ?? '' }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Unable to update this request.')
      setRequests((current) => current.map((request) => request.id === id ? { ...request, ...payload.request } : request))
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to update this request.') } finally { setBusy('') }
  }

  return <div className="space-y-4"><div className="rounded-lg border border-sidebar-border bg-sidebar-accent p-5"><h2 className="text-sm font-semibold text-cream">Data-rights and privacy grievances</h2><p className="mt-2 text-xs leading-relaxed text-cream/55">Review access, correction, erasure and grievance requests. Record the outcome and follow the approved retention and identity-verification procedure.</p>{notice && <p role="status" className="mt-3 text-xs text-cream/60">{notice}</p>}</div>{requests.map((request) => <article key={request.id} className="rounded-lg border border-sidebar-border bg-sidebar-accent p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold capitalize text-cream">{request.request_type} request</p><p className="mt-1 text-[11px] text-cream/45">Requester {request.user_id.slice(0, 8)} · {new Date(request.created_at).toLocaleString()}</p></div><span className="rounded bg-gold/10 px-2 py-1 text-[10px] font-semibold uppercase text-gold">{request.status}</span></div>{request.details && <p className="mt-3 whitespace-pre-wrap rounded-md bg-sidebar p-3 text-xs leading-relaxed text-cream/70">{request.details}</p>}{request.response_note && <p className="mt-2 text-xs text-cream/60">Recorded response: {request.response_note}</p>}<label className="mt-3 block text-xs text-cream/60">Review note<textarea value={notes[request.id] ?? request.response_note ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} maxLength={2000} rows={2} className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-cream" /></label><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy === request.id || request.status === 'fulfilled' || request.status === 'declined'} onClick={() => void review(request.id, 'in_review')} className="rounded-md border border-gold/50 px-3 py-2 text-xs font-semibold text-gold disabled:opacity-50">{busy === request.id ? 'Saving…' : 'Mark in review'}</button><button disabled={busy === request.id || request.status === 'fulfilled'} onClick={() => void review(request.id, 'fulfilled')} className="rounded-md bg-leaf px-3 py-2 text-xs font-semibold text-cream disabled:opacity-50">Record fulfilled</button><button disabled={busy === request.id || request.status === 'declined'} onClick={() => void review(request.id, 'declined')} className="rounded-md border border-heat/50 px-3 py-2 text-xs font-semibold text-heat disabled:opacity-50">Record declined</button></div></article>)}{!requests.length && !notice && <p className="rounded-lg border border-sidebar-border p-5 text-sm text-cream/55">There are no open data-rights requests.</p>}</div>
}

export function ModerationView() {
  const [reports, setReports] = useState<Array<Record<string, any>>>([])
  const [notice, setNotice] = useState('Loading moderation reports…')
  const [busyId, setBusyId] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    civicFetch('/api/moderation').then((response) => response.ok ? response.json() : response.json().then((payload) => Promise.reject(new Error(payload.error ?? 'Unable to load reports.')))).then((payload) => {
      if (!cancelled) { setReports(Array.isArray(payload.reports) ? payload.reports : []); setNotice('') }
    }).catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : 'Unable to load reports.') })
    return () => { cancelled = true }
  }, [revision])

  async function review(report: Record<string, any>, status: string) {
    setBusyId(String(report.id))
    try {
      const response = await civicFetch(`/api/moderation/${report.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, moderator_note: report.moderator_note ?? '' }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Unable to update report.')
      setRevision((current) => current + 1)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to update report.') } finally { setBusyId('') }
  }

  return <div className="space-y-4"><div className="rounded-lg border border-sidebar-border bg-sidebar-accent p-5"><div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-gold" /><h3 className="text-sm font-semibold text-cream">Moderation & user reports</h3></div><p className="mt-2 text-xs text-cream/55">Review reports consistently. Good-faith criticism of public services is not itself a violation.</p>{notice && <p role="status" className="mt-3 text-xs text-cream/65">{notice}</p>}<div className="mt-4 space-y-3">{reports.map((report) => {
    const issue = Array.isArray(report.issues) ? report.issues[0] : report.issues
    const comment = Array.isArray(report.issue_comments) ? report.issue_comments[0] : report.issue_comments
    const target = report.issue_id ? `Issue ${issue?.document_id ?? report.issue_id} · PIN ${issue?.pin ?? 'scoped'}` : 'Comment report'
    return <article key={report.id} className="rounded-md border border-sidebar-border bg-sidebar p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-cream">{String(report.reason ?? 'other').replaceAll('_', ' ')} · {target}</p><span className="rounded bg-gold/10 px-2 py-1 text-[10px] uppercase text-gold">{report.status}</span></div>{issue?.title && <p className="mt-2 text-xs text-cream/60">{issue.title}</p>}{comment?.body && <p className="mt-2 rounded bg-sidebar-accent p-2 text-xs text-cream/70">{comment.body}</p>}{report.details && <p className="mt-2 text-xs text-cream/70">Reporter context: {report.details}</p>}<p className="mt-2 text-[10px] text-cream/45">Submitted {new Date(report.created_at).toLocaleString()}</p><div className="mt-3 flex flex-wrap gap-2">{['reviewing', 'actioned', 'dismissed', 'appealed'].map((status) => <button key={status} disabled={busyId === report.id || report.status === status} onClick={() => void review(report, status)} className="rounded border border-sidebar-border px-2 py-1 text-[10px] font-semibold capitalize text-cream/70 disabled:opacity-40">{busyId === report.id ? 'Saving…' : status}</button>)}</div></article>
  })}{!reports.length && !notice && <p className="text-sm text-cream/55">No content reports in this scope.</p>}</div></div></div>
}
