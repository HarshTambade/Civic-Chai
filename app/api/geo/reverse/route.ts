import { NextResponse } from 'next/server'
import { consumeRateLimit } from '@/lib/rate-limit'
import { isValidCoordinate, reverseGeocode } from '@/lib/geo'

// Finds the PIN code and locality for the citizen's device location. The result is a
// suggestion the citizen confirms; it is never stored on its own.
export async function GET(request: Request) {
  const rateLimit = await consumeRateLimit(request, 'geo-lookup', 40, 60)
  if (rateLimit === null) return NextResponse.json({ error: 'Request protection is temporarily unavailable. Please try again shortly.' }, { status: 503 })
  if (!rateLimit) return NextResponse.json({ error: 'Too many location lookups. Please wait a moment.' }, { status: 429 })
  const url = new URL(request.url)
  const latitude = Number(url.searchParams.get('lat'))
  const longitude = Number(url.searchParams.get('lng'))
  if (!isValidCoordinate(latitude, longitude)) return NextResponse.json({ error: 'Provide a valid latitude and longitude.' }, { status: 400 })
  try {
    return NextResponse.json(await reverseGeocode(latitude, longitude), { headers: { 'Cache-Control': 'private, max-age=3600' } })
  } catch (error) {
    console.error('Reverse geocoding failed:', error)
    return NextResponse.json({ error: 'Address lookup is unavailable right now. Enter the PIN code and locality manually.' }, { status: 502 })
  }
}
