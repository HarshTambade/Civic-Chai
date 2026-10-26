import { NextResponse } from 'next/server'
import { coversPin } from '@/lib/scope'
import QRCode from 'qrcode'
import { authorizeRoles } from '@/lib/api-auth'
import { recordFallbackAudit } from '@/lib/audit'
import { canSignQr, signQrArea, verifyQrToken } from '@/lib/qr'
import { getSupabaseServiceClient } from '@/lib/supabase'

function publicOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_BASE_URL
  return (configured && !/localhost/.test(configured) ? configured : new URL(request.url).origin).replace(/\/$/, '')
}

/** Verifies a scanned locality QR token. Public: the token itself carries no personal data. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const area = verifyQrToken(token)
  if (!area) return NextResponse.json({ valid: false, error: 'This is not a verified CivicChai QR code.' }, { status: 404 })
  return NextResponse.json({ valid: true, area })
}

/** Authority administrators generate signed QR codes for places in their jurisdiction. */
export async function POST(request: Request) {
  const auth = await authorizeRoles(request, ['authority_admin'])
  if (auth.response) return auth.response
  if (!canSignQr()) return NextResponse.json({ error: 'QR signing is not configured on the server.' }, { status: 503 })
  try {
    const body = await request.json()
    const pin = String(body.pin ?? '').trim()
    const locality = String(body.locality ?? '').trim().slice(0, 120)
    const ward = String(body.ward ?? '').trim().slice(0, 100)
    if (!/^\d{6}$/.test(pin) || !locality) return NextResponse.json({ error: 'Enter a six-digit PIN and a locality name.' }, { status: 400 })
    if (!coversPin(auth.actor, pin)) return NextResponse.json({ error: 'You can create QR codes only for PINs in your authorized area.' }, { status: 403 })
    const token = signQrArea({ pin, locality, ward })
    const url = `${publicOrigin(request)}/q/${token}`
    const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#2b2118', light: '#ffffff' } })
    const service = getSupabaseServiceClient()
    if (service) await service.from('audit_logs').insert({ actor_id: auth.actor?.id, action: 'qr.created', details: { pin, locality, ward: ward || null } })
    else recordFallbackAudit('qr.created', undefined, auth.actor?.id, { pin, locality, ward: ward || null })
    return NextResponse.json({ url, svg, area: { pin, locality, ward } }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create the QR code.' }, { status: 400 })
  }
}
