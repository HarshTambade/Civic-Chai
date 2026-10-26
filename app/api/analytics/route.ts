import { NextResponse } from 'next/server'
import { authorizeRoles } from '@/lib/api-auth'
import { getIssues } from '@/lib/issues'
import { getFallbackAudit } from '@/lib/audit'
import { buildAnalytics, type StatusEvent, type SupportEvent } from '@/lib/analytics'
import { publicErrorMessage } from '@/lib/api-errors'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'

const CHUNK = 200

export async function GET(request: Request) {
  const auth = await authorizeRoles(request, ['department_supervisor', 'authority_admin', 'auditor'])
  if (auth.response) return auth.response
  const service = getSupabaseServiceClient()
  if (hasSupabaseConfig() && !service) return NextResponse.json({ error: 'Analytics require the server-only Supabase key.' }, { status: 503 })
  const actor = auth.actor!
  try {
    let issues = await getIssues(service ?? undefined, Boolean(service))
    // Same scope as the complaint queue: department + PIN for supervisors, PIN for the others.
    issues = actor.role === 'department_supervisor'
      ? issues.filter((issue) => Boolean(actor.pin && actor.department) && issue.pin === actor.pin && issue.department === actor.department)
      : issues.filter((issue) => Boolean(actor.pin) && issue.pin === actor.pin)
    const ids = issues.map((issue) => issue.id)

    let events: StatusEvent[] = []
    let supports: SupportEvent[] = []
    if (service) {
      for (let index = 0; index < ids.length; index += CHUNK) {
        const slice = ids.slice(index, index + CHUNK)
        const [statusRows, supportRows] = await Promise.all([
          service.from('status_events').select('issue_id,new_status,created_at').in('issue_id', slice),
          service.from('issue_supports').select('issue_id,created_at').in('issue_id', slice).gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),
        ])
        if (statusRows.error) throw statusRows.error
        events = events.concat(statusRows.data ?? [])
        supports = supports.concat(supportRows.data ?? [])
      }
    } else {
      const scoped = new Set(ids)
      events = getFallbackAudit().filter((event) => event.issue_id && scoped.has(event.issue_id)).flatMap((event) => {
        const status = event.action === 'issue.created' ? 'Filed'
          : event.action === 'issue.community_verified' ? 'Community Verified'
            : typeof event.details.status === 'string' ? event.details.status
              : typeof event.details.to === 'string' ? event.details.to : ''
        return status ? [{ issue_id: event.issue_id!, new_status: status, created_at: event.created_at }] : []
      })
    }
    return NextResponse.json(buildAnalytics(issues, events, supports), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error, 'Analytics are unavailable right now.') }, { status: 503 })
  }
}
