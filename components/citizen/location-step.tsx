'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Crosshair, Loader2, MapPin } from 'lucide-react'
import { CenterPinMap } from '@/components/maps'
import type { ReverseGeocode } from '@/lib/geo'
import { reverseLookup, useLiveLocation, usePinCoverage, usePincode } from './use-location'

export type ReportLocation = { pin: string; locality: string; coordinates: { lat: number; lng: number } | null }

const INDIA_CENTER: [number, number] = [20.5937, 78.9629]

/**
 * "Where is the problem?" step, like a ride-hailing pickup screen: detect the device
 * location, let the citizen pan the map under a fixed pin, fill the PIN and locality
 * from the map, and allow both to be changed by hand before continuing.
 */
export function LocationStep({ value, onChange, onConfirm, verifiedArea, autoDetect = true }: { value: ReportLocation; onChange: (next: Partial<ReportLocation>) => void; onConfirm: () => void; verifiedArea?: string; autoDetect?: boolean }) {
  const live = useLiveLocation()
  const pinInfo = usePincode(value.pin)
  const covered = usePinCoverage(value.pin)
  const [center, setCenter] = useState<[number, number]>(value.coordinates ? [value.coordinates.lat, value.coordinates.lng] : INDIA_CENTER)
  const [zoom, setZoom] = useState(value.coordinates ? 17 : 5)
  const [place, setPlace] = useState<ReverseGeocode | null>(null)
  const [resolving, setResolving] = useState(false)
  const [notice, setNotice] = useState('')
  // Set when the citizen typed a PIN, so the map follows the PIN instead of overwriting it.
  const manualPin = useRef(false)
  const started = useRef(false)

  const applyPlace = useCallback((next: ReverseGeocode | null) => {
    setPlace(next)
    if (!next) { setNotice('Could not read the address here. Enter the PIN and locality below.'); return }
    setNotice(next.pin ? '' : 'No PIN code found at this spot. Enter it below.')
    onChange({ ...(next.pin ? { pin: next.pin } : {}), ...(next.locality ? { locality: next.locality } : {}) })
  }, [onChange])

  const detect = useCallback(async () => {
    setNotice('')
    const result = await live.locate()
    if (!result) return
    manualPin.current = false
    setCenter([result.latitude, result.longitude])
    setZoom(17)
    onChange({ coordinates: { lat: result.latitude, lng: result.longitude } })
    applyPlace(result.place)
  }, [live, onChange, applyPlace])

  // Detect the location as soon as the step opens, like a ride-hailing app.
  useEffect(() => {
    if (started.current || !autoDetect) return
    started.current = true
    if (!value.coordinates) void detect()
  }, [detect, value.coordinates, autoDetect])

  // A typed (or saved) PIN moves the map to that area while no exact point is set.
  useEffect(() => {
    const pinCenter = pinInfo.info?.center
    if (!pinCenter || (value.coordinates && !manualPin.current)) return
    setCenter([pinCenter.latitude, pinCenter.longitude])
    setZoom(14)
  }, [pinInfo.info, value.coordinates])

  async function userMoved(latitude: number, longitude: number) {
    manualPin.current = false
    setCenter([latitude, longitude])
    onChange({ coordinates: { lat: latitude, lng: longitude } })
    setResolving(true)
    applyPlace(await reverseLookup(latitude, longitude))
    setResolving(false)
  }

  function typePin(raw: string) {
    const pin = raw.replace(/\D/g, '').slice(0, 6)
    manualPin.current = true
    setPlace(null)
    // The old map point belongs to a different area; the citizen can drag to mark the new spot.
    onChange({ pin, coordinates: null })
  }

  const pinInvalid = value.pin.length === 6 && pinInfo.info && !pinInfo.info.valid
  const ready = /^\d{6}$/.test(value.pin) && Boolean(value.locality.trim()) && !pinInvalid
  const area = place
    ? [place.city, place.district, place.state].filter(Boolean).join(', ')
    : [pinInfo.info?.district, pinInfo.info?.state].filter(Boolean).join(', ')

  return (
    <div className="space-y-4">
      {verifiedArea && <p className="rounded-xl border border-leaf/30 bg-leaf/10 px-3 py-2 text-xs font-semibold text-leaf">Verified QR area: {verifiedArea}. Change it below if the problem is elsewhere.</p>}
      <div>
        <h3 className="font-display text-base font-extrabold text-charcoal">Where is the problem?</h3>
        <p className="text-xs text-charcoal/60">Move the map so the pin sits on the problem. You can also type the PIN and locality.</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border">
        <CenterPinMap latitude={center[0]} longitude={center[1]} zoom={zoom} onUserMove={(latitude, longitude) => void userMoved(latitude, longitude)} className="h-[46dvh] min-h-64 w-full" />
        <button type="button" onClick={() => void detect()} disabled={live.status === 'locating'} aria-label="Use my current location" className="absolute bottom-3 right-3 z-[600] flex h-11 w-11 items-center justify-center rounded-full bg-card text-chai shadow-lg ring-1 ring-border disabled:opacity-70">
          {live.status === 'locating' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
        </button>
        {live.status === 'locating' && <p className="absolute inset-x-3 top-3 z-[600] rounded-lg bg-card/95 px-3 py-2 text-center text-xs font-semibold text-charcoal shadow">Detecting your location…</p>}
      </div>

      <section aria-live="polite" className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
          <div className="min-w-0">
            <p className="truncate font-display font-bold text-charcoal">{resolving ? 'Finding address…' : value.locality || 'Set the location'}</p>
            <p className="text-xs text-charcoal/60">{value.pin ? `PIN ${value.pin}` : 'PIN not set'}{area ? ` · ${area}` : ''}</p>
            {value.coordinates && live.location && !manualPin.current && <p className="text-[11px] text-charcoal/45">GPS accuracy about {Math.round(live.location.accuracy)} m</p>}
          </div>
        </div>
        {(live.error || notice) && <p role="alert" className="mt-2 text-xs text-heat">{live.error || notice}</p>}
      </section>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1 text-xs font-semibold text-charcoal/65">Change PIN or locality</legend>
        <label className="text-xs font-semibold text-charcoal/65">PIN code
          <input value={value.pin} onChange={(event) => typePin(event.target.value)} inputMode="numeric" autoComplete="postal-code" maxLength={6} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-charcoal outline-none focus:border-terracotta" />
        </label>
        <label className="text-xs font-semibold text-charcoal/65">Locality / ward
          <input value={value.locality} onChange={(event) => onChange({ locality: event.target.value.slice(0, 120) })} list="location-step-localities" className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-charcoal outline-none focus:border-terracotta" />
          <datalist id="location-step-localities">{pinInfo.info?.localities.map((name) => <option key={name} value={name} />)}</datalist>
        </label>
      </fieldset>
      {value.pin.length === 6 && <p className="-mt-2 text-[11px] text-charcoal/55">{pinInfo.loading ? 'Checking PIN…' : pinInvalid ? `PIN ${value.pin} was not found. Check the number.` : pinInfo.info?.localities.length ? `Pick from ${pinInfo.info.localities.length} localities in this PIN, or type your own.` : ''}</p>}
      {covered === false && <p role="status" className="-mt-2 rounded-lg border border-gold/50 bg-gold/10 px-3 py-2 text-xs leading-relaxed text-charcoal/75">No authority team covers PIN {value.pin} in this pilot yet. You can still file: the report is public and saved, and staff will see it once this area is added. For urgent problems, also use your municipality&apos;s official helpline.</p>}
      {manualPin.current && !value.coordinates && <p className="-mt-2 text-[11px] text-charcoal/55">Map moved to PIN {value.pin}. Drag it to mark the exact spot (optional).</p>}

      <button type="button" onClick={onConfirm} disabled={!ready || resolving} className="w-full rounded-xl bg-chai px-4 py-3 text-sm font-semibold text-cream disabled:opacity-50">Confirm location</button>
      <p className="text-center text-[11px] text-charcoal/45">The exact point is visible only to authorized staff. Public maps show about 1 km. Address lookup uses OpenStreetMap.</p>
    </div>
  )
}
