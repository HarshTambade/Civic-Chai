'use client'

import Link from 'next/link'
import {
  Camera,
  MessageSquare,
  Brain,
  CopyCheck,
  Users,
  Flame,
  Building2,
  Activity,
  Mic,
  Phone,
  Keyboard,
  Globe,
  ArrowRight,
} from 'lucide-react'
import { useLanguage } from '@/components/language-provider'

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-2 text-balance font-display text-3xl font-extrabold tracking-tight text-charcoal sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-pretty text-base leading-relaxed text-charcoal/70">
          {subtitle}
        </p>
      )}
    </div>
  )
}

export function WhatIs() {
  const { t } = useLanguage()

  return (
    <section id="about" className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow={t.sections.whatIsEyebrow}
          title={t.sections.whatIsTitle}
          subtitle={t.sections.whatIsSubtitle}
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {t.landing.whatIsCards.map((card, index) => {
            const icons = [MessageSquare, Brain, Building2]
            const Icon = icons[index] ?? MessageSquare
            return (
              <div
                key={card.title}
                className="rounded-2xl border border-border bg-background p-6"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-chai/10 text-chai">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-charcoal">
                  {card.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-charcoal/70">
                  {card.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const FLOW = [
  { icon: Camera },
  { icon: MessageSquare },
  { icon: Brain },
  { icon: CopyCheck },
  { icon: Users },
  { icon: Flame },
  { icon: Building2 },
  { icon: Activity },
]

export function HowItWorks() {
  const { t } = useLanguage()

  return (
    <section id="how" className="paper-grain">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow={t.sections.howEyebrow}
          title={t.sections.howTitle}
          subtitle={t.sections.howSubtitle}
        />
        <ol className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FLOW.map((step, i) => (
            <li
              key={t.landing.howFlow[i] ?? `step-${i}`}
              className="relative flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex w-full items-center justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="font-display text-sm font-bold text-charcoal/30">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="text-sm font-semibold text-charcoal">{t.landing.howFlow[i]}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function Channels() {
  const { t } = useLanguage()
  const items = t.landing.channels.map((channel, index) => {
    const icons = [Mic, Phone, Keyboard]
    const Icon = icons[index] ?? Mic
    return {
      icon: Icon,
      title: channel.title,
      description: channel.description,
    }
  })
  return (
    <section className="border-y border-border bg-chai text-cream">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-gold">
            {t.landing.channelEyebrow}
          </span>
          <h2 className="mt-2 text-balance font-display text-3xl font-extrabold sm:text-4xl">
            {t.landing.channelTitle}
          </h2>
          <p className="mt-3 text-pretty leading-relaxed text-cream/75">
            {t.landing.channelSubtitle}
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {items.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-cream/15 bg-cream/5 p-6"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold/20 text-gold">
                <c.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{c.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-cream/70">
                {c.description}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-cream/70">
          <Globe className="h-4 w-4 text-gold" />
          {t.landing.channelFooter}
        </div>
      </div>
    </section>
  )
}

export function GovPreview() {
  const { t } = useLanguage()

  return (
    <section className="paper-grain">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
            {t.sections.finalEyebrow}
          </span>
          <h2 className="mt-2 text-balance font-display text-3xl font-extrabold tracking-tight text-charcoal sm:text-4xl">
            {t.sections.finalTitle}
          </h2>
          <p className="mt-3 text-pretty leading-relaxed text-charcoal/70">
            {t.sections.finalSubtitle}
          </p>
          <Link
            href="/control-room"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-charcoal px-5 py-3 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
          >
            {t.sections.finalCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3" aria-label="Illustrative dashboard figures, not live data">
          <p className="col-span-2 text-[11px] font-semibold uppercase tracking-wide text-charcoal/45">Illustrative dashboard · not live pilot data</p>
          {[
            { k: 'Total Issues', v: '4,218', c: 'text-charcoal' },
            { k: 'Critical', v: '46', c: 'text-heat' },
            { k: 'Overdue', v: '112', c: 'text-terracotta' },
            { k: 'Resolved', v: '3,006', c: 'text-leaf' },
          ].map((s) => (
            <div
              key={s.k}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">
                {s.k}
              </p>
              <p className={`mt-1 font-display text-3xl font-extrabold ${s.c}`}>
                {s.v}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FinalCTA() {
  const { t } = useLanguage()

  return (
    <section className="border-t border-border bg-card">
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <p className="mx-auto max-w-2xl text-balance font-display text-2xl font-bold leading-snug text-charcoal sm:text-3xl">
          {t.landing.finalTitle}
        </p>
        <p className="mt-6 text-lg font-semibold text-terracotta">
          {t.landing.finalSubtitle}
        </p>
        <Link
          href="/citizen"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-chai px-6 py-3.5 text-sm font-semibold text-cream shadow-sm transition-transform hover:-translate-y-0.5"
        >
          {t.landing.finalCta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}
