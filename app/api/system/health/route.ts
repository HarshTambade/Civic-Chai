import { NextResponse } from 'next/server'
import { authorizeRoles } from '@/lib/api-auth'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'

export async function GET(request: Request) {
  const auth = await authorizeRoles(request, ['system_admin'])
  if (auth.response) return auth.response

  const configured = hasSupabaseConfig()
  if (!configured) {
    return NextResponse.json({
      mode: 'local preview',
      database: 'not configured',
      serviceRole: false,
      authProvider: 'local demo sessions',
      publicIntakeEnabled: process.env.NODE_ENV !== 'production' || process.env.CIVICCHAI_PUBLIC_INTAKE_ENABLED === 'true',
      evidenceUploadsEnabled: process.env.NODE_ENV !== 'production' || process.env.CIVICCHAI_EVIDENCE_UPLOADS_ENABLED === 'true',
      profileCount: null,
      checkedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  const service = getSupabaseServiceClient()
  if (!service) {
    return NextResponse.json({
      mode: 'connected deployment',
      database: 'service key missing',
      serviceRole: false,
      authProvider: 'Supabase Auth',
      publicIntakeEnabled: process.env.NODE_ENV !== 'production' || process.env.CIVICCHAI_PUBLIC_INTAKE_ENABLED === 'true',
      evidenceUploadsEnabled: process.env.NODE_ENV !== 'production' || process.env.CIVICCHAI_EVIDENCE_UPLOADS_ENABLED === 'true',
      profileCount: null,
      checkedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  const { count, error } = await service.from('profiles').select('id', { count: 'exact', head: true })
  return NextResponse.json({
    mode: 'connected deployment',
    database: error ? 'unavailable' : 'connected',
    serviceRole: true,
    authProvider: 'Supabase Auth',
    publicIntakeEnabled: process.env.NODE_ENV !== 'production' || process.env.CIVICCHAI_PUBLIC_INTAKE_ENABLED === 'true',
    evidenceUploadsEnabled: process.env.NODE_ENV !== 'production' || process.env.CIVICCHAI_EVIDENCE_UPLOADS_ENABLED === 'true',
    profileCount: error ? null : count ?? 0,
    checkedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
