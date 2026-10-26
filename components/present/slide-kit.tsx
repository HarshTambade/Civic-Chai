'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Building blocks for the 1280×720 pitch-deck canvas. Sizes are in canvas pixels;
// the deck scales the whole canvas to the screen, so text stays proportional.

type Tone = 'light' | 'dark' | 'ink'

const TONES: Record<Tone, string> = {
  light: 'bg-cream text-charcoal',
  dark: 'bg-chai text-cream',
  ink: 'bg-charcoal text-cream',
}

/** Set by the deck so each slide prints its own number in its own colours. */
export const SlideNumber = createContext('')

export function Slide({ tone = 'light', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  const number = useContext(SlideNumber)
  return (
    <div className={cn('relative flex h-full w-full flex-col overflow-hidden px-[72px] py-[56px]', TONES[tone], className)}>
      {children}
      {number && <span className="pointer-events-none absolute bottom-[20px] right-[72px] text-[13px] font-semibold opacity-50">{number}</span>}
    </div>
  )
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[15px] font-bold uppercase tracking-[0.22em] text-terracotta', className)}>{children}</p>
}

export function Title({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('mt-3 font-display text-[46px] font-extrabold leading-[1.08] tracking-tight', className)}>{children}</h2>
}

export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-4 max-w-[980px] text-[21px] leading-[1.5] opacity-80', className)}>{children}</p>
}

export function Stat({ value, label, note, tone = 'text-terracotta', dark = false }: { value: string; label: string; note?: string; tone?: string; dark?: boolean }) {
  return (
    <div className={cn('rounded-[22px] border p-6', dark ? 'border-white/15 bg-white/10' : 'border-black/10 bg-white/70')}>
      <p className={cn('font-display text-[44px] font-extrabold leading-none', tone)}>{value}</p>
      <p className="mt-3 text-[18px] font-semibold leading-snug">{label}</p>
      {note && <p className="mt-1.5 text-[14px] leading-snug opacity-60">{note}</p>}
    </div>
  )
}

export function Card({ title, children, className, accent, dark = false }: { title?: ReactNode; children: ReactNode; className?: string; accent?: string; dark?: boolean }) {
  return (
    <div className={cn('rounded-[20px] border p-5', dark ? 'border-white/15 bg-white/10' : 'border-chai/15 bg-white/70', accent, className)}>
      {title && <p className="font-display text-[20px] font-bold leading-snug">{title}</p>}
      <div className={cn('text-[16px] leading-[1.5] opacity-80', title && 'mt-2')}>{children}</div>
    </div>
  )
}

/** Source line for any figure on a slide. Every number in the deck carries one. */
export function Sources({ children }: { children: ReactNode }) {
  return <p className="absolute bottom-[22px] left-[72px] right-[200px] text-[12px] leading-snug opacity-55">Sources: {children}</p>
}

export function Bullets({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={cn('space-y-3 text-[19px] leading-[1.45]', className)}>
      {items.map((item, index) => <li key={index} className="flex gap-3"><span aria-hidden className="mt-[10px] h-2 w-2 shrink-0 rounded-full bg-terracotta" />{item}</li>)}
    </ul>
  )
}
