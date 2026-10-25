import { NextResponse } from 'next/server'
import { getIssues } from '@/lib/issues'
import { buildPublicMapCells } from '@/lib/heatmap'
import { redactPublicText } from '@/lib/privacy'
import { publicErrorMessage } from '@/lib/api-errors'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'

// Public community map. Coordinates are read server-side (they are not public columns)
// and generalized to ~1 km cells before leaving the server.
export async function GET(request: Request) {
  const pin = new URL(request.url).searchParams.get('pin') ?? ''
  if (pin && !/^\d{6}$/.test(pin)) return NextResponse.json({ error: 'PIN must contain six digits.' }, { status: 400 })
  const service = getSupabaseServiceClient()
  if (hasSupabaseConfig() && !service) return NextResponse.json({ error: 'The community map needs the server-only Supabase key.' }, { status: 503 })
  try {
    const issues = (await getIssues(service ?? undefined, Boolean(service)))
      .filter((issue) => issue.isPublic !== false && issue.status !== 'Duplicate' && (!pin || issue.pin === pin))
      .map((issue) => ({ ...issue, title: redactPublicText(issue.title) }))
    const cells = buildPublicMapCells(issues)
    return NextResponse.json({
      cells,
      totalIssues: issues.length,
      mappedIssues: cells.reduce((sum, cell) => sum + cell.issueCount, 0),
    }, { headers: { 'Cache-Control': 'public, max-age=60' } })
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error, 'The community map is unavailable right now.') }, { status: 503 })
  }
}
