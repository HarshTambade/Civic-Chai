'use client'

import { ChaiCard } from '@/components/brand/chai-card'
import { ChaiHeatMeter } from '@/components/brand/chai-heat-meter'
import { PriorityBadge } from '@/components/brand/badges'
import { MapPin, TrendingUp } from 'lucide-react'
import type { IssueRecord } from '@/lib/types'
import { useEffect, useState } from 'react'

export function LocalChai() {
  const [issues, setIssues] = useState<IssueRecord[]>([])

  useEffect(() => {
    let cancelled = false

    fetch('/api/public/trending')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed'))))
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.issues)) {
          setIssues(payload.issues)
        }
      })
      .catch(() => {
        if (!cancelled) setIssues([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const featured = issues.slice(0, 3)
  const tags = ['potholes', 'garbage', 'streetlights', 'drainage', 'water', 'traffic']
  return (
    <section id="local-chai" className="paper-grain">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
              Your Local Chai
            </span>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-charcoal sm:text-4xl">
              Civic issues
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-charcoal/60">
              <MapPin className="h-4 w-4 text-terracotta" />
              Public feed · select your PIN in the Citizen Portal
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-charcoal/70"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((issue) => (
            <ChaiCard key={issue.id} issue={issue} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function ChaiTapri() {
  const [issues, setIssues] = useState<Array<IssueRecord & { recentReports?: number; recentSupport?: number }>>([])

  useEffect(() => {
    let cancelled = false

    fetch('/api/public/trending')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed'))))
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.issues)) {
          setIssues(payload.issues)
        }
      })
      .catch(() => {
        if (!cancelled) setIssues([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const score = (issue: (typeof issues)[number]) => ((issue.recentReports ?? 0) * 2 + (issue.recentSupport ?? 0)) * 4 + (issue.priorityScore ?? 0) * 0.3 + issue.chaiHeat * 0.2
  const ranked = [...issues].sort((a, b) => score(b) - score(a) || b.createdAt.localeCompare(a.createdAt)).slice(0, 4)
  return (
    <section id="tapri" className="border-y border-border bg-card">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-heat">
            Chai Tapri
          </span>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-charcoal sm:text-4xl">
            Dekho kis mudde ki chai sabse garam hai.
          </h2>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-charcoal/60">
            <TrendingUp className="h-4 w-4 text-heat" />
            Ranked by heat, priority, growth, independent reports &amp; recency —
            never raw upvotes alone.
          </p>
        </div>

        <ol className="mt-8 space-y-3">
          {ranked.map((issue, i) => (
            <li
              key={issue.id}
              className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4"
            >
              <span className="font-display text-2xl font-extrabold text-charcoal/25">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-bold text-charcoal">
                  {issue.title}
                </p>
                <p className="truncate text-xs text-charcoal/60">
                  {issue.department} &middot; PIN {issue.pin}
                </p>
              </div>
              <PriorityBadge priority={issue.priority} />
              <ChaiHeatMeter heat={issue.chaiHeat ?? 0} size="sm" showLabel={false} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
