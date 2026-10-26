import { NextResponse } from 'next/server'
import { canSeeIssue } from '@/lib/scope'
import { getFallbackIssueFollowers, getFallbackIssueSupporters, getIssueById, updateIssue } from '@/lib/issues'
import { authorizeRoles } from '@/lib/api-auth'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'
import { addFallbackNotification } from '@/lib/notifications'
import { DEPARTMENT_OPTIONS } from '@/lib/ai'

const MANAGERS = ['department_operator', 'department_supervisor', 'authority_admin'] as const
const VALID_STATUSES = ['Filed', 'AI Classified', 'Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Community Verified', 'Closed', 'Duplicate', 'Under Review']
const OPERATIONAL_STATUSES = ['Acknowledged', 'In Progress', 'Resolved', 'Under Review']
const SUPERVISOR_STATUSES = ['Assigned', ...OPERATIONAL_STATUSES, 'Closed']
const AUTHORITY_STATUSES = ['Assigned', ...OPERATIONAL_STATUSES, 'Closed']

function isOfficialEvidenceUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && (url.hostname === 'gov.in' || url.hostname.endsWith('.gov.in') || url.hostname === 'nic.in' || url.hostname.endsWith('.nic.in'))
  } catch {
    return false
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRoles(request, [...MANAGERS])
  if (auth.response) return auth.response
  const service = getSupabaseServiceClient()
  if (hasSupabaseConfig() && !service) return NextResponse.json({ error: 'Issue actions require the server-only Supabase key to record the audit trail.' }, { status: 503 })
  try {
    const body = await request.json()
    const status = body.status == null ? undefined : String(body.status)
    if (status && !VALID_STATUSES.includes(status)) return NextResponse.json({ error: 'Unsupported issue status.' }, { status: 400 })
    const { id } = await params
    const before = await getIssueById(id, service ?? auth.client)
    if (!before) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    const role = auth.actor?.role
    const allowedStatuses = role === 'department_operator' ? OPERATIONAL_STATUSES : role === 'department_supervisor' ? SUPERVISOR_STATUSES : AUTHORITY_STATUSES
    if (status && status !== before.status && !allowedStatuses.includes(status)) return NextResponse.json({ error: 'This role cannot set that issue status. Duplicate and community verification decisions use their dedicated review flows.' }, { status: 403 })
    if (status === 'Closed' && status !== before.status && !['Resolved', 'Community Verified'].includes(before.status)) return NextResponse.json({ error: 'An issue must be resolved before it can be closed.' }, { status: 409 })
    if (!canSeeIssue(auth.actor, before)) return NextResponse.json({ error: 'Issue is outside your assigned area and department.' }, { status: 404 })
    const department = typeof body.department === 'string' && body.department.trim() ? body.department.trim().slice(0, 120) : undefined
    let officer = typeof body.officer === 'string' && body.officer.trim() ? body.officer.trim().slice(0, 120) : undefined
    if (role === 'department_operator' && (department !== undefined || officer !== undefined)) return NextResponse.json({ error: 'Department operators can update issue progress but cannot assign departments or officers.' }, { status: 403 })
    if (role === 'department_supervisor' && department !== undefined) return NextResponse.json({ error: 'Department supervisors can assign within their existing department only.' }, { status: 403 })
    if (!service && department && department !== before.department && !DEPARTMENT_OPTIONS.includes(department)) return NextResponse.json({ error: 'Route this issue to a configured department.' }, { status: 400 })
    if (service && department && department !== before.department) {
      const { data: approvedDepartment, error: departmentError } = await service.from('departments').select('id').eq('name', department).limit(1).maybeSingle()
      if (departmentError) return NextResponse.json({ error: 'The department registry is unavailable. Apply the CivicChai database migrations first.' }, { status: 503 })
      if (!approvedDepartment) return NextResponse.json({ error: 'Route this issue to a department in the configured department registry.' }, { status: 400 })
      if (!officer) officer = 'Assignment pending'
    }
    if (service && officer && officer !== before.officer && officer !== 'Assignment pending') {
      const targetDepartment = department ?? before.department
      const { data: approvedOfficer, error: officerError } = await service.from('officer_registry').select('id').eq('name', officer).eq('department', targetDepartment).eq('pin', before.pin).eq('is_verified', true).limit(1).maybeSingle()
      if (officerError) return NextResponse.json({ error: 'The verified officer registry is unavailable. Apply the CivicChai database migrations first.' }, { status: 503 })
      if (!approvedOfficer) return NextResponse.json({ error: 'Assign only an officer listed as verified for this department and PIN.' }, { status: 400 })
    }
    const resolutionEvidence = typeof body.resolutionEvidence === 'string' ? body.resolutionEvidence.trim() : ''
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 2000) : undefined
    // A resolution must tell citizens what was done: a public note, or an official record link.
    if (status === 'Resolved' && before.status !== 'Resolved' && !resolutionEvidence && (note?.length ?? 0) < 15) return NextResponse.json({ error: 'Describe the action taken in the official update (at least 15 characters) or add an official .gov.in/.nic.in record before marking this issue resolved.' }, { status: 400 })
    if (resolutionEvidence && !isOfficialEvidenceUrl(resolutionEvidence)) return NextResponse.json({ error: 'Resolution evidence links must use an official HTTPS .gov.in or .nic.in source.' }, { status: 400 })
    // Local preview returns the stored object itself, so keep the prior status before it is mutated.
    const previousStatus = before.status
    const issue = await updateIssue(id, {
      status: status as any,
      department,
      officer,
      note,
      resolutionEvidence: resolutionEvidence || undefined,
    }, auth.actor?.id, service ?? auth.client)
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    if (status && previousStatus !== issue.status) {
      const title = `CivicChai update · ${issue.documentId}`
      const bodyText = `The issue status changed to ${issue.status}. Open the report to view the official timeline.`
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
