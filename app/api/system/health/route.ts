import { NextResponse } from 'next/server'
import { authorizeRoles } from '@/lib/api-auth'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'
import { REQUIRED_SCHEMA_VERSION, areEvidenceUploadsEnabled, isPublicIntakeEnabled } from '@/lib/deployment'

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
      publicIntakeEnabled: isPublicIntakeEnabled(),
      evidenceUploadsEnabled: areEvidenceUploadsEnabled(),
      schemaVersion: null,
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
      publicIntakeEnabled: isPublicIntakeEnabled(),
      evidenceUploadsEnabled: areEvidenceUploadsEnabled(),
      schemaVersion: null,
      profileCount: null,
      checkedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  const [{ count, error }, { data: schemaVersion }] = await Promise.all([
    service.from('profiles').select('id', { count: 'exact', head: true }),
    service.rpc('civicchai_schema_version'),
  ])
  return NextResponse.json({
    mode: 'connected deployment',
    database: error ? 'unavailable' : 'connected',
    serviceRole: true,
    authProvider: 'Supabase Auth',
    publicIntakeEnabled: isPublicIntakeEnabled(),
    evidenceUploadsEnabled: areEvidenceUploadsEnabled(),
    schemaVersion: typeof schemaVersion === 'number' ? `${schemaVersion}${schemaVersion === REQUIRED_SCHEMA_VERSION ? '' : ` (requires ${REQUIRED_SCHEMA_VERSION})`}` : `unknown (requires ${REQUIRED_SCHEMA_VERSION})`,
    profileCount: error ? null : count ?? 0,
    checkedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
