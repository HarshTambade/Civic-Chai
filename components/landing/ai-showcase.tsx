'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChaiHeatMeter } from '@/components/brand/chai-heat-meter'
import { Sparkles, ArrowRight, Flame, CircleAlert } from 'lucide-react'

const SAMPLES = [
  { lang: 'English', text: 'Streetlights haven\u2019t worked for 15 days.' },
  { lang: 'Hindi', text: '15 din se streetlight band hai.', deva: true },
  { lang: 'Marathi', text: '\u0967\u096B \u0926\u093F\u0935\u0938\u093E\u0902\u092A\u093E\u0938\u0942\u0928 \u0938\u094D\u091F\u094D\u0930\u0940\u091F\u0932\u093E\u0907\u091F \u092C\u0902\u0926 \u0906\u0939\u0947.', deva: true },
  { lang: 'Hinglish', text: 'Station road ki light 15 din se band hai.' },
]

export function AIShowcase() {
  const [active, setActive] = useState(1)

  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
            AI that understands your complaint
          </span>
          <h2 className="mt-2 text-balance font-display text-3xl font-extrabold tracking-tight text-charcoal sm:text-4xl">
            Bolo kisi bhi bhasha mein. AI sab samajh leta hai.
          </h2>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-center">
          {/* input languages */}
          <div className="space-y-2.5">
            {SAMPLES.map((s, i) => (
              <button
                key={s.lang}
                onClick={() => setActive(i)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors',
                  active === i
                    ? 'border-terracotta bg-terracotta/5'
                    : 'border-border bg-background hover:border-terracotta/40',
                )}
              >
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-semibold',
                    active === i
                      ? 'bg-terracotta text-cream'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {s.lang}
                </span>
                <span
                  className={cn(
                    'text-sm text-charcoal',
                    s.deva && 'font-deva',
                  )}
                >
                  {s.text}
                </span>
              </button>
            ))}
          </div>

          {/* AI output */}
          <div className="rounded-2xl border border-chai/20 bg-chai/5 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-chai">
              <Sparkles className="h-4 w-4" />
              AI ne problem samajh li
            </div>
            <div className="mt-4 space-y-3">
              {[
                ['Detected language', SAMPLES[active].lang],
                ['Category', 'Public Lighting'],
                ['Issue', 'Streetlight outage'],
                ['Location', 'PIN 401208'],
                ['Department', 'Municipal Public Lighting'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-4 border-b border-border pb-2.5 text-sm last:border-0"
                >
                  <span className="text-charcoal/60">{k}</span>
                  <span className="font-semibold text-charcoal">{v}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-charcoal/60">Report confidence</span>
                <span className="rounded-md bg-leaf/15 px-2 py-0.5 font-semibold text-leaf">
                  82%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Duplicate detection */}
        <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
              Don&apos;t file the same complaint twice
            </span>
            <h3 className="mt-2 font-display text-2xl font-extrabold text-charcoal">
              Arre, yeh Chai pehle se chal rahi hai!
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-charcoal/70">
              Before you file, CivicChai looks for similar reports in the same PIN
              by comparing wording, locality and category. Instead of a lonely new
              complaint, you can add your weight to one that&apos;s already gaining heat.
            </p>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm text-charcoal/80">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              We never reject you. You always choose: support the existing
              Charcha, or mark it as a genuinely different problem.
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-charcoal/40">Illustrative example</p>
            <p className="text-xs font-medium text-charcoal/50">Your complaint</p>
            <p className="mt-1 text-sm font-medium text-charcoal">
              &ldquo;Station Road ki lights band hain.&rdquo;
            </p>
            <div className="my-4 flex items-center gap-2 text-xs font-semibold text-terracotta">
              <ArrowRight className="h-4 w-4" />
              Similar civic issue found nearby
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-display text-sm font-bold text-charcoal">
                Streetlights not working on Station Road
              </p>
              <div className="mt-3 flex items-center justify-between">
                <ChaiHeatMeter heat={86} size="sm" />
                <span className="text-xs text-muted-foreground">
                  52 reports &middot; 1,842 supporters
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-heat px-3 py-2.5 text-sm font-semibold text-heat-foreground">
                <Flame className="h-4 w-4" />
                Is Charcha ko Support Karo
              </button>
              <button className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-charcoal">
                Yeh alag problem hai
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
