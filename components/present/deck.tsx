'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Download, LayoutGrid, Maximize, Minimize, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SLIDES } from './slides'
import { SlideMeta } from './slide-kit'

const WIDTH = 1280
const HEIGHT = 720
const CONTROLS = 64

function slideFromHash() {
  if (typeof window === 'undefined') return 0
  const number = Number(window.location.hash.replace('#', ''))
  return Number.isInteger(number) && number >= 1 && number <= SLIDES.length ? number - 1 : 0
}

function Canvas({ index }: { index: number }) {
  return (
    <div role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${SLIDES.length}: ${SLIDES[index].title}`} className="relative h-full w-full">
      {/* The cup heats from 20° on the first slide to 95° on the last. */}
      <SlideMeta.Provider value={{ number: `${String(index + 1).padStart(2, '0')} / ${SLIDES.length}`, heat: Math.round(20 + (75 * index) / Math.max(1, SLIDES.length - 1)) }}>{SLIDES[index].render()}</SlideMeta.Provider>
    </div>
  )
}

/** Full-screen pitch deck: a fixed 16:9 canvas scaled to the viewport. */
export function Deck() {
  const [index, setIndex] = useState(0)
  const [scale, setScale] = useState(1)
  const [overview, setOverview] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const touchStart = useRef<number | null>(null)

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, next))
    setIndex(clamped)
    window.history.replaceState(null, '', `#${clamped + 1}`)
  }, [])

  useEffect(() => { setIndex(slideFromHash()) }, [])

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / WIDTH, (window.innerHeight - CONTROLS) / HEIGHT))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      // Space/Enter on a focused control should press it, not also change the slide.
      const onControl = (event.target as Element | null)?.closest?.('button, a, input, select, textarea')
      if (onControl && [' ', 'Enter'].includes(event.key)) return
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(event.key)) { event.preventDefault(); go(index + 1) }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(event.key)) { event.preventDefault(); go(index - 1) }
      else if (event.key === 'Home') go(0)
      else if (event.key === 'End') go(SLIDES.length - 1)
      else if (event.key.toLowerCase() === 'f') toggleFullscreen()
      else if (event.key.toLowerCase() === 'o') setOverview((open) => !open)
      else if (event.key === 'Escape') setOverview(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index, toggleFullscreen])

  const progress = ((index + 1) / SLIDES.length) * 100

  return (
    <>
      {/* One 16:9 page per slide when printing or saving as PDF. */}
      <style>{'@media print { @page { size: 1280px 720px; margin: 0; } }'}</style>
      <div className="hidden print:block">
        {SLIDES.map((slide, slideIndex) => (
          <div key={slide.id} style={{ width: WIDTH, height: HEIGHT, breakAfter: slideIndex === SLIDES.length - 1 ? 'auto' : 'page' }} className="overflow-hidden"><Canvas index={slideIndex} /></div>
        ))}
      </div>

      <main
        className="fixed inset-0 flex flex-col bg-[#171310] text-cream print:hidden"
        onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null }}
        onTouchEnd={(event) => {
          const start = touchStart.current
          const end = event.changedTouches[0]?.clientX
          touchStart.current = null
          if (start == null || end == null || Math.abs(end - start) < 50) return
          go(end < start ? index + 1 : index - 1)
        }}
      >
        <div className="h-1 w-full bg-white/10" aria-hidden><div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${progress}%` }} /></div>
        <div className="flex flex-1 items-center justify-center overflow-hidden">
          <div style={{ width: WIDTH * scale, height: HEIGHT * scale }} className="relative overflow-hidden rounded-md shadow-2xl">
            <div style={{ width: WIDTH, height: HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <Canvas index={index} />
            </div>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">Slide {index + 1} of {SLIDES.length}: {SLIDES[index].title}</p>

        <nav aria-label="Presentation controls" className="flex h-[60px] shrink-0 items-center justify-between gap-2 px-3 sm:px-5">
          <Link href="/" className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-cream/75 hover:bg-white/10"><X className="h-4 w-4" /><span className="hidden sm:inline">Exit</span></Link>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide" className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
            <span className="min-w-[96px] text-center text-sm tabular-nums text-cream/80"><span className="hidden md:inline">{SLIDES[index].title} · </span>{index + 1} / {SLIDES.length}</span>
            <button type="button" onClick={() => go(index + 1)} disabled={index === SLIDES.length - 1} aria-label="Next slide" className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setOverview(true)} aria-label="All slides" title="All slides (O)" className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10"><LayoutGrid className="h-4 w-4" /></button>
            <button type="button" onClick={() => window.print()} aria-label="Download as PDF" title="Download as PDF" className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10"><Download className="h-4 w-4" /></button>
            <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} title="Full screen (F)" className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10">{fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</button>
          </div>
        </nav>

        {overview && (
          <div role="dialog" aria-modal="true" aria-label="All slides" className="absolute inset-0 z-10 overflow-y-auto bg-[#171310]/95 p-4 backdrop-blur sm:p-8">
            <div className="mb-4 flex items-center justify-between"><p className="font-display text-lg font-bold">All slides</p><button type="button" onClick={() => setOverview(false)} aria-label="Close overview" className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10"><X className="h-5 w-5" /></button></div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {SLIDES.map((slide, slideIndex) => (
                <button key={slide.id} type="button" onClick={() => { go(slideIndex); setOverview(false) }} className={cn('overflow-hidden rounded-md text-left ring-2 transition', slideIndex === index ? 'ring-gold' : 'ring-transparent hover:ring-white/30')}>
                  <div className="relative aspect-video w-full overflow-hidden bg-cream">
                    <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: WIDTH, height: HEIGHT, transform: 'scale(var(--thumb-scale))' }} ref={(node) => { if (node?.parentElement) node.style.setProperty('--thumb-scale', String(node.parentElement.clientWidth / WIDTH)) }}>
                      <Canvas index={slideIndex} />
                    </div>
                  </div>
                  <p className="px-1 py-1.5 text-xs text-cream/75">{slideIndex + 1}. {slide.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  )
}
