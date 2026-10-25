'use client'

import dynamic from 'next/dynamic'

function MapLoading() {
  return <div role="status" className="flex h-56 w-full items-center justify-center bg-muted text-xs text-charcoal/55">Loading map…</div>
}

export const LocationPickerMap = dynamic(() => import('./leaflet-maps').then((module) => module.LocationPickerMap), { ssr: false, loading: MapLoading })
export const CommunityMap = dynamic(() => import('./leaflet-maps').then((module) => module.CommunityMap), { ssr: false, loading: MapLoading })
