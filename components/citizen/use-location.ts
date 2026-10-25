'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PincodeInfo, ReverseGeocode } from '@/lib/geo'

export type LiveLocation = { latitude: number; longitude: number; accuracy: number; place: ReverseGeocode | null }

function geolocationMessage(code?: number) {
  if (code === 1) return 'Location permission is blocked. Allow location for this site in your browser settings, or enter the PIN and locality yourself.'
  if (code === 3) return 'Finding your location took too long. Move near a window or try again.'
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'Live location needs a secure (https) connection.'
  return 'Your location could not be found. Enter the PIN and locality yourself.'
}

export async function reverseLookup(latitude: number, longitude: number): Promise<ReverseGeocode | null> {
  try {
    const response = await fetch(`/api/geo/reverse?lat=${latitude.toFixed(6)}&lng=${longitude.toFixed(6)}`)
    return response.ok ? await response.json() as ReverseGeocode : null
  } catch {
    return null
  }
}

/** One-shot device location plus the PIN code and locality it falls in. */
export function useLiveLocation() {
  const [location, setLocation] = useState<LiveLocation | null>(null)
  const [status, setStatus] = useState<'idle' | 'locating' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const locate = useCallback(() => new Promise<LiveLocation | null>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error'); setError('This browser cannot share its location. Enter the PIN and locality yourself.'); resolve(null); return
    }
    setStatus('locating'); setError('')
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude, accuracy } = position.coords
      const place = await reverseLookup(latitude, longitude)
      const next = { latitude, longitude, accuracy, place }
      setLocation(next)
      setStatus('done')
      if (!place) setError('Location found, but the address lookup is unavailable. Enter the PIN and locality yourself.')
      resolve(next)
    }, (failure) => {
      setStatus('error'); setError(geolocationMessage(failure.code)); resolve(null)
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
  }), [])

  const clear = useCallback(() => { setLocation(null); setStatus('idle'); setError('') }, [])

  return { location, setLocation, status, error, locate, clear }
}

/** True when the visitor already granted location access, so asking will not show a prompt. */
export async function locationAlreadyAllowed() {
  try {
    const permission = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    return permission?.state === 'granted'
  } catch {
    return false
  }
}

/** Post-office localities, district and map centre for a complete six-digit PIN. */
export function usePincode(pin: string) {
  const [info, setInfo] = useState<PincodeInfo | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!/^\d{6}$/.test(pin)) { setInfo(null); return }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      fetch(`/api/geo/pincode?pin=${pin}`)
        .then((response) => response.ok ? response.json() as Promise<PincodeInfo> : null)
        .then((payload) => { if (!cancelled) setInfo(payload) })
        .catch(() => { if (!cancelled) setInfo(null) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [pin])
  return { info, loading }
}
