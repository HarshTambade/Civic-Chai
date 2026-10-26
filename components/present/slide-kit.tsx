'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Building blocks for the 1280×720 deck canvas. The deck scales the canvas to the screen.
// One idea per slide, set in big type; a chai cup heats up as the story moves on.

type Tone = 'light' | 'dark' | 'ink'

const TONES: Record<Tone, string> = {
  light: 'bg-cream text-charcoal',
  dark: 'bg-chai text-cream',
  ink: 'bg-charcoal text-cream',
}

/** Provided by the deck: the slide number and how hot the chai is at this point. */
export const SlideMeta = createContext({ number: '', heat: 20 })

function heatColor(heat: number) {
  return heat >= 75 ? '#c84630' : heat >= 50 ? '#b85c38' : heat >= 35 ? '#d99a3d' : '#a08a74'
}

/** A kulhad-style cup whose colour and steam follow the heat. */
export function HeatCup({ heat, size = 56, showLabel = true }: { heat: number; size?: number; showLabel?: boolean }) {
  const color = heatColor(heat)
  const steam = heat >= 75 ? 3 : heat >= 45 ? 2 : heat >= 30 ? 1 : 0
  return (
    <div className="flex items-center gap-2" aria-label={`Chai heat ${heat} degrees`}>
      <svg viewBox="0 0 48 52" width={size} height={size * 52 / 48} aria-hidden>
        {[14, 22, 30].slice(0, steam).map((x, index) => (
          <path key={x} d={`M${x} 14c-3-4 3-6 0-10`} stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none" className="animate-steam" style={{ animationDelay: `${index * 0.5}s` }} />
        ))}
        <path d="M6 20h32l-3.5 24a5 5 0 0 1-5 4.3H14.5a5 5 0 0 1-5-4.3L6 20Z" fill={color} />
        <path d="M38 24h3a5 5 0 0 1 0 10h-4" stroke={color} strokeWidth="3" fill="none" />
        <path d="M10 27h24" stroke="#fff8ec" strokeOpacity="0.35" strokeWidth="2" />
      </svg>
      {showLabel && <span className="font-display text-[22px] font-extrabold tabular-nums" style={{ color }}>{heat}°</span>}
    </div>
  )
}

export function Slide({ tone = 'light', cup = true, className, children }: { tone?: Tone; cup?: boolean; className?: string; children: ReactNode }) {
  const { number, heat } = useContext(SlideMeta)
  return (
    <div className={cn('relative flex h-full w-full flex-col justify-center overflow-hidden px-[96px] py-[72px]', TONES[tone], className)}>
      {children}
      {cup && <div className="absolute right-[56px] top-[44px]"><HeatCup heat={heat} size={40} /></div>}
      {number && <span className="pointer-events-none absolute bottom-[28px] right-[56px] text-[13px] font-semibold tracking-wide opacity-45">{number}</span>}
    </div>
  )
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[17px] font-bold uppercase tracking-[0.28em] text-terracotta', className)}>{children}</p>
}

/** The one big line a slide exists to say. */
export function Big({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('mt-5 font-display text-[76px] font-extrabold leading-[1.02] tracking-tight', className)}>{children}</h2>
}

export function Line({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-7 max-w-[900px] text-[26px] leading-[1.45] opacity-75', className)}>{children}</p>
}

/** Every figure in the deck carries its source. */
export function Source({ children }: { children: ReactNode }) {
  return <p className="absolute bottom-[28px] left-[96px] right-[260px] text-[13px] leading-snug opacity-50">Source: {children}</p>
}
