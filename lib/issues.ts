import { getSupabaseClient } from '@/lib/supabase'
import { calculateChaiHeat, calculatePriorityScore, calculateTrustScore } from '@/lib/scoring'
import { recordFallbackAudit } from '@/lib/audit'
import { redactPublicText, safeComment } from '@/lib/privacy'
import type { CreateIssueInput, IssueRecord, IssueStatus } from '@/lib/types'

const ISSUE_FALLBACK_STORE_KEY = '__civicchai_issue_store__'
const COMMENT_FALLBACK_STORE_KEY = '__civicchai_comment_store__'
const SUPPORT_FALLBACK_STORE_KEY = '__civicchai_support_store__'
const FOLLOW_FALLBACK_STORE_KEY = '__civicchai_follow_store__'
const CORROBORATION_FALLBACK_STORE_KEY = '__civicchai_corroboration_store__'
export type IssueComment = { id: string; issue_id: string; author_id?: string; display_name: string; body: string; created_at: string }

function getFallbackIssueStore(): IssueRecord[] {
  const globalScope = globalThis as typeof globalThis & { [ISSUE_FALLBACK_STORE_KEY]?: IssueRecord[] }
  if (!globalScope[ISSUE_FALLBACK_STORE_KEY]) globalScope[ISSUE_FALLBACK_STORE_KEY] = []
  return globalScope[ISSUE_FALLBACK_STORE_KEY]!
}

function getFallbackCommentStore(): IssueComment[] {
  const globalScope = globalThis as typeof globalThis & { [COMMENT_FALLBACK_STORE_KEY]?: IssueComment[] }
  if (!globalScope[COMMENT_FALLBACK_STORE_KEY]) globalScope[COMMENT_FALLBACK_STORE_KEY] = []
  return globalScope[COMMENT_FALLBACK_STORE_KEY]!
}

function getFallbackSupportStore() {
  const globalScope = globalThis as typeof globalThis & { [SUPPORT_FALLBACK_STORE_KEY]?: Set<string> }
  if (!globalScope[SUPPORT_FALLBACK_STORE_KEY]) globalScope[SUPPORT_FALLBACK_STORE_KEY] = new Set()
  return globalScope[SUPPORT_FALLBACK_STORE_KEY]!
}

function getFallbackFollowStore() {
  const globalScope = globalThis as typeof globalThis & { [FOLLOW_FALLBACK_STORE_KEY]?: Set<string> }
  if (!globalScope[FOLLOW_FALLBACK_STORE_KEY]) globalScope[FOLLOW_FALLBACK_STORE_KEY] = new Set()
  return globalScope[FOLLOW_FALLBACK_STORE_KEY]!
}

function getFallbackCorroborationStore() {
  const globalScope = globalThis as typeof globalThis & { [CORROBORATION_FALLBACK_STORE_KEY]?: Set<string> }
  if (!globalScope[CORROBORATION_FALLBACK_STORE_KEY]) globalScope[CORROBORATION_FALLBACK_STORE_KEY] = new Set()
  return globalScope[CORROBORATION_FALLBACK_STORE_KEY]!
}

export function getFallbackIssueFollowers(issueId: string) {
  const suffix = `:${issueId}`
  return [...getFallbackFollowStore()].filter((key) => key.endsWith(suffix)).map((key) => key.slice(0, -suffix.length))
}

export function getFallbackIssueSupporters(issueId: string) {
  const suffix = `:${issueId}`
  return [...getFallbackSupportStore()].filter((key) => key.endsWith(suffix)).map((key) => key.slice(0, -suffix.length))
}

