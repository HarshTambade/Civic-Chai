import { NextResponse } from 'next/server'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'

export async function GET() {
  const configured = hasSupabaseConfig()
  const service = getSupabaseServiceClient()
  let database = false
  if (service) {
    const [{ error: issueError }, { data: schemaVersion, error: schemaError }] = await Promise.all([
      service.from('issues').select('id,state,district,municipality,ward,has_evidence', { head: true, count: 'exact' }),
      service.rpc('civicchai_schema_version'),
    ])
    database = !issueError && !schemaError && schemaVersion === 3
  }
  const ready = configured && Boolean(service) && database
  const production = process.env.NODE_ENV === 'production'
  return NextResponse.json({
    status: ready ? 'ok' : production ? 'not_ready' : 'local_preview',
    supabaseConfigured: configured,
    databaseConnected: database,
    timestamp: new Date().toISOString(),
  }, {
    status: production && !ready ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
