import { NextResponse } from 'next/server'
import { createIssue, getIssues } from '@/lib/issues'
import { getRequestContext } from '@/lib/api-auth'
import { getSupabaseServiceClient, hasSupabaseConfig, isLocalDemoModeEnabled } from '@/lib/supabase'
import { recordFallbackAudit } from '@/lib/audit'
import { canManageIssues } from '@/lib/roles'
import { toPublicIssue } from '@/lib/privacy'
import { consumeRateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && !hasSupabaseConfig()) return NextResponse.json({ error: 'Civic issue storage is not configured.' }, { status: 503 })
  const { client, actor } = await getRequestContext(request)
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const department = searchParams.get('department')
  const pin = searchParams.get('pin')
  const priority = searchParams.get('priority')
  const query = (searchParams.get('q') ?? '').toLowerCase()
  const privileged = canManageIssues(actor?.role ?? 'citizen')
  const service = privileged ? getSupabaseServiceClient() : null
  if (privileged && hasSupabaseConfig() && !service) return NextResponse.json({ error: 'Privileged issue reads require the server-only Supabase service key.' }, { status: 503 })
  let issues = await getIssues(service ?? client, privileged)
  if (actor?.role === 'department_operator' || actor?.role === 'department_supervisor') {
    if (!actor.department || !actor.pin) issues = []
    else issues = issues.filter((issue) => issue.department === actor.department && issue.pin === actor.pin)
  } else if (actor?.role === 'authority_admin') {
    if (!actor.pin) issues = []
    else issues = issues.filter((issue) => issue.pin === actor.pin)
  }
  if (status) issues = issues.filter((issue) => issue.status === status)
  if (department) issues = issues.filter((issue) => issue.department === department)
  if (pin) issues = issues.filter((issue) => issue.pin === pin)
  if (priority) issues = issues.filter((issue) => issue.priority === priority)
  if (query) issues = issues.filter((issue) => `${issue.title} ${issue.description} ${issue.locality}`.toLowerCase().includes(query))
  if (!privileged) issues = issues.map(toPublicIssue)
  return NextResponse.json({ issues })
}

export async function POST(request: Request) {
  try {
    const rateLimit = await consumeRateLimit(request, 'issue-create', 8, 600)
    if (rateLimit === null) return NextResponse.json({ error: 'Request protection is temporarily unavailable. Please try again shortly.' }, { status: 503 })
    if (!rateLimit) return NextResponse.json({ error: 'Too many reports from this connection. Please try again later.' }, { status: 429 })
    const body = await request.json()
    const { client, actor } = await getRequestContext(request)
    const title = String(body.title ?? '').trim().slice(0, 140)
    const description = String(body.description ?? body.original_text ?? '').trim().slice(0, 5000)
    const pin = String(body.pin ?? '').trim()
    const locality = String(body.locality ?? '').trim().slice(0, 120)

    if (!title || description.length < 8 || !/^\d{6}$/.test(pin) || !locality) {
      return NextResponse.json({ error: 'Add a short title, clear description, six-digit PIN and locality.' }, { status: 400 })
    }

    const writer = hasSupabaseConfig() ? getSupabaseServiceClient() : null
    if (process.env.NODE_ENV === 'production' && !writer) return NextResponse.json({ error: 'Complaint intake is unavailable until the server-only database configuration is complete.' }, { status: 503 })
    if (hasSupabaseConfig() && !writer) return NextResponse.json({ error: 'Complaint intake is not configured. Set the server-only Supabase service key.' }, { status: 503 })
    const submittedEvidence = Array.isArray(body.image_urls) ? body.image_urls : Array.isArray(body.evidence) ? body.evidence : Array.isArray(body.evidence_urls) ? body.evidence_urls : []
    const validEvidencePath = (value: unknown) => {
      if (typeof value !== 'string') return false
      if (isLocalDemoModeEnabled() && value.length <= 6 * 1024 * 1024 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return true
      if (value.length > 160) return false
      return Boolean(actor?.id && new RegExp(`^${actor.id}/[0-9a-f-]{36}\\.(jpg|png|webp|mp4|webm)$`, 'i').test(value))
    }
    if (!Array.isArray(submittedEvidence) || submittedEvidence.length > 5 || submittedEvidence.some((value: unknown) => !validEvidencePath(value))) {
      return NextResponse.json({ error: 'Evidence must be uploaded to your private account before filing this report.' }, { status: 400 })
    }
    const distinctFrom = typeof body.distinct_from === 'string' ? body.distinct_from : ''
    const relatedIssue = distinctFrom
      ? (await getIssues(writer ?? client, true)).find((row) => row.id === distinctFrom) ?? null
      : null
    if (distinctFrom && (!relatedIssue || relatedIssue.pin !== pin)) return NextResponse.json({ error: 'The selected related report is outside this PIN or no longer available.' }, { status: 400 })
    const issue = await createIssue({
      title,
      description,
      original_text: description,
      normalized_text: String(body.normalized_text ?? description).slice(0, 5000),
      category: String(body.category ?? 'General civic issue').slice(0, 100),
      department: String(body.department ?? 'Municipal Operations').slice(0, 120),
      pin,
      locality,
      source_channel: ['web', 'pwa', 'voice', 'keypad', 'assisted'].includes(body.source_channel) ? body.source_channel : 'web',
      language: String(body.language ?? 'Unknown').slice(0, 40),
      ai_confidence: Number.isFinite(Number(body.ai_confidence)) ? Math.max(0, Math.min(100, Number(body.ai_confidence))) : 50,
      severity: Number.isFinite(Number(body.severity)) ? Math.max(0, Math.min(100, Number(body.severity))) : 40,
      location_lat: body.consent?.device_location === true && Number.isFinite(Number(body.location_lat)) ? Number(body.location_lat) : undefined,
      location_lng: body.consent?.device_location === true && Number.isFinite(Number(body.location_lng)) ? Number(body.location_lng) : undefined,
      created_by: actor?.id,
      consent: body.consent && typeof body.consent === 'object' ? body.consent : {},
      image_urls: submittedEvidence,
    }, writer ?? client)

    if (relatedIssue) {
      if (writer) {
        const [issueA, issueB] = [issue.id, relatedIssue.id].sort()
        const { error } = await writer.from('duplicate_links').upsert({ issue_a: issueA, issue_b: issueB, similarity: 0, model_version: 'civicchai-jaccard-v1', decision: 'distinct', decided_by: actor?.id ?? null, decided_at: new Date().toISOString() }, { onConflict: 'issue_a,issue_b' })
        if (error) console.error('Distinct duplicate decision was not recorded:', error.message)
        await writer.from('audit_logs').insert({ issue_id: issue.id, actor_id: actor?.id ?? null, action: 'duplicate.citizen_declared_distinct', details: { related_issue: relatedIssue.id } })
      } else recordFallbackAudit('duplicate.citizen_declared_distinct', issue.id, actor?.id, { related_issue: relatedIssue.id })
    }

    return NextResponse.json(issue, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create issue'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
