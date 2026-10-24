'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SiteNav } from '@/components/landing/site-nav'
import { SiteFooter } from '@/components/landing/site-footer'
import { ChaiCard } from '@/components/brand/chai-card'
import { ChaiHeatMeter } from '@/components/brand/chai-heat-meter'
import { CivicTimeline } from '@/components/brand/civic-timeline'
import { StatusBadge, PriorityBadge } from '@/components/brand/badges'
import { civicFetch } from '@/lib/client-api'
import type { IssueRecord } from '@/lib/types'
import { ArrowLeft, ExternalLink, FileText, MapPin, ShieldCheck } from 'lucide-react'

type RegistryData = {
  jurisdiction?: { name: string; level: string; source_url?: string; source_version?: string; verified_at?: string } | null
  jurisdictions?: Array<{ name: string; level: string; source_url?: string; source_version?: string; verified_at?: string }>
  hubs?: Array<{ id: string; name: string; address: string; pin: string; ward?: string; municipality?: string; district?: string; state?: string; public_phone?: string; public_email?: string; source_url: string; source_version: string; verified_at?: string }>
  officers?: Array<{ id: string; name: string; role: string; department: string; pin: string; hub: string; public_phone?: string; public_email?: string; source_url: string; source_version: string; verified_at?: string }>
  documents?: Array<{ id: string; title: string; authority: string; issuing_authority?: string; document_number?: string; source_url: string; published_at: string; effective_at?: string; version?: string; checksum?: string }>
  sla_targets?: Array<{ id: string; target_hours: number; source_url: string; source_version: string; effective_at?: string; expires_at?: string; departments?: { name: string } | null; categories?: { name: string } | null }>
}

function Factors({ title, factors }: { title: string; factors?: Record<string, number> }) {
  const entries = Object.entries(factors ?? {}).filter(([, value]) => Number.isFinite(Number(value)))
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display font-bold">{title}</h2>
      {entries.length ? <dl className="mt-3 space-y-2">{entries.map(([key, value]) => <div key={key} className="flex justify-between gap-4 text-sm"><dt className="capitalize text-charcoal/65">{key.replaceAll('_', ' ')}</dt><dd className="font-semibold tabular-nums">{Math.round(value)}%</dd></div>)}</dl> : <p className="mt-2 text-sm text-charcoal/55">No factor breakdown was recorded.</p>}
    </section>
  )
}

/** SOP civic education card: every answer comes from the classification or the verified registry, never a guess. */
function EducationCard({ issue, registry }: { issue: IssueRecord; registry: RegistryData }) {
  const officer = registry.officers?.find((record) => record.department === issue.department)
  const hub = registry.hubs?.[0]
  const reference = registry.documents?.[0]
  const rows: Array<[string, React.ReactNode]> = [
    ['What is the problem?', `${issue.category} · ${issue.title}`],
    ['Who handles it?', `${issue.department} (suggested route; staff confirm it)`],
    ['Who is the official?', officer ? `${officer.role}, ${officer.department}` : 'Not yet published by the authority'],
    ['Where is the hub?', hub ? `${hub.name}, ${hub.address}` : 'No verified hub registered for this PIN'],
    ['What rule applies?', reference ? <a href={reference.source_url} target="_blank" rel="noreferrer" className="text-chai underline">{reference.title}</a> : 'No verified reference registered'],
    ['What happens next?', 'Acknowledgement → assignment → field action → resolution. People who filed, supported or follow it can then confirm or dispute the outcome in My Charcha.'],
  ]
  return (
    <section aria-label="Civic education" className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">Know your Charcha</p>
      <dl className="mt-3 space-y-3">{rows.map(([question, answer]) => <div key={question}><dt className="text-[11px] font-semibold uppercase tracking-wide text-charcoal/45">{question}</dt><dd className="mt-0.5 text-xs leading-relaxed text-charcoal/75">{answer}</dd></div>)}</dl>
      <p className="mt-3 text-[10px] leading-relaxed text-charcoal/45">Legal information is educational and not legal advice. CivicChai is not an emergency service or a statutory appeal channel.</p>
      <Link href="/citizen" className="mt-3 inline-flex text-sm font-semibold text-chai underline">Open citizen portal</Link>
    </section>
  )
}

