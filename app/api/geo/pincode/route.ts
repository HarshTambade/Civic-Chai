import { NextResponse } from 'next/server'
import { consumeRateLimit } from '@/lib/rate-limit'
import { lookupPincode } from '@/lib/geo'

// Validates a six-digit PIN and returns its post-office localities and map centre.
export async function GET(request: Request) {
  const rateLimit = await consumeRateLimit(request, 'geo-lookup', 40, 60)
  if (rateLimit === null) return NextResponse.json({ error: 'Request protection is temporarily unavailable. Please try again shortly.' }, { status: 503 })
  if (!rateLimit) return NextResponse.json({ error: 'Too many PIN lookups. Please wait a moment.' }, { status: 429 })
  const pin = new URL(request.url).searchParams.get('pin') ?? ''
  if (!/^\d{6}$/.test(pin)) return NextResponse.json({ error: 'PIN must contain six digits.' }, { status: 400 })
  try {
    return NextResponse.json(await lookupPincode(pin), { headers: { 'Cache-Control': 'public, max-age=86400' } })
  } catch (error) {
    console.error('PIN lookup failed:', error)
    return NextResponse.json({ error: 'PIN lookup is unavailable right now.' }, { status: 502 })
  }
}
