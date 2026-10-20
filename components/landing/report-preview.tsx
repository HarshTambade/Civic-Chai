'use client'

import { useEffect, useState } from 'react'
import type { IssueRecord } from '@/lib/types'
import { ChaiHeatMeter } from '@/components/brand/chai-heat-meter'
import { CivicTimeline } from '@/components/brand/civic-timeline'
import { PriorityBadge, TrustBadge } from '@/components/brand/badges'
import { Logo } from '@/components/brand/logo'
import { Building2, MapPin, Phone, ShieldCheck, FileText } from 'lucide-react'

export function ReportPreview() {
  const [issue, setIssue] = useState<IssueRecord | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/public/issues')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed'))))
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.issues) && payload.issues.length > 0) {
          setIssue(payload.issues[1] ?? payload.issues[0])
        }
      })
      .catch(() => {
        if (!cancelled) setIssue(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const currentIssue: IssueRecord = issue ?? {
    documentId: 'CC-READY-000001',
    title: 'Community issue intake',
    locality: 'Your neighbourhood',
    description:
      'This section will display a live civic issue as soon as the app receives data from the issue feed.',
    department: 'Municipal operations',
    pin: 'Local feed',
    hub: 'No verified authority hub',
    officer: 'Assignment pending',
    priority: 'Moderate' as const,
    trust: 0,
    reports: 0,
    supporters: 0,
    comments: 0,
    daysUnresolved: 0,
    status: 'Filed' as const,
    chaiHeat: 0,
    id: 'placeholder',
    category: 'General',
    createdAt: new Date().toISOString(),
  }

  return (
    <section className="paper-grain">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
            Your complaint becomes a Civic Report
          </span>
          <h2 className="mt-2 text-balance font-display text-3xl font-extrabold tracking-tight text-charcoal sm:text-4xl">
            Social post &rarr; official civic case file.
          </h2>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-chai px-6 py-4 text-cream">
            <div className="flex items-center gap-3">
              <Logo showWordmark={false} variant="inverted" />
              <div>
                <p className="text-xs uppercase tracking-widest text-cream/60">
                  CivicChai Report
                </p>
                <p className="font-mono text-sm font-semibold">
                  {currentIssue.documentId}
                </p>
              </div>
            </div>
            <PriorityBadge priority={currentIssue.priority} />
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h3 className="font-display text-xl font-extrabold text-charcoal">
                {currentIssue.title} — {currentIssue.locality}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
                {currentIssue.description}
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <Detail icon={Building2} k="Department" v={currentIssue.department} />
                <Detail icon={MapPin} k="PIN Hub" v={`${currentIssue.pin} · ${currentIssue.hub}`} />
                <Detail icon={ShieldCheck} k="Officer / Office" v={currentIssue.officer ?? 'Assigned by workflow'} />
                <Detail icon={Phone} k="Official Contact" v={currentIssue.isDemo ? 'No verified contact in this demo' : 'Shown only when authority verified'} />
              </dl>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <TrustBadge trust={currentIssue.trust} />
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs text-charcoal/70">
                  <FileText className="h-3.5 w-3.5" />
                  {currentIssue.reports} independent reports
                </span>
              </div>

              <div className="mt-5 rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                  Relevant public reference
                </p>
                <p className="mt-1 text-sm text-charcoal/80">
                  This detail is populated from your live civic workflow once Supabase is connected.
                </p>
                <p className="mt-2 text-xs italic text-charcoal/50">
                  For civic education only — not legal advice.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-5">
              <ChaiHeatMeter heat={currentIssue.chaiHeat ?? 0} size="lg" />
              <p className="mt-1 text-xs text-charcoal/60">
                {(currentIssue.supporters ?? 0).toLocaleString('en-IN')} supporters &middot;{' '}
                {currentIssue.daysUnresolved} days unresolved
              </p>
              <div className="my-4 h-px bg-border" />
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                Tracking timeline
              </p>
              <CivicTimeline status={currentIssue.status} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Detail({
  icon: Icon,
  k,
  v,
}: {
  icon: React.ElementType
  k: string
  v: string
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-charcoal/50">
        <Icon className="h-3.5 w-3.5" />
        {k}
      </dt>
      <dd className="mt-1 text-sm font-medium text-charcoal">{v}</dd>
    </div>
  )
}
