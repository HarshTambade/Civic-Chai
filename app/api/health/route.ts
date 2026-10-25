import { NextResponse } from 'next/server'
import { MIGRATION_HELP, isSchemaError, publicErrorMessage } from '@/lib/api-errors'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'
import { REQUIRED_SCHEMA_VERSION, areEvidenceUploadsEnabled, isPublicIntakeEnabled } from '@/lib/deployment'

export async function GET() {
  const configured = hasSupabaseConfig()
  const service = getSupabaseServiceClient()
  let database = false
  let detectedSchemaVersion: number | null = null
  let problem: string | null = null
  if (service) {
    const [{ error: issueError }, { data: schemaVersion, error: schemaError }] = await Promise.all([
      // A one-row read (not head) so a missing column returns its Postgres error code.
      service.from('issues').select('id,state,district,municipality,ward,has_evidence').limit(1),
      service.rpc('civicchai_schema_version'),
    ])
    detectedSchemaVersion = typeof schemaVersion === 'number' ? schemaVersion : null
    database = !issueError && !schemaError && schemaVersion === REQUIRED_SCHEMA_VERSION
    if (issueError) problem = isSchemaError(issueError) ? `${MIGRATION_HELP} (${issueError.message})` : 'The issues table could not be read.'
    else if (schemaError || schemaVersion !== REQUIRED_SCHEMA_VERSION) problem = MIGRATION_HELP
  }
  const ready = configured && Boolean(service) && database
  const production = process.env.NODE_ENV === 'production'
  return NextResponse.json({
    status: ready ? 'ok' : production ? 'not_ready' : 'local_preview',
    supabaseConfigured: configured,
    databaseConnected: database,
    schemaVersion: detectedSchemaVersion,
    requiredSchemaVersion: REQUIRED_SCHEMA_VERSION,
    problem,
    publicIntakeEnabled: isPublicIntakeEnabled(),
    evidenceUploadsEnabled: areEvidenceUploadsEnabled(),
    timestamp: new Date().toISOString(),
  }, {
    status: production && !ready ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
