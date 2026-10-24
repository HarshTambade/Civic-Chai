'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { civicFetch } from '@/lib/client-api'

export type ServiceArea = {
  pin: string
  locality: string
  consent: { online_ai: boolean; device_location: boolean; offline_storage: boolean }
}

const PROFILE_EVENT = 'civicchai:profile-updated'
const EMPTY_AREA: ServiceArea = { pin: '', locality: '', consent: { online_ai: false, device_location: false, offline_storage: false } }

export function localProfileKey(userId?: string) {
  return `civicchai_profile_settings:${userId ?? 'guest'}`
}

/** Tell every mounted citizen view that the saved area or consent choices changed. */
export function notifyProfileUpdated() {
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT))
}

function toArea(profile: Record<string, any> | null | undefined): ServiceArea {
  if (!profile) return EMPTY_AREA
  const consent = profile.consent_preferences ?? {}
  return {
    pin: typeof profile.preferred_pin === 'string' ? profile.preferred_pin : '',
    locality: typeof profile.locality === 'string' ? profile.locality : '',
    consent: { online_ai: Boolean(consent.online_ai), device_location: Boolean(consent.device_location), offline_storage: Boolean(consent.offline_storage) },
  }
}

/** The citizen's saved service area: the connected profile, or browser storage for guests and local demo sessions. */
export function useServiceArea() {
  const { user, isHydrated } = useAuth()
  const [area, setArea] = useState<ServiceArea>(EMPTY_AREA)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    let cancelled = false
    const load = async () => {
      let next = EMPTY_AREA
      if (user?.demo || !user) {
        try {
          const saved = localStorage.getItem(localProfileKey(user?.id))
          if (saved) next = toArea(JSON.parse(saved))
        } catch {
          // Invalid saved preferences are ignored; the citizen can set the area again.
        }
      } else {
        try {
          const response = await civicFetch('/api/profile')
          if (response.ok) next = toArea((await response.json()).profile)
        } catch {
          // The feed still works without a saved area.
        }
      }
      if (!cancelled) { setArea(next); setLoaded(true) }
    }
    void load()
    window.addEventListener(PROFILE_EVENT, load)
    return () => { cancelled = true; window.removeEventListener(PROFILE_EVENT, load) }
  }, [isHydrated, user?.id, user?.demo])

  return { ...area, loaded }
}
