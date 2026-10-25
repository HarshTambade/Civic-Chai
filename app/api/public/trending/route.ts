import { NextResponse } from 'next/server'
import { MIGRATION_HELP, isSchemaError, publicErrorMessage } from '@/lib/api-errors'
import { getIssues } from '@/lib/issues'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'
import { toPublicIssue } from '@/lib/privacy'

export async function GET(request: Request) {
  try {
    const pin = new URL(request.url).searchParams.get('pin') ?? ''
    if (pin && !/^\d{6}$/.test(pin)) return NextResponse.json({ error: 'PIN must contain six digits.' }, { status: 400 })
    const issues = (await getIssues()).filter((issue) => !pin || issue.pin === pin)
    const recentActivity = new Map<string, { reports: number; supports: number }>()
    const service = getSupabaseServiceClient()
    if (hasSupabaseConfig() && !service) return NextResponse.json({ error: 'Recent activity analytics requires the server-only Supabase key.' }, { status: 503 })
    if (service && issues.length) {
      const since = new Date(Date.now() - 7 * 86400000).toISOString()
      const ids = issues.map((issue) => issue.id)
      const [reports, supports] = await Promise.all([
        service.from('issue_reports').select('issue_id,created_at').in('issue_id', ids).gte('created_at', since),
        service.from('issue_supports').select('issue_id,created_at').in('issue_id', ids).gte('created_at', since),
      ])
      if (reports.error || supports.error) return NextResponse.json({ error: 'Recent activity analytics is not ready.' }, { status: 503 })
      for (const row of reports.data ?? []) recentActivity.set(row.issue_id, { ...(recentActivity.get(row.issue_id) ?? { reports: 0, supports: 0 }), reports: (recentActivity.get(row.issue_id)?.reports ?? 0) + 1 })
      for (const row of supports.data ?? []) recentActivity.set(row.issue_id, { ...(recentActivity.get(row.issue_id) ?? { reports: 0, supports: 0 }), supports: (recentActivity.get(row.issue_id)?.supports ?? 0) + 1 })
    }
    return NextResponse.json({ issues: issues.map((issue) => ({
      ...toPublicIssue(issue),
      recentReports: recentActivity.get(issue.id)?.reports ?? 0,
      recentSupport: recentActivity.get(issue.id)?.supports ?? 0,
    })) })
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error, 'Trending data is unavailable right now.') }, { status: 503 })
  }
}
