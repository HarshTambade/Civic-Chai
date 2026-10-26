import { NextResponse } from 'next/server'
import { DEMO_ACCOUNTS } from '@/lib/roles'
import { coversPin } from '@/lib/scope'
import { getSupabaseServiceClient, isLocalDemoModeEnabled } from '@/lib/supabase'

const AREA_ROLES = ['authority_admin', 'department_operator', 'department_supervisor']

/**
 * Whether any authority team covers a PIN, so citizens know before filing if a report
 * will reach staff. It answers yes/no only; staff identities and areas stay private.
 */
export async function GET(request: Request) {
  const pin = new URL(request.url).searchParams.get('pin') ?? ''
  if (!/^\d{6}$/.test(pin)) return NextResponse.json({ error: 'PIN must contain six digits.' }, { status: 400 })
  if (isLocalDemoModeEnabled()) {
    return NextResponse.json({ pin, covered: DEMO_ACCOUNTS.some((account) => AREA_ROLES.includes(account.role) && coversPin(account, pin)) })
  }
  const service = getSupabaseServiceClient()
  if (!service) return NextResponse.json({ pin, covered: null })
  let result = await service.from('profiles').select('id', { count: 'exact', head: true }).in('role', AREA_ROLES).or(`pin.eq.${pin},service_pins.cs.{${pin}}`)
  // Databases without migration 007 only have the single primary PIN.
  if (result.error) result = await service.from('profiles').select('id', { count: 'exact', head: true }).in('role', AREA_ROLES).eq('pin', pin)
  if (result.error) return NextResponse.json({ pin, covered: null })
  return NextResponse.json({ pin, covered: (result.count ?? 0) > 0 }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