export default function IssueReportPage() {
  const params = useParams<{ id: string }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const [issue, setIssue] = useState<IssueRecord | null>(null)
  const [registry, setRegistry] = useState<RegistryData>({})
  const [evidence, setEvidence] = useState<Array<{ id: string; media_type: string; caption?: string; url: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetch('/api/public/issues/' + encodeURIComponent(id)).then(async (response) => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'This public report could not be loaded.')
      return payload.issue as IssueRecord
    }).then((record) => {
      if (cancelled) return
      setIssue(record)
      void civicFetch('/api/issues/' + encodeURIComponent(record.id) + '/evidence').then((response) => response.ok ? response.json() : null).then((payload) => {
        if (!cancelled && Array.isArray(payload?.evidence)) setEvidence(payload.evidence)
      }).catch(() => {})
      void fetch(`/api/public/registry?pin=${encodeURIComponent(record.pin)}`).then((response) => response.ok ? response.json() : null).then((payload) => {
        if (!cancelled && payload) setRegistry(payload)
      }).catch(() => {})
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'This public report could not be loaded.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const activeSla = registry.sla_targets?.filter((target) => (!target.effective_at || Date.parse(target.effective_at) <= Date.now()) && (!target.expires_at || Date.parse(target.expires_at) > Date.now()) && (!target.departments?.name || target.departments.name === issue?.department) && (!target.categories?.name || target.categories.name === issue?.category)).sort((a, b) => Number(Boolean(b.categories?.name)) + Number(Boolean(b.departments?.name)) - Number(Boolean(a.categories?.name)) - Number(Boolean(a.departments?.name)))[0]

  return (
    <main className="min-h-dvh bg-background text-charcoal">
      <SiteNav />
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <Link href="/citizen" className="inline-flex items-center gap-2 text-sm font-semibold text-chai hover:underline"><ArrowLeft className="h-4 w-4" />Back to Local Chai</Link>
        {loading && <div role="status" className="mt-6 rounded-2xl border border-border bg-card p-8 text-sm text-charcoal/60">Loading the public civic report…</div>}
        {!loading && error && <section className="mt-6 rounded-2xl border border-terracotta/30 bg-card p-8"><h1 className="font-display text-xl font-bold">Report unavailable</h1><p className="mt-2 text-sm text-charcoal/65">{error}</p></section>}
        {!loading && issue && <>
          <header className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="bg-chai p-5 text-cream sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cream/65">CivicChai public issue report</p>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1"><p className="font-mono text-xs text-cream/65">{issue.documentId}</p><h1 className="mt-2 font-display text-2xl font-extrabold sm:text-4xl">{issue.title}</h1><p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-cream/75"><MapPin className="h-4 w-4" />PIN {issue.pin} · {issue.locality}{issue.isDemo ? ' · Synthetic demo record' : ''}</p></div>
                <div className="flex flex-wrap gap-2"><StatusBadge status={issue.status} /><PriorityBadge priority={issue.priority} /></div>
              </div>
              <div className="mt-6 grid gap-4 border-t border-cream/15 pt-5 sm:grid-cols-3">
                <div><p className="text-[11px] uppercase tracking-wider text-cream/55">Created</p><p className="mt-1 text-sm">{new Date(issue.created_at ?? issue.createdAt).toLocaleString('en-IN')}</p></div>
                <div><p className="text-[11px] uppercase tracking-wider text-cream/55">Department · category</p><p className="mt-1 text-sm">{issue.department} · {issue.category}</p></div>
                <div><p className="text-[11px] uppercase tracking-wider text-cream/55">Model and language</p><p className="mt-1 text-sm">{issue.modelVersion ?? 'Rules-based triage'} · {issue.language ?? 'Unknown'}</p></div>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-4 sm:p-6">
              <div className="rounded-xl bg-secondary/60 p-3"><p className="text-[11px] uppercase tracking-wide text-charcoal/50">Priority</p><p className="mt-1 font-display text-2xl font-extrabold">{issue.priorityScore ?? 0}<span className="text-sm font-semibold text-charcoal/45"> / 100</span></p><p className="text-xs text-charcoal/55">Civic urgency, separate from trust</p></div>
              <div className="rounded-xl bg-secondary/60 p-3"><p className="text-[11px] uppercase tracking-wide text-charcoal/50">Report trust</p><p className="mt-1 font-display text-2xl font-extrabold">{issue.trust}<span className="text-sm font-semibold text-charcoal/45"> / 100</span></p><p className="text-xs text-charcoal/55">Evidence confidence, not citizen reputation</p></div>
              <div className="rounded-xl bg-secondary/60 p-3"><p className="text-[11px] uppercase tracking-wide text-charcoal/50">Reports · comments</p><p className="mt-1 font-display text-2xl font-extrabold">{issue.reports} <span className="text-sm font-semibold text-charcoal/45">· {issue.comments}</span></p><p className="text-xs text-charcoal/55">Community corroboration and discussion</p></div>
              <div className="rounded-xl bg-secondary/60 p-3"><p className="text-[11px] uppercase tracking-wide text-charcoal/50">Chai heat</p><div className="mt-2"><ChaiHeatMeter heat={issue.chaiHeat} size="sm" /></div><p className="mt-2 text-xs text-charcoal/55">Community support signal</p></div>
            </div>
          </header>

          {issue.duplicateOf && <p className="mt-5 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm text-charcoal/75">A reviewer linked this report to an existing issue. Follow progress on the <Link href={`/issues/${encodeURIComponent(issue.duplicateOf)}`} className="font-semibold text-chai underline">canonical issue report</Link>.</p>}

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="font-display text-lg font-bold">Complaint summary</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-charcoal/75">{issue.description}</p><p className="mt-3 text-xs leading-relaxed text-charcoal/50">Original-language text and any personal details are withheld from this public page. Authorized case workers can access the protected report record.</p></section>
              {evidence.length > 0 && <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="font-display text-lg font-bold">Protected evidence</h2><p className="mt-1 text-xs text-charcoal/55">Visible only to the report creator and authorized case workers. Signed links expire after two minutes.</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{evidence.map((item) => item.media_type.startsWith('video/') ? <video key={item.id} src={item.url} controls preload="metadata" aria-label={item.caption ?? 'Protected civic complaint evidence'} className="w-full rounded-xl border border-border" /> : <a key={item.id} href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={item.caption ?? 'Protected civic complaint evidence'} className="aspect-square w-full rounded-xl border border-border object-cover" /></a>)}</div></section>}
              <div className="grid gap-4 sm:grid-cols-2"><Factors title="Priority factors" factors={issue.priorityFactors} /><Factors title="Trust / evidence factors" factors={issue.trustFactors} /></div>
              <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="font-display text-lg font-bold">Jurisdiction and official service information</h2><p className="mt-2 text-sm text-charcoal/65">{registry.jurisdiction ? `${registry.jurisdiction.name} · ${registry.jurisdiction.level}` : `PIN ${issue.pin} · ${issue.locality}`}</p>
                {registry.hubs?.length ? <div className="mt-4 space-y-3">{registry.hubs.map((hub) => <article key={hub.id} className="rounded-xl border border-leaf/30 bg-leaf/5 p-4"><p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-leaf" />{hub.name}</p><p className="mt-1 text-sm text-charcoal/70">{hub.address}{hub.ward ? ` · ${hub.ward}` : ''}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-charcoal/65">{hub.public_phone && <a href={`tel:${hub.public_phone}`} className="underline">{hub.public_phone}</a>}{hub.public_email && <a href={`mailto:${hub.public_email}`} className="underline">{hub.public_email}</a>}<a href={hub.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Official source <ExternalLink className="h-3 w-3" /></a></div><p className="mt-1 text-[10px] text-charcoal/45">Verified {hub.verified_at ? new Date(hub.verified_at).toLocaleDateString('en-IN') : 'by authority'} · source version {hub.source_version}</p></article>)}</div> : <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-charcoal/60">No verified public authority hub is registered for this PIN. CivicChai does not guess an office or contact.</p>}
                {registry.officers?.filter((officer) => officer.department === issue.department).map((officer) => <article key={officer.id} className="mt-3 rounded-xl border border-border p-4"><p className="font-semibold">{officer.name} · {officer.role}</p><p className="text-sm text-charcoal/65">{officer.department} · {officer.hub}</p><div className="mt-2 flex gap-4 text-xs">{officer.public_phone && <a href={`tel:${officer.public_phone}`} className="underline">{officer.public_phone}</a>}{officer.public_email && <a href={`mailto:${officer.public_email}`} className="underline">{officer.public_email}</a>}<a href={officer.source_url} target="_blank" rel="noreferrer" className="underline">Source</a></div></article>)}
              </section>
              <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="font-display text-lg font-bold">Applicable public references</h2><p className="mt-1 text-xs text-charcoal/55">Educational information only; not legal advice or a statutory appeal channel.</p>{registry.documents?.length ? <ul className="mt-3 space-y-3">{registry.documents.map((doc) => <li key={doc.id} className="flex gap-3 rounded-xl bg-secondary/50 p-3"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-chai" /><div className="min-w-0"><a href={doc.source_url} target="_blank" rel="noreferrer" className="font-semibold text-chai underline">{doc.title}</a><p className="text-xs text-charcoal/60">{doc.issuing_authority ?? doc.authority}{doc.document_number ? ` · ${doc.document_number}` : ''} · published {new Date(doc.published_at).toLocaleDateString('en-IN')} · version {doc.version ?? '1'}</p></div></li>)}</ul> : <p className="mt-3 text-sm text-charcoal/60">No verified legal or service reference is registered for this jurisdiction. CivicChai will not invent a rule or citation.</p>}
                {activeSla && <p className="mt-4 rounded-lg bg-gold/10 p-3 text-sm">Verified service target: {activeSla.target_hours} hours · <a href={activeSla.source_url} target="_blank" rel="noreferrer" className="underline">source {activeSla.source_version}</a>{issue.slaDueAt ? ` · target date ${new Date(issue.slaDueAt).toLocaleString('en-IN')}` : ''}</p>}
              </section>
              <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="font-display text-lg font-bold">Tracking history</h2><div className="mt-4"><CivicTimeline status={issue.status} issueId={issue.id} /></div></section>
            </div>
            <aside className="space-y-4"><ChaiCard issue={issue} /><EducationCard issue={issue} registry={registry} /></aside>
          </div>
        </>}
      </div>
      <SiteFooter />
    </main>
  )
}