export function normalizeIssue(row: Record<string, any>): IssueRecord {
  const chaiHeat = Number(row.chai_heat ?? row.chaiHeat ?? 0)
  const daysUnresolved = Number(row.days_unresolved ?? row.daysUnresolved ?? 0)
  return {
    id: String(row.id),
    document_id: row.document_id,
    documentId: String(row.document_id ?? row.documentId ?? `CC-${String(row.id).slice(0, 6)}`),
    title: String(row.title ?? 'Untitled issue'),
    description: String(row.description ?? row.original_text ?? 'No description provided.'),
    originalText: row.original_text,
    normalizedText: String(row.normalized_text ?? row.normalizedText ?? ''),
    category: String(row.category ?? 'General'),
    department: String(row.department ?? 'Municipal operations'),
    pin: String(row.pin ?? '000000'),
    locality: String(row.locality ?? 'Locality not provided'),
    state: typeof row.state === 'string' ? row.state : undefined,
    district: typeof row.district === 'string' ? row.district : undefined,
    municipality: typeof row.municipality === 'string' ? row.municipality : undefined,
    ward: typeof row.ward === 'string' ? row.ward : undefined,
    status: (row.status ?? 'Filed') as IssueStatus,
    priority: row.priority ?? 'Moderate',
    priorityScore: Number(row.priority_score ?? row.priorityScore ?? 0),
    priorityFactors: row.priority_factors ?? row.priorityFactors ?? {},
    trustFactors: row.trust_factors ?? row.trustFactors ?? {},
    aiConfidence: Number(row.ai_confidence ?? row.aiConfidence ?? 0),
    language: row.language ?? 'Unknown',
    sourceChannel: row.source_channel ?? 'web',
    modelVersion: row.model_version ?? 'civicchai-rules-v1',
    trust: Number(row.trust ?? row.trust_score ?? 0),
    chaiHeat,
    supporters: Number(row.supporters ?? 0),
    reports: Number(row.reports ?? 0),
    comments: Number(row.comments ?? 0),
    daysUnresolved,
    officer: String(row.officer ?? 'Unassigned'),
    hub: String(row.hub ?? 'Local authority hub not verified'),
    image: row.image_url ?? row.image,
    image_url: row.image_url ?? row.image,
    evidenceUrls: Array.isArray(row.evidence_urls) ? row.evidence_urls : [],
    latitude: row.location_lat == null ? undefined : Number(row.location_lat),
    longitude: row.location_lng == null ? undefined : Number(row.location_lng),
    created_at: row.created_at,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    updated_at: row.updated_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? row.createdBy,
    slaDueAt: row.sla_due_at ?? row.slaDueAt,
    myRelationship: row.my_relationship ?? row.myRelationship,
    isDemo: Boolean(row.is_demo ?? row.isDemo),
    duplicateOf: row.duplicate_of ?? row.duplicateOf ?? undefined,
    duplicateDecision: row.duplicate_decision ?? row.duplicateDecision ?? undefined,
    hasEvidence: Boolean(row.has_evidence ?? row.evidence_urls?.length ?? row.image_url),
  }
}

const PUBLIC_COLUMNS = 'id,document_id,title,description,normalized_text,category,department,pin,locality,state,district,municipality,ward,status,priority,priority_score,priority_factors,trust_factors,ai_confidence,language,source_channel,model_version,trust,chai_heat,supporters,reports,comments,days_unresolved,officer,hub,sla_due_at,is_demo,duplicate_of,duplicate_decision,has_evidence,created_at,updated_at'

export async function getIssues(client = getSupabaseClient(), includeRestricted = false): Promise<IssueRecord[]> {
  if (!client) {
    return [...getFallbackIssueStore()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
  const rows: IssueRecord[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('issues').select(includeRestricted ? '*' : PUBLIC_COLUMNS).order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []).map(normalizeIssue))
    if (!data || data.length < pageSize) break
  }
  return rows
}

export async function getIssueById(id: string, client = getSupabaseClient(), includeRestricted = false): Promise<IssueRecord | null> {
  if (!client) return getFallbackIssueStore().find((issue) => issue.id === id || issue.documentId === id) ?? null
  const byDocument = id.startsWith('CC-')
    ? await client.from('issues').select(includeRestricted ? '*' : PUBLIC_COLUMNS).eq('document_id', id).maybeSingle()
    : await client.from('issues').select(includeRestricted ? '*' : PUBLIC_COLUMNS).eq('id', id).maybeSingle()
  const { data, error } = byDocument
  if (error) throw error
  if (!data) return null
  return normalizeIssue(data)
}

