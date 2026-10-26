import { NextResponse } from 'next/server'
import { getRequestContext } from '@/lib/api-auth'
import { PRIVACY_NOTICE_VERSION } from '@/lib/legal'

const PROFILE_FIELDS = 'id,display_name,city,ward,locality,preferred_pin,preferred_language,notification_preferences,consent_preferences,privacy_notice_version,privacy_notice_at'

export async function GET(request: Request) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to view your profile.' }, { status: 401 })
  if (!client) return NextResponse.json({ profile: { id: actor.id, display_name: actor.name ?? '', locality: '', preferred_pin: '', preferred_language: 'en', notification_preferences: {}, consent_preferences: {} } })
  const { data, error } = await client.from('profiles').select(PROFILE_FIELDS).eq('id', actor.id).single()
  if (error) return NextResponse.json({ error: 'Unable to load your profile.' }, { status: 500 })
  return NextResponse.json({ profile: data })
}

export async function PATCH(request: Request) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to update your profile.' }, { status: 401 })
  try {
    const body = await request.json()
    const preferredLanguage = ['en', 'hi', 'mr'].includes(body.preferred_language) ? body.preferred_language : 'en'
    const preferredPin = String(body.preferred_pin ?? '').trim()
    if (preferredPin && !/^\d{6}$/.test(preferredPin)) return NextResponse.json({ error: 'Preferred area PIN must contain six digits.' }, { status: 400 })
    const update = {
      display_name: String(body.display_name ?? actor.name ?? '').trim().slice(0, 80) || 'CivicChai citizen',
      city: String(body.city ?? '').trim().slice(0, 120) || null,
      ward: String(body.ward ?? '').trim().slice(0, 100) || null,
      locality: String(body.locality ?? '').trim().slice(0, 120) || null,
      preferred_pin: preferredPin || null,
      preferred_language: preferredLanguage,
      notification_preferences: body.notification_preferences && typeof body.notification_preferences === 'object' ? body.notification_preferences : {},
      consent_preferences: body.consent_preferences && typeof body.consent_preferences === 'object' ? body.consent_preferences : {},
      privacy_notice_version: PRIVACY_NOTICE_VERSION,
      privacy_notice_at: new Date().toISOString(),
    }
    if (!client) return NextResponse.json({ profile: { id: actor.id, ...update } })
    const { data, error } = await client.from('profiles').update(update).eq('id', actor.id).select(PROFILE_FIELDS).single()
    if (error) throw error
    return NextResponse.json({ profile: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update your profile.' }, { status: 400 })
  }
}
