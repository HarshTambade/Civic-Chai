'use client'

import { useEffect, useState } from 'react'

export type HapticPattern = 'tap' | 'success' | 'warning' | 'error'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 8,
  success: [12, 60, 18],
  warning: [20, 50, 20],
  error: [35, 60, 35],
}

const STORAGE_KEY = 'civicchai.haptics'
const INTERACTIVE = 'button, [role="button"], a[href], summary, select, input[type="checkbox"], input[type="radio"], label'

export function hapticsSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

export function hapticsEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setHapticsEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Without storage the default (on) applies.
  }
}

/** Vibrates on devices that support it (most Android browsers); a silent no-op elsewhere, including iPhone Safari. */
export function haptic(pattern: HapticPattern = 'tap') {
  if (!hapticsSupported() || !hapticsEnabled()) return
  try {
    navigator.vibrate(PATTERNS[pattern])
  } catch {
    // Some browsers block vibration until the page has been interacted with.
  }
}

/** One global listener gives every enabled control a light tap, so no button needs wiring. */
export function HapticFeedback() {
  useEffect(() => {
    if (!hapticsSupported()) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return
      const control = (event.target as Element | null)?.closest?.(INTERACTIVE)
      if (!control || control.matches(':disabled, [aria-disabled="true"]')) return
      haptic('tap')
    }
    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
    return () => document.removeEventListener('pointerdown', onPointerDown, { capture: true })
  }, [])
  return null
}

/** Per-device preference shown in Profile; hidden where the device cannot vibrate. */
export function HapticsToggle() {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(true)
  useEffect(() => { setSupported(hapticsSupported()); setEnabled(hapticsEnabled()) }, [])
  if (!supported) return null
  return (
    <label className="flex items-center gap-2 text-sm text-charcoal/70">
      <input type="checkbox" checked={enabled} onChange={(event) => { setHapticsEnabled(event.target.checked); setEnabled(event.target.checked); if (event.target.checked) haptic('success') }} />
      Vibrate on tap (this device)
    </label>
  )
}
