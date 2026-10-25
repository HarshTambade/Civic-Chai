'use client'

// Leaflet touches `window`, so this module is only ever loaded through ./index.tsx (ssr: false).
import { useEffect, useMemo } from 'react'
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
    map.setView([latitude, longitude], zoom ?? map.getZoom(), { animate: true })
  }, [latitude, longitude, zoom, map])
  return null
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
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className={className ?? 'h-[420px] w-full'}>
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
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
  )
}
