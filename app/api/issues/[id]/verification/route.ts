import { NextResponse } from 'next/server'
import { getRequestContext } from '@/lib/api-auth'
import { getIssueById, hasIssueFollow, hasIssueSupport } from '@/lib/issues'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'
import { recordFallbackAudit } from '@/lib/audit'
import { toPublicIssue } from '@/lib/privacy'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id || actor.role !== 'citizen') return NextResponse.json({ error: 'A signed-in citizen must verify a resolved community issue.' }, { status: 403 })
  const service = getSupabaseServiceClient()
  if (hasSupabaseConfig() && !service) return NextResponse.json({ error: 'Resolution verification needs the configured server-only Supabase key.' }, { status: 503 })
  try {
    const body = await request.json()
    const action = String(body.action ?? '')
    if (!['confirm', 'reopen'].includes(action)) return NextResponse.json({ error: 'Choose confirm or reopen.' }, { status: 400 })
    const { id } = await params
    const issue = await getIssueById(id, service ?? client, Boolean(service))
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    if (!['Resolved', 'Community Verified'].includes(issue.status)) return NextResponse.json({ error: 'Only resolved issues can be verified or disputed.' }, { status: 409 })
    const related = issue.createdBy === actor.id || await hasIssueSupport(issue.id, actor.id, service ?? client) || await hasIssueFollow(issue.id, actor.id, service ?? client)
    if (!related) return NextResponse.json({ error: 'File or follow this issue before confirming its outcome.' }, { status: 403 })
    const nextStatus = action === 'confirm' ? 'Community Verified' : 'In Progress'
    const now = new Date().toISOString()
    if (!service) {
      const oldStatus = issue.status
      Object.assign(issue, { status: nextStatus, updatedAt: now, updated_at: now })
      recordFallbackAudit(action === 'confirm' ? 'issue.community_verified' : 'issue.reopened_by_citizen', issue.id, actor.id, { from: oldStatus, to: nextStatus })
      return NextResponse.json({ issue: toPublicIssue(issue) })
    }
    const { error: updateError } = await service.from('issues').update({ status: nextStatus, community_verified_at: action === 'confirm' ? now : null }).eq('id', issue.id)
    if (updateError) throw updateError
    await service.from('status_events').insert({ issue_id: issue.id, old_status: issue.status, new_status: nextStatus, actor_id: actor.id, note: action === 'confirm' ? 'A participating citizen confirmed the reported resolution.' : 'A participating citizen reported that the issue remains unresolved.' })
    await service.from('audit_logs').insert({ issue_id: issue.id, actor_id: actor.id, action: action === 'confirm' ? 'issue.community_verified' : 'issue.reopened_by_citizen', details: { from: issue.status, to: nextStatus } })
    if (issue.createdBy && issue.createdBy !== actor.id) await service.from('notifications').insert({ user_id: issue.createdBy, issue_id: issue.id, kind: 'community_verification', title: action === 'confirm' ? 'Resolution confirmed' : 'Resolution disputed', body: `${issue.documentId} was marked ${action === 'confirm' ? 'community verified' : 'in progress'} by a participating citizen.` })
    const updated = await getIssueById(issue.id, service, true)
    return NextResponse.json({ issue: updated ? toPublicIssue(updated) : null })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to record the resolution response.' }, { status: 400 })
  }
}
