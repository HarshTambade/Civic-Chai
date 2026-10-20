import { NextResponse } from 'next/server'
import { getFallbackIssueFollowers, getFallbackIssueSupporters, getIssueById, updateIssue } from '@/lib/issues'
import { authorizeRoles } from '@/lib/api-auth'
import { getSupabaseServiceClient } from '@/lib/supabase'
import { addFallbackNotification } from '@/lib/notifications'

const MANAGERS = ['department_operator', 'department_supervisor', 'authority_admin'] as const
const VALID_STATUSES = ['Filed', 'AI Classified', 'Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Community Verified', 'Closed', 'Duplicate', 'Under Review']

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRoles(request, [...MANAGERS])
  if (auth.response) return auth.response
  try {
    const body = await request.json()
    const status = body.status == null ? undefined : String(body.status)
    if (status && !VALID_STATUSES.includes(status)) return NextResponse.json({ error: 'Unsupported issue status.' }, { status: 400 })
    const { id } = await params
    const before = status ? await getIssueById(id, auth.client) : null
    if (before && (auth.actor?.role === 'department_operator' || auth.actor?.role === 'department_supervisor') && (!auth.actor.department || !auth.actor.pin || before.department !== auth.actor.department || before.pin !== auth.actor.pin)) return NextResponse.json({ error: 'Issue is outside your assigned department and PIN scope.' }, { status: 404 })
    if (before && auth.actor?.role === 'authority_admin' && (!auth.actor.pin || before.pin !== auth.actor.pin)) return NextResponse.json({ error: 'Issue is outside your authorized jurisdiction.' }, { status: 404 })
    const issue = await updateIssue(id, {
      status: status as any,
      department: typeof body.department === 'string' ? body.department.slice(0, 120) : undefined,
      officer: typeof body.officer === 'string' ? body.officer.slice(0, 120) : undefined,
      note: typeof body.note === 'string' ? body.note.slice(0, 2000) : undefined,
      resolutionEvidence: typeof body.resolutionEvidence === 'string' ? body.resolutionEvidence.slice(0, 500) : undefined,
    }, auth.actor?.id, auth.client)
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    if (status && before?.status !== issue.status) {
      const title = `CivicChai update · ${issue.documentId}`
      const bodyText = `The issue status changed to ${issue.status}. Open the report to view the official timeline.`
      const service = getSupabaseServiceClient()
      if (service) {
        const [{ data: storedIssue }, { data: follows }, { data: supports }] = await Promise.all([
          service.from('issues').select('created_by').eq('id', issue.id).maybeSingle(),
          service.from('issue_follows').select('user_id').eq('issue_id', issue.id),
          service.from('issue_supports').select('user_id').eq('issue_id', issue.id),
        ])
        const recipients = [...new Set([storedIssue?.created_by, ...(follows ?? []).map((row) => row.user_id), ...(supports ?? []).map((row) => row.user_id)].filter((value): value is string => typeof value === 'string'))]
        if (recipients.length) {
          const { data: profiles } = await service.from('profiles').select('id,notification_preferences').in('id', recipients)
          const enabled = (profiles ?? []).filter((profile) => profile.notification_preferences?.in_app !== false).map((profile) => profile.id)
          if (enabled.length) await service.from('notifications').insert(enabled.map((user_id) => ({ user_id, issue_id: issue.id, kind: 'issue_status', title, body: bodyText })))
        }
      } else {
        const recipients = new Set([issue.createdBy, ...getFallbackIssueFollowers(issue.id), ...getFallbackIssueSupporters(issue.id)].filter((value): value is string => Boolean(value)))
        for (const userId of recipients) addFallbackNotification({ user_id: userId, issue_id: issue.id, kind: 'issue_status', title, body: bodyText })
      }
    }
    return NextResponse.json({ issue })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update issue.' }, { status: 400 })
  }
}
