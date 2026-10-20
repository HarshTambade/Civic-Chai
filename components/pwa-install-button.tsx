'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

export function PwaInstallButton({ className = '' }: { className?: string }) {
  const [available, setAvailable] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    setIos(isAppleMobile)
    setInstalled(isInstalled)
    setAvailable(Boolean(window.civicChaiInstallPrompt))
    const ready = () => setAvailable(true)
    const installedNow = () => { setInstalled(true); setAvailable(false) }
    window.addEventListener('civicchai:install-ready', ready)
    window.addEventListener('appinstalled', installedNow)
    return () => {
      window.removeEventListener('civicchai:install-ready', ready)
      window.removeEventListener('appinstalled', installedNow)
    }
  }, [])

  useEffect(() => {
    if (!showIosGuide) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowIosGuide(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      restoreFocusRef.current?.focus()
      restoreFocusRef.current = null
    }
  }, [showIosGuide])

  async function install() {
    if (ios) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setShowIosGuide(true)
      return
    }
    const prompt = window.civicChaiInstallPrompt
    if (!prompt) return
    try {
      await prompt.prompt()
      const result = await prompt.userChoice
      if (result.outcome === 'accepted') setAvailable(false)
    } finally {
      window.civicChaiInstallPrompt = undefined
    }
  }

  if (installed || (!available && !ios)) return null

  return <>
    <button type="button" onClick={install} aria-label="Install CivicChai app" className={className}>
      {ios ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      <span>Install</span>
    </button>
    {showIosGuide && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-charcoal/45 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowIosGuide(false) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="ios-install-title" className="w-full max-w-md rounded-[1.75rem] border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-charcoal shadow-2xl sm:pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-terracotta">One quick step</p>
            <h2 id="ios-install-title" className="mt-1 font-display text-xl font-extrabold">Add CivicChai to Home Screen</h2>
          </div>
          <button autoFocus type="button" aria-label="Close install instructions" onClick={() => setShowIosGuide(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-charcoal/70 active:scale-95">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-charcoal/65">In Safari, tap the Share button, then choose <strong className="text-charcoal">Add to Home Screen</strong> and tap Add.</p>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-muted/70 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-chai shadow-sm"><Share className="h-5 w-5" /></span>
          <p className="text-xs leading-relaxed text-charcoal/70">The Share button is in Safari’s bottom toolbar, or at the top of the screen on some iPads.</p>
        </div>
        <button type="button" onClick={() => setShowIosGuide(false)} className="mt-4 min-h-12 w-full rounded-2xl bg-chai px-4 text-sm font-bold text-cream active:scale-[0.99]">Got it</button>
      </section>
    </div>}
  </>
}
