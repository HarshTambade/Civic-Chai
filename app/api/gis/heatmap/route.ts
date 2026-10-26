import { NextResponse } from 'next/server'
import { canSeeIssue, coversPin } from '@/lib/scope'
import { getRequestContext } from '@/lib/api-auth'
import { canAudit, canManageIssues } from '@/lib/roles'
import { getIssues } from '@/lib/issues'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'
import { buildHeatmapData } from '@/lib/heatmap'

export async function GET(request: Request) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.role) return NextResponse.json({ error: 'Sign in to view civic map data.' }, { status: 401 })
  if (!canManageIssues(actor.role) && !canAudit(actor.role)) return NextResponse.json({ error: 'You do not have access to civic map data.' }, { status: 403 })

  try {
    const service = getSupabaseServiceClient()
    if (hasSupabaseConfig() && !service) return NextResponse.json({ error: 'Civic map data requires the server-only Supabase service key.' }, { status: 503 })
    let issues = await getIssues(service ?? client, true)

    if (canManageIssues(actor.role)) issues = issues.filter((issue) => canSeeIssue(actor, issue))
    else issues = issues.filter((issue) => coversPin(actor, issue.pin))

    const url = new URL(request.url)
    const department = url.searchParams.get('department')?.slice(0, 120) ?? ''
    const category = url.searchParams.get('category')?.slice(0, 100) ?? ''
    const realIssues = issues.filter((issue) => !issue.isDemo)
    const departments = [...new Set(realIssues.map((issue) => issue.department))].sort()
    const categories = [...new Set(realIssues.map((issue) => issue.category))].sort()
    let filteredIssues = realIssues
    if (department) filteredIssues = filteredIssues.filter((issue) => issue.department === department)
    if (category) filteredIssues = filteredIssues.filter((issue) => issue.category === category)
    const syntheticSeedCount = issues.filter((issue) => issue.isDemo &&
      (!department || issue.department === department) && (!category || issue.category === category)).length
    const data = buildHeatmapData(filteredIssues)

    return NextResponse.json({ ...data, syntheticSeedCount, filters: { departments, categories } }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('Civic heatmap error:', error)
    return NextResponse.json({ error: 'Civic map data is unavailable until the database is ready.' }, { status: 503 })
  }
}