export async function createIssue(input: CreateIssueInput, client = getSupabaseClient()): Promise<IssueRecord> {
  const evidenceUrls = input.image_urls ?? input.evidence ?? (input.image_url ? [input.image_url] : [])
  const priorityResult = calculatePriorityScore({ severity: input.severity, reports: 1, hasEvidence: evidenceUrls.length > 0 })
  const trustResult = calculateTrustScore({
    hasEvidence: evidenceUrls.length > 0,
    locationProvided: Boolean(input.pin && input.locality),
    textLength: (input.original_text ?? input.description).length,
  })
  const createdAt = new Date().toISOString()
  let slaDueAt: string | null = null
  let jurisdictionId: string | null = null
  let verifiedArea: { state?: string | null; district?: string | null; municipality?: string | null; ward?: string | null } = {}
  if (client && input.pin) {
    const { data: jurisdiction } = await client.from('jurisdictions').select('id').eq('pin', input.pin).limit(1).maybeSingle()
    if (jurisdiction) {
      jurisdictionId = jurisdiction.id
      const [departmentResult, categoryResult, targetResult] = await Promise.all([
        client.from('departments').select('id').eq('name', input.department).limit(1).maybeSingle(),
        client.from('categories').select('id').eq('name', input.category).limit(1).maybeSingle(),
        client.from('sla_targets').select('target_hours,effective_at,expires_at,created_at,department_id,category_id').eq('jurisdiction_id', jurisdiction.id).eq('is_verified', true).order('created_at', { ascending: false }).limit(100),
      ])
      const departmentId = departmentResult.data?.id
      const categoryId = categoryResult.data?.id
      const now = Date.now()
      const target = (targetResult.data ?? [])
        .filter((row) => (!row.department_id || row.department_id === departmentId) && (!row.category_id || row.category_id === categoryId))
        .filter((row) => (!row.effective_at || new Date(row.effective_at).getTime() <= now) && (!row.expires_at || new Date(row.expires_at).getTime() > now))
        .sort((a, b) => Number(Boolean(b.category_id)) + Number(Boolean(b.department_id)) - Number(Boolean(a.category_id)) - Number(Boolean(a.department_id)))[0]
      if (target) slaDueAt = new Date(Date.now() + Number(target.target_hours) * 60 * 60 * 1000).toISOString()
    }
    const { data: hubs } = await client.from('authority_hubs').select('state,district,municipality,ward,name,address').eq('pin', input.pin).eq('is_verified', true).limit(100)
    if (hubs?.length) {
      const locality = input.locality.trim().toLocaleLowerCase()
      const matchesLocality = (hub: Record<string, any>) => [hub.name, hub.address, hub.ward].some((value) => typeof value === 'string' && Boolean(value.trim()) && (value.trim().toLocaleLowerCase() === locality || locality.includes(value.trim().toLocaleLowerCase()) || value.trim().toLocaleLowerCase().includes(locality)))
      const matchingHubs = hubs.filter(matchesLocality)
      const candidates = matchingHubs.length ? matchingHubs : hubs.length === 1 ? hubs : []
      const areaSignatures = new Set(candidates.map((hub) => JSON.stringify([hub.state ?? null, hub.district ?? null, hub.municipality ?? null, hub.ward ?? null])))
      if (areaSignatures.size === 1 && candidates.length) verifiedArea = candidates[0]
    }
  }
  const documentId = `CC-${input.pin || '000000'}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const payload = {
    document_id: documentId,
    title: input.title.trim(),
    original_text: (input.original_text ?? input.description).trim(),
    normalized_text: (input.normalized_text ?? input.description).trim(),
    description: redactPublicText((input.original_text ?? input.description).trim()),
    category: input.category,
    department: input.department,
    pin: input.pin,
    locality: input.locality,
    state: verifiedArea.state ?? null,
    district: verifiedArea.district ?? null,
    municipality: verifiedArea.municipality ?? null,
    ward: verifiedArea.ward ?? null,
    status: input.status ?? 'Filed',
    priority: priorityResult.priority,
    priority_score: priorityResult.score,
    priority_factors: priorityResult.factors,
    trust_factors: trustResult.factors,
    ai_confidence: input.ai_confidence ?? 50,
    language: input.language ?? 'Unknown',
    source_channel: input.source_channel ?? 'web',
    model_version: 'civicchai-rules-v1',
    trust: trustResult.score,
    chai_heat: calculateChaiHeat(0, 1),
    supporters: 0,
    reports: 1,
    comments: 0,
    days_unresolved: 0,
    officer: input.officer ?? 'Assignment pending',
    hub: input.hub ?? 'Local authority hub not verified',
    is_demo: false,
    jurisdiction_id: jurisdictionId,
    sla_due_at: slaDueAt,
    image_url: evidenceUrls[0] ?? null,
    evidence_urls: evidenceUrls,
    has_evidence: evidenceUrls.length > 0,
    location_lat: input.location_lat ?? null,
    location_lng: input.location_lng ?? null,
    created_by: input.created_by ?? null,
  }

  if (!client) {
    const issue = normalizeIssue({ ...payload, id: `local-${crypto.randomUUID()}`, created_at: createdAt })
    getFallbackIssueStore().unshift(issue)
    recordFallbackAudit('issue.created', issue.id, input.created_by, { document_id: issue.documentId, status: issue.status, model_version: payload.model_version })
    return issue
  }

  const { data, error } = await client.from('issues').insert(payload).select('*').single()
  if (error) throw error
  const issue = normalizeIssue(data)
  await client.from('status_events').insert({ issue_id: issue.id, old_status: null, new_status: issue.status, actor_id: input.created_by ?? null, note: `Report filed through ${payload.source_channel} intake.` })
  await client.from('audit_logs').insert({ issue_id: issue.id, actor_id: input.created_by ?? null, action: 'issue.created', details: { document_id: issue.documentId, source_channel: payload.source_channel, model_version: payload.model_version } })
  const { error: reportError } = await client.from('issue_reports').insert({
    issue_id: issue.id,
    reporter_id: input.created_by ?? null,
    source_channel: payload.source_channel,
    original_text: payload.original_text,
    language: payload.language,
    location_lat: payload.location_lat,
    location_lng: payload.location_lng,
    priority_severity: input.severity ?? 40,
    trust_score: trustResult.score,
    trust_factors: trustResult.factors,
    model_version: payload.model_version,
    consent: input.consent ?? {},
  })
  if (reportError) console.error('Issue report record was not saved:', reportError.message)
  const privateEvidence = evidenceUrls.filter((path) => !path.startsWith('data:'))
  if (privateEvidence.length) {
    const { error: evidenceError } = await client.from('issue_evidence').insert(privateEvidence.map((storagePath) => ({
      issue_id: issue.id,
      uploaded_by: input.created_by ?? null,
      storage_path: storagePath,
      media_type: storagePath.endsWith('.png') ? 'image/png' : storagePath.endsWith('.webp') ? 'image/webp' : storagePath.endsWith('.mp4') ? 'video/mp4' : storagePath.endsWith('.webm') ? 'video/webm' : 'image/jpeg',
      visibility: 'private',
    })))
    if (evidenceError) console.error('Evidence metadata was not saved:', evidenceError.message)
  }
  return issue
}

export async function updateIssue(
  id: string,
  input: { status?: IssueStatus; department?: string; officer?: string; note?: string; resolutionEvidence?: string },
  actorId?: string,
  client = getSupabaseClient(),
): Promise<IssueRecord | null> {
  const current = await getIssueById(id, client)
  if (!current) return null
  if (!client) {
    const before = { status: current.status, department: current.department, officer: current.officer }
    if (input.status) current.status = input.status
    if (input.department) current.department = input.department
    if (input.officer) current.officer = input.officer
    const updatedAt = new Date().toISOString()
    current.updatedAt = updatedAt
    current.updated_at = updatedAt
    recordFallbackAudit(input.status && input.status !== before.status ? 'issue.status_changed' : 'issue.assignment_changed', current.id, actorId, { before, status: current.status, department: current.department, officer: current.officer, note: input.note, resolution_evidence_url: input.resolutionEvidence })
    return current
  }
  const { error } = await client.rpc('apply_issue_action', {
    p_issue_id: current.id,
    p_actor_id: actorId ?? null,
    p_status: input.status ?? null,
    p_department: input.department ?? null,
    p_officer: input.officer ?? null,
    p_note: input.note ?? null,
    p_resolution_evidence: input.resolutionEvidence ?? null,
  })
  if (error) throw error
  return await getIssueById(current.id, client, true)
}

export async function addIssueSupport(id: string, userId?: string, client = getSupabaseClient()) {
  const issue = await getIssueById(id, client)
  if (!issue) return null
  if (!client) {
    const key = `${userId ?? 'anonymous'}:${issue.id}`
    if (!getFallbackSupportStore().has(key)) {
      getFallbackSupportStore().add(key)
      issue.supporters += 1
      issue.chaiHeat = calculateChaiHeat(issue.supporters, issue.reports)
      recordFallbackAudit('issue.supported', issue.id, userId)
    }
    return issue
  }
  if (!userId) throw new Error('Sign in to support this issue.')
  const { error } = await client.from('issue_supports').upsert({ issue_id: issue.id, user_id: userId }, { onConflict: 'issue_id,user_id', ignoreDuplicates: true })
  if (error) throw error
  return getIssueById(issue.id, client)
}

/**
 * Records a citizen's own report against an existing issue when they join it from
 * the duplicate suggestion. It counts once per account as an independent report.
 * Connected mode must pass the service client: issue reports are server-written.
 */
export async function addCorroboratingReport(
  id: string,
  userId: string,
  report: { text: string; language?: string; sourceChannel?: IssueRecord['sourceChannel']; hasEvidence?: boolean; consent?: Record<string, boolean> },
  client = getSupabaseClient(),
) {
  const issue = await getIssueById(id, client, Boolean(client))
  if (!issue) return null
  const text = report.text.trim().slice(0, 5000)
  if (text.length < 8) return issue
  const trust = calculateTrustScore({ hasEvidence: report.hasEvidence, locationProvided: true, corroborationCount: issue.reports, textLength: text.length })
  if (!client) {
    const key = `${userId}:${issue.id}`
    if (issue.createdBy === userId || getFallbackCorroborationStore().has(key)) return issue
    getFallbackCorroborationStore().add(key)
    issue.reports += 1
    issue.chaiHeat = calculateChaiHeat(issue.supporters, issue.reports)
    recordFallbackAudit('issue.report_joined', issue.id, userId, { source_channel: report.sourceChannel ?? 'web' })
    return issue
  }
  const { data: existing } = await client.from('issue_reports').select('id').eq('issue_id', issue.id).eq('reporter_id', userId).limit(1).maybeSingle()
  if (existing || issue.createdBy === userId) return issue
  const { error } = await client.from('issue_reports').insert({
    issue_id: issue.id,
    reporter_id: userId,
    source_channel: report.sourceChannel ?? 'web',
    original_text: text,
    language: report.language?.slice(0, 40) ?? 'Unknown',
    trust_score: trust.score,
    trust_factors: trust.factors,
    model_version: 'civicchai-rules-v1',
    consent: report.consent ?? {},
  })
  if (error) throw error
  await client.from('audit_logs').insert({ issue_id: issue.id, actor_id: userId, action: 'issue.report_joined', details: { source_channel: report.sourceChannel ?? 'web' } })
  return getIssueById(issue.id, client)
}

export async function hasIssueSupport(id: string, userId?: string, client = getSupabaseClient()) {
  if (!userId) return false
  const issue = await getIssueById(id, client)
  if (!issue) return false
  if (!client) return getFallbackSupportStore().has(`${userId}:${issue.id}`)
  const { data } = await client.from('issue_supports').select('id').eq('issue_id', issue.id).eq('user_id', userId).maybeSingle()
  return Boolean(data)
}

export async function getMyIssues(userId: string, client = getSupabaseClient()): Promise<IssueRecord[]> {
  if (!client) {
    const supportedIds = [...getFallbackSupportStore()].filter((key) => key.startsWith(`${userId}:`)).map((key) => key.split(':').slice(1).join(':'))
    const followedIds = [...getFallbackFollowStore()].filter((key) => key.startsWith(`${userId}:`)).map((key) => key.split(':').slice(1).join(':'))
    return getFallbackIssueStore().filter((issue) => issue.createdBy === userId || supportedIds.includes(issue.id) || followedIds.includes(issue.id)).map((issue) => ({
      ...issue,
      myRelationship: issue.createdBy === userId ? 'filed' : supportedIds.includes(issue.id) ? 'supported' : 'followed',
    }))
  }
  const { data: relationships, error } = await client.rpc('my_issue_ids')
  if (error) return []
  const relationshipRows = (relationships ?? []) as Array<{ issue_id: string; relationship: 'filed' | 'supported' | 'followed' }>
  const ids = relationshipRows.map((row) => row.issue_id)
  if (!ids.length) return []
  const { data } = await client.from('issues').select(PUBLIC_COLUMNS).in('id', ids).order('created_at', { ascending: false })
  const relationshipById = new Map(relationshipRows.map((row) => [row.issue_id, row.relationship] as const))
  return (data ?? []).map((row: any) => ({ ...normalizeIssue(row), createdBy: relationshipById.get(row.id) === 'filed' ? userId : undefined, myRelationship: relationshipById.get(row.id) }))
}

export async function hasIssueFollow(id: string, userId?: string, client = getSupabaseClient()) {
  if (!userId) return false
  const issue = await getIssueById(id, client)
  if (!issue) return false
  if (!client) return getFallbackFollowStore().has(`${userId}:${issue.id}`)
  const { data } = await client.from('issue_follows').select('id').eq('issue_id', issue.id).eq('user_id', userId).maybeSingle()
  return Boolean(data)
}

export async function setIssueFollow(id: string, userId: string | undefined, following: boolean, client = getSupabaseClient()) {
  const issue = await getIssueById(id, client)
  if (!issue) return null
  if (!userId) throw new Error('Sign in to follow an issue.')
  const key = `${userId}:${issue.id}`
  if (!client) {
    if (following) getFallbackFollowStore().add(key)
    else getFallbackFollowStore().delete(key)
    return issue
  }
  const result = following
    ? await client.from('issue_follows').upsert({ issue_id: issue.id, user_id: userId }, { onConflict: 'issue_id,user_id', ignoreDuplicates: true })
    : await client.from('issue_follows').delete().eq('issue_id', issue.id).eq('user_id', userId)
  if (result.error) throw result.error
  return issue
}

// Public discussion never shows account names; connected reads cannot see them either.
export async function addIssueComment(id: string, body: string, authorId?: string, client = getSupabaseClient()) {
  const displayName = 'Community member'
  const issue = await getIssueById(id, client)
  if (!issue) return null
  const text = safeComment(body.trim())
  if (!text) throw new Error('Write a comment first.')
  if (!client) {
    const comment = { id: crypto.randomUUID(), issue_id: issue.id, author_id: authorId, display_name: displayName, body: text, created_at: new Date().toISOString() }
    getFallbackCommentStore().unshift(comment)
    issue.comments += 1
    recordFallbackAudit('issue.comment_created', issue.id, authorId)
    return comment
  }
  if (!authorId) throw new Error('Sign in to join the discussion.')
  const { data, error } = await client.from('issue_comments').insert({ issue_id: issue.id, author_id: authorId, body: text }).select('id, issue_id, body, created_at').single()
  if (error) throw error
  return { ...data, display_name: displayName } as IssueComment
}

export async function getIssueComments(id: string, client = getSupabaseClient()): Promise<IssueComment[]> {
  const issue = await getIssueById(id, client)
  if (!issue) return []
  if (!client) return getFallbackCommentStore().filter((comment) => comment.issue_id === issue.id)
  const { data, error } = await client.from('issue_comments').select('id, issue_id, body, created_at').eq('issue_id', issue.id).order('created_at', { ascending: false }).limit(100)
  if (error) return []
  return (data ?? []).map((row: any) => ({ ...row, display_name: 'Community member' }))
}
