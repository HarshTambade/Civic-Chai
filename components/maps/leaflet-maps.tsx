'use client'

// Leaflet touches `window`, so this module is only ever loaded through ./index.tsx (ssr: false).
import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import Link from 'next/link'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { PublicMapCell } from '@/lib/heatmap'

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

// A CSS pin avoids Leaflet's default marker images, which bundlers do not resolve.
const PIN_ICON = L.divIcon({
  className: '',
  html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;background:#c2552d;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);transform:rotate(-45deg)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
})

function Recenter({ latitude, longitude, zoom }: { latitude: number; longitude: number; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    const current = map.getCenter()
    // Skip when the map is already here (e.g. the user just dragged it to this point).
    if (Math.abs(current.lat - latitude) < 1e-6 && Math.abs(current.lng - longitude) < 1e-6 && (zoom == null || zoom === map.getZoom())) return
    map.setView([latitude, longitude], zoom ?? map.getZoom(), { animate: true })
  }, [latitude, longitude, zoom, map])
  return null
}

/**
 * Re-measures the map whenever its box changes size. Maps created inside an opening sheet
 * or a tab measure themselves mid-animation and otherwise show grey, frozen tiles.
 */
function FitToContainer() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    const refit = () => map.invalidateSize({ pan: false })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refit)
    observer?.observe(container)
    const timer = setTimeout(refit, 350)
    return () => { observer?.disconnect(); clearTimeout(timer) }
  }, [map])
  return null
}

/** True on phones and tablets, where one finger should scroll the page rather than the map. */
export function useCoarsePointer() {
  const [coarse] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)
  return coarse
}

function DragWatcher({ onUserMove }: { onUserMove: (latitude: number, longitude: number) => void }) {
  // Only user drags count; programmatic recentring (GPS, PIN search) must not trigger a lookup.
  useMapEvents({ dragend: (event) => { const center = (event.target as L.Map).getCenter(); onUserMove(center.lat, center.lng) } })
  return null
}

/**
 * Ride-hailing style picker: the pin stays fixed in the middle and the citizen pans the
 * map underneath it. `onUserMove` reports the new centre after each drag.
 */
export function CenterPinMap({ latitude, longitude, zoom, onUserMove, className }: { latitude: number; longitude: number; zoom: number; onUserMove: (latitude: number, longitude: number) => void; className?: string }) {
  return (
    <div className="relative isolate">
      <MapContainer center={[latitude, longitude]} zoom={zoom} zoomControl={false} className={className ?? 'h-72 w-full'}>
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
        <FitToContainer />
        <Recenter latitude={latitude} longitude={longitude} zoom={zoom} />
        <DragWatcher onUserMove={onUserMove} />
      </MapContainer>
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
        <svg viewBox="0 0 24 34" className="h-10 w-7 drop-shadow-md"><path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 34 12 34s12-13.2 12-22.1C24 5.3 18.6 0 12 0Z" fill="#c2552d" /><circle cx="12" cy="12" r="4.6" fill="#fff" /></svg>
      </div>
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[499] h-1.5 w-3 -translate-x-1/2 rounded-full bg-black/30 blur-[1px]" />
    </div>
  )
}

function ClickToMove({ onMove }: { onMove: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (event) => onMove(event.latlng.lat, event.latlng.lng) })
  return null
}

/** Draggable pin for confirming exactly where a problem is. */
export function LocationPickerMap({ latitude, longitude, onMove, className }: { latitude: number; longitude: number; onMove: (latitude: number, longitude: number) => void; className?: string }) {
  const handlers = useMemo(() => ({
    dragend: (event: L.LeafletEvent) => {
      const position = (event.target as L.Marker).getLatLng()
      onMove(position.lat, position.lng)
    },
  }), [onMove])
  return (
    <MapContainer center={[latitude, longitude]} zoom={17} scrollWheelZoom={false} className={className ?? 'h-56 w-full'}>
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
      <FitToContainer />
      <Recenter latitude={latitude} longitude={longitude} />
      <ClickToMove onMove={onMove} />
      <Marker position={[latitude, longitude]} icon={PIN_ICON} draggable eventHandlers={handlers} keyboard alt="Problem location; drag to adjust" />
    </MapContainer>
  )
}

function heatColor(heat: number) {
  return heat >= 65 ? '#c84630' : heat >= 35 ? '#d99a3d' : '#3f6b45'
}

/** Public community map: one circle per ~1 km cell, never an exact report location. */
export function CommunityMap({ cells, center, zoom = 13, you, className }: { cells: PublicMapCell[]; center: [number, number]; zoom?: number; you?: [number, number] | null; className?: string }) {
  // On touch screens one finger scrolls the page past the map; two fingers move and zoom it.
  const coarse = useCoarsePointer()
  const [hint, setHint] = useState(false)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(hintTimer.current), [])
  function showHint(event: TouchEvent) {
    if (!coarse || event.touches.length !== 1) { setHint(false); return }
    setHint(true)
    clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(false), 1400)
  }
  return (
    <div className="relative isolate" onTouchMove={showHint}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={!coarse} dragging={!coarse} className={className ?? 'h-[420px] w-full'}>
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
        <FitToContainer />
        <Recenter latitude={center[0]} longitude={center[1]} zoom={zoom} />
        {you && <CircleMarker center={you} radius={7} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}><Popup>You are here (not shared)</Popup></CircleMarker>}
        {cells.map((cell) => (
          <CircleMarker
            key={`${cell.latitude}:${cell.longitude}`}
            center={[cell.latitude, cell.longitude]}
            radius={Math.min(28, 10 + Math.sqrt(cell.issueCount) * 5)}
            pathOptions={{ color: heatColor(cell.averageChaiHeat), weight: 2, fillColor: heatColor(cell.averageChaiHeat), fillOpacity: 0.35 }}
          >
            <Popup>
              <div className="min-w-48 space-y-1.5">
                <p className="text-xs font-semibold">{cell.issueCount} issue{cell.issueCount === 1 ? '' : 's'} in this area · {cell.averageChaiHeat}° average heat</p>
                <ul className="space-y-1">
                  {cell.issues.map((issue) => <li key={issue.id}><Link href={`/issues/${encodeURIComponent(issue.id)}`} className="text-xs font-medium underline">{issue.title}</Link><span className="block text-[10px] opacity-70">{issue.category} · {issue.status}</span></li>)}
                </ul>
                <p className="text-[10px] opacity-60">Locations are shown to about 1 km for privacy.</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {hint && <div role="status" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-charcoal/45 text-sm font-semibold text-cream">Use two fingers to move the map</div>}
    </div>
  )
}
