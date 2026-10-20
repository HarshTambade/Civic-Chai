import { NextResponse } from 'next/server'
import { authorizeRoles } from '@/lib/api-auth'
import { findDuplicateCandidates } from '@/lib/scoring'
import { getIssueById, getIssues } from '@/lib/issues'
import { getFallbackDuplicateLinks } from '@/lib/duplicates'
import { recordFallbackAudit } from '@/lib/audit'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'

const REVIEW_ROLES = ['moderator', 'department_supervisor', 'authority_admin'] as const

function isInScope(actor: { role?: string; pin?: string; department?: string } | null, issue: { pin: string; department: string }) {
  if (!actor) return false
  if (actor.role === 'moderator') return true
  if (actor.role === 'authority_admin') return Boolean(actor.pin && actor.pin === issue.pin)
  if (actor.role === 'department_supervisor') return Boolean(actor.department && actor.department === issue.department && actor.pin === issue.pin)
  return false
}

async function loadReviewData(request: Request, id: string) {
  const auth = await authorizeRoles(request, [...REVIEW_ROLES])
  if (auth.response) return { auth, response: auth.response }
  const service = getSupabaseServiceClient()
  if (hasSupabaseConfig() && !service) return { auth, response: NextResponse.json({ error: 'Duplicate review requires the server-only Supabase key.' }, { status: 503 }) }
  const issue = await getIssueById(id, service ?? auth.client, Boolean(service))
  if (!issue) return { auth, response: NextResponse.json({ error: 'Issue not found.' }, { status: 404 }) }
  if (!isInScope(auth.actor, issue)) return { auth, response: NextResponse.json({ error: 'Issue is outside your authorized scope.' }, { status: 404 }) }
  return { auth, issue, service, response: null }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const loaded = await loadReviewData(request, id)
    if (loaded.response) return loaded.response
    const { issue, auth, service } = loaded
    if (!issue || !auth) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    const issues = await getIssues(service ?? auth.client, Boolean(service))
    const candidates = findDuplicateCandidates({ text: `${issue.title} ${issue.description}`, pin: issue.pin, locality: issue.locality, department: issue.department, category: issue.category }, issues.filter((candidate) => candidate.id !== issue.id && isInScope(auth.actor, candidate)))
    if (!service) return NextResponse.json({ candidates, links: getFallbackDuplicateLinks().filter((link) => link.issue_a === issue.id || link.issue_b === issue.id) })
    const { data: links, error } = await service.from('duplicate_links').select('id,issue_a,issue_b,similarity,decision,previous_status,decided_at').or(`issue_a.eq.${issue.id},issue_b.eq.${issue.id}`).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: 'Unable to load duplicate decisions.' }, { status: 500 })
    return NextResponse.json({ candidates, links: links ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to review duplicate candidates.' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const loaded = await loadReviewData(request, id)
    if (loaded.response) return loaded.response
    const { issue, auth, service } = loaded
    if (!issue || !auth) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    const body = await request.json()
    const action = String(body.action ?? '')
    if (!['distinct', 'merged', 'unmerged'].includes(action)) return NextResponse.json({ error: 'Choose distinct, merged or unmerged.' }, { status: 400 })
    const targetId = action === 'unmerged' ? issue.duplicateOf : String(body.target_id ?? '')
    if (!targetId || targetId === issue.id) return NextResponse.json({ error: 'Choose another issue to link.' }, { status: 400 })
    const target = await getIssueById(targetId, service ?? auth.client, Boolean(service))
    if (!target || !isInScope(auth.actor, target)) return NextResponse.json({ error: 'Related issue is outside your authorized scope.' }, { status: 404 })
    if (target.pin !== issue.pin) return NextResponse.json({ error: 'Duplicate review is restricted to the same PIN. Similar wording in another area stays separate.' }, { status: 400 })
    const [issueA, issueB] = [issue.id, target.id].sort()
    const now = new Date().toISOString()
    if (!service) {
      const links = getFallbackDuplicateLinks()
      let link = links.find((item) => item.issue_a === issueA && item.issue_b === issueB)
      if (!link) { link = { issue_a: issueA, issue_b: issueB, similarity: Number(body.similarity ?? 0), decision: 'suggested', previous_status: issue.status, decided_at: now }; links.unshift(link) }
      const oldStatus = issue.status
      if (action === 'merged') Object.assign(issue, { duplicateOf: target.id, duplicateDecision: 'merged', status: 'Duplicate', updatedAt: now })
      if (action === 'unmerged') Object.assign(issue, { duplicateOf: undefined, duplicateDecision: 'unmerged', status: link.previous_status ?? 'Filed', updatedAt: now })
      link.decision = action as typeof link.decision
      link.decided_by = auth.actor?.id
      link.decided_at = now
      recordFallbackAudit(`duplicate.${action}`, issue.id, auth.actor?.id, { related_issue: target.id, old_status: oldStatus, new_status: issue.status })
      return NextResponse.json({ issue, decision: action })
    }

    const { data: existing } = await service.from('duplicate_links').select('id,previous_status').eq('issue_a', issueA).eq('issue_b', issueB).maybeSingle()
    const previousStatus = existing?.previous_status ?? issue.status
    const patch = { similarity: Number.isFinite(Number(body.similarity)) ? Math.max(0, Math.min(1, Number(body.similarity))) : 0, decision: action, decided_by: auth.actor?.id, decided_at: now, previous_status: previousStatus }
    const { error: linkError } = await service.from('duplicate_links').upsert({ issue_a: issueA, issue_b: issueB, ...patch }, { onConflict: 'issue_a,issue_b' })
    if (linkError) throw linkError
    const oldStatus = issue.status
    const nextStatus = action === 'merged' ? 'Duplicate' : action === 'unmerged' ? (previousStatus as typeof issue.status) : issue.status
    if (action === 'merged' || action === 'unmerged') {
      const update = action === 'merged' ? { duplicate_of: target.id, duplicate_decision: 'merged', status: 'Duplicate' } : { duplicate_of: null, duplicate_decision: 'unmerged', status: nextStatus }
      const { error } = await service.from('issues').update(update).eq('id', issue.id)
      if (error) throw error
      if (oldStatus !== nextStatus) await service.from('status_events').insert({ issue_id: issue.id, old_status: oldStatus, new_status: nextStatus, actor_id: auth.actor?.id, note: `Duplicate ${action} review.`, evidence_url: null })
    }
    await service.from('audit_logs').insert({ issue_id: issue.id, actor_id: auth.actor?.id, action: `duplicate.${action}`, details: { related_issue: target.id, old_status: oldStatus, new_status: nextStatus, model_version: 'civicchai-jaccard-v1' } })
    const updated = await getIssueById(issue.id, service, true)
    return NextResponse.json({ issue: updated, decision: action })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save duplicate decision.' }, { status: 400 })
  }
}
