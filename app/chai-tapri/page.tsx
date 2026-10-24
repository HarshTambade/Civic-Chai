'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Flame, TrendingUp } from 'lucide-react'
import { ChaiHeatMeter } from '@/components/brand/chai-heat-meter'
import { PriorityBadge } from '@/components/brand/badges'
import { SiteFooter } from '@/components/landing/site-footer'
import { SiteNav } from '@/components/landing/site-nav'
import { useLanguage } from '@/components/language-provider'
import type { IssueRecord } from '@/lib/types'
import { hottestScore } from '@/lib/issue-helpers'

export default function ChaiTapriPage() {
  const { t } = useLanguage()
  const [issues, setIssues] = useState<IssueRecord[]>([])

  useEffect(() => {
    let cancelled = false

    fetch('/api/public/trending')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed'))))
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.issues)) setIssues(payload.issues.filter((issue: IssueRecord) => !['Duplicate', 'Closed'].includes(issue.status)))
      })
      .catch(() => {
        if (!cancelled) setIssues([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const ranked = [...issues].sort((a, b) => hottestScore(b) - hottestScore(a)).slice(0, 6)

  return (
    <main className="min-h-dvh bg-background text-charcoal">
      <SiteNav />

      <section className="paper-grain border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:py-20">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-heat">
            {t.tapriPage.eyebrow}
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-charcoal sm:text-5xl">
            {t.tapriPage.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-charcoal/75">
            {t.tapriPage.subtitle}
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
                {t.tapriPage.trendingLabel}
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold text-charcoal sm:text-3xl">
                {t.tapriPage.trendTitle}
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-charcoal/70">
              <TrendingUp className="h-4 w-4 text-heat" />
              {t.tapriPage.realTimeSignal}
            </div>
          </div>

          {ranked.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-charcoal/60">No public issues are trending yet.</p>}
          <ol className="space-y-4">
            {ranked.map((issue, index) => (
              <li
                key={issue.id}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm md:flex-row md:items-center"
              >
                <div className="flex min-w-[56px] items-center justify-center">
                  <span className="font-display text-3xl font-extrabold text-charcoal/20">
                    {index + 1}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/issues/${encodeURIComponent(issue.id)}`} className="truncate font-display text-xl font-bold text-charcoal hover:text-chai hover:underline">{issue.title}</Link>
                    <PriorityBadge priority={issue.priority} />
                  </div>
                  <p className="mt-1 text-sm text-charcoal/60">
                    {issue.department} · PIN {issue.pin} · {issue.locality}
                  </p>
                </div>

                <div className="flex items-center gap-3 md:justify-end">
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-charcoal/45">
                      {t.tapriPage.heat}
                    </p>
                    <p className="font-display text-xl font-extrabold text-heat">{issue.chaiHeat}</p>
                  </div>
                  <ChaiHeatMeter heat={issue.chaiHeat} size="sm" showLabel={false} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {t.tapriPage.cards.map(({ title, text }, index) => {
              const iconMap = [Flame, TrendingUp, ArrowRight]
              const Icon = iconMap[index] ?? ArrowRight
              return (
                <div key={title} className="rounded-2xl border border-border bg-background p-5">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-heat/10 text-heat">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold text-charcoal">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal/70">{text}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/citizen"
              className="inline-flex items-center gap-2 rounded-xl bg-chai px-6 py-3.5 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
            >
              {t.tapriPage.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
