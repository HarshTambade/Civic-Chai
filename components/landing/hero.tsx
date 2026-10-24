'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Flame, Users, FileText, Clock, ArrowRight } from 'lucide-react'
import { heatLabel } from '@/lib/issue-helpers'
import { useLanguage } from '@/components/language-provider'

export function Hero() {
  const [heat, setHeat] = useState(72)
  const flames = Math.max(1, Math.round(heat / 25))
  const { t } = useLanguage()

  return (
    <section className="paper-grain relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
        {/* Copy */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-chai">
            <span className="font-deva">चर्चा</span> {t.hero.badge}
          </span>

          <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-charcoal sm:text-5xl lg:text-6xl">
            {t.hero.title}
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-charcoal/75 sm:text-lg">
            {t.hero.description}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/citizen"
              className="inline-flex items-center gap-2 rounded-xl bg-chai px-5 py-3 text-sm font-semibold text-cream shadow-sm transition-transform hover:-translate-y-0.5"
            >
              {t.hero.ctaPrimary}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/chai-tapri"
              className="inline-flex items-center gap-2 rounded-xl border border-chai/30 bg-cream px-5 py-3 text-sm font-semibold text-chai transition-colors hover:bg-chai/5"
            >
              {t.hero.ctaSecondary}
            </Link>
          </div>

          <dl className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-charcoal/60">{t.hero.cities}</dt>
              <dd className="font-display text-xl font-bold text-chai">120+</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">{t.hero.issuesResolved}</dt>
              <dd className="font-display text-xl font-bold text-leaf">18.4k</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">{t.hero.languages}</dt>
              <dd className="font-display text-xl font-bold text-terracotta">3+</dd>
            </div>
          </dl>
        </div>

        {/* Visual + interactive heat */}
        <div className="relative">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
            <Image
              src="/images/chai-tapri-hero.png"
              alt="A modern digital interpretation of an Indian chai tapri with a steaming steel chai glass, kulhad, newspaper and a smartphone showing the CivicChai feed"
              width={720}
              height={720}
              priority
              className="h-auto w-full"
            />
          </div>

          {/* Chai Heat interaction card */}
          <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-md sm:absolute sm:-bottom-6 sm:-left-6 sm:mt-0 sm:w-72">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                Chai Heat · example
              </span>
              <span className="text-xs font-medium text-heat">
                {heatLabel(heat)}
              </span>
            </div>
            <div className="mt-1 flex items-end gap-2">
              <span className="font-display text-4xl font-extrabold text-heat">
                {heat}&deg;
              </span>
              <span className="mb-1.5 flex gap-0.5" aria-hidden>
                {Array.from({ length: flames }).map((_, i) => (
                  <Flame key={i} className="h-4 w-4 text-heat" fill="currentColor" />
                ))}
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Station Road Potholes
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />1,842
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />52
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />17d
              </span>
            </div>
            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Add your support — chai ko garam karo
              <input
                type="range"
                min={40}
                max={100}
                value={heat}
                onChange={(e) => setHeat(Number(e.target.value))}
                className="mt-1.5 w-full accent-heat"
                aria-label="Increase chai heat by supporting the issue"
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  )
}
