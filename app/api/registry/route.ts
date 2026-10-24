import { NextResponse } from 'next/server'
import { authorizeRoles } from '@/lib/api-auth'
import { getSupabaseServiceClient } from '@/lib/supabase'

function isSecurePublicUrl(value: unknown) {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  const auth = await authorizeRoles(request, ['authority_admin'])
  if (auth.response) return auth.response
  const service = getSupabaseServiceClient()
  if (!service) return NextResponse.json({ error: 'The authority registry needs a connected Supabase project with the server-only key. Local preview does not store registry records.' }, { status: 503 })
  const pin = auth.actor?.pin
  if (!pin) return NextResponse.json({ error: 'Your account has no authorized jurisdiction PIN. Ask the system administrator to set your profile scope.' }, { status: 403 })
  const { data: jurisdictions, error: jurisdictionError } = await service.from('jurisdictions').select('id,name,level,pin,source_url,source_version,is_verified,verified_at').eq('pin', pin).order('level')
  if (jurisdictionError) return NextResponse.json({ error: 'Jurisdiction registry schema is not ready.' }, { status: 503 })
  const jurisdictionIds = (jurisdictions ?? []).map((item) => item.id)
  const [hubs, officers, documents, slaTargets] = await Promise.all([
    service.from('authority_hubs').select('id,name,address,pin,ward,municipality,district,state,public_phone,public_email,source_url,source_version,is_verified,verified_at').eq('pin', pin).order('name'),
    service.from('officer_registry').select('id,name,role,department,pin,hub,public_phone,public_email,source_url,source_version,is_verified,verified_at').eq('pin', pin).order('department'),
    jurisdictionIds.length
      ? service.from('official_documents').select('id,title,authority,document_number,source_url,published_at,effective_at,version,checksum,is_verified,verified_at').in('jurisdiction_id', jurisdictionIds).order('published_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    jurisdictionIds.length
      ? service.from('sla_targets').select('id,target_hours,source_url,source_version,is_verified,effective_at,expires_at,department_id,category_id,departments(name),categories(name),created_at').in('jurisdiction_id', jurisdictionIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])
  const firstError = hubs.error ?? officers.error ?? documents.error ?? slaTargets.error
  if (firstError) return NextResponse.json({ error: 'Registry schema is not ready. Apply the CivicChai migrations first.' }, { status: 503 })
  return NextResponse.json({ jurisdictions: jurisdictions ?? [], hubs: hubs.data ?? [], officers: officers.data ?? [], documents: documents.data ?? [], sla_targets: slaTargets.data ?? [] })
}

const REGISTRY_TABLES = { jurisdiction: 'jurisdictions', hub: 'authority_hubs', officer: 'officer_registry', document: 'official_documents', sla: 'sla_targets' } as const

/** Marks an existing, in-scope registry record verified (or withdraws verification) after source review. */
export async function PATCH(request: Request) {
  const auth = await authorizeRoles(request, ['authority_admin'])
  if (auth.response) return auth.response
  const service = getSupabaseServiceClient()
  if (!service) return NextResponse.json({ error: 'Registry verification requires the server-only Supabase service key.' }, { status: 503 })
  try {
    const body = await request.json()
    const kind = String(body.kind ?? '') as keyof typeof REGISTRY_TABLES
    const table = REGISTRY_TABLES[kind]
    const id = String(body.id ?? '')
    if (!table || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Choose a registry record to verify.' }, { status: 400 })
    const pin = auth.actor?.pin
    if (!pin) return NextResponse.json({ error: 'Your account has no authorized jurisdiction.' }, { status: 403 })
    const { data: jurisdictions } = await service.from('jurisdictions').select('id').eq('pin', pin)
    const jurisdictionIds = (jurisdictions ?? []).map((row) => row.id)
    const { data: record, error: readError } = await service.from(table).select('*').eq('id', id).maybeSingle()
    if (readError || !record) return NextResponse.json({ error: 'Registry record not found.' }, { status: 404 })
    const inScope = 'pin' in record && record.pin ? record.pin === pin : jurisdictionIds.includes(record.jurisdiction_id)
    if (!inScope) return NextResponse.json({ error: 'Registry record is outside your jurisdiction.' }, { status: 404 })
    const verified = body.is_verified === true
    if (verified && (!isSecurePublicUrl(record.source_url) || !/(\.gov\.in|\.nic\.in)$/i.test(new URL(record.source_url).hostname))) {
      return NextResponse.json({ error: 'Only records sourced from an official HTTPS .gov.in or .nic.in page can be marked verified.' }, { status: 400 })
    }
    const patch = table === 'sla_targets'
      ? { is_verified: verified }
      : { is_verified: verified, verified_by: verified ? auth.actor!.id : null, verified_at: verified ? new Date().toISOString() : null }
    const { data, error } = await service.from(table).update(patch).eq('id', id).select('*').single()
    if (error) throw error
    await service.from('audit_logs').insert({ actor_id: auth.actor!.id, action: `registry.${kind}_${verified ? 'verified' : 'unverified'}`, details: { id, source_url: record.source_url } })
    return NextResponse.json({ record: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update registry verification.' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRoles(request, ['authority_admin'])
  if (auth.response) return auth.response
  const service = getSupabaseServiceClient()
  if (!service) return NextResponse.json({ error: 'Registry writes require the server-only Supabase service key.' }, { status: 503 })
  try {
    const body = await request.json()
    const kind = String(body.kind ?? '')
    const pin = String(body.pin ?? '').trim()
    const sourceUrl = String(body.source_url ?? '').trim()
    if (!/^\d{6}$/.test(pin) || !auth.actor?.pin || pin !== auth.actor.pin) return NextResponse.json({ error: 'PIN must be inside your authorized jurisdiction.' }, { status: 403 })
    if (!isSecurePublicUrl(sourceUrl)) return NextResponse.json({ error: 'Provide an HTTPS source URL for registry provenance.' }, { status: 400 })
    const verified = body.is_verified === true
    if (verified && !/(\.gov\.in|\.nic\.in)$/i.test(new URL(sourceUrl).hostname)) return NextResponse.json({ error: 'Only an official government or NIC domain can be marked verified.' }, { status: 400 })
    const sourceVersion = String(body.source_version ?? '1').slice(0, 40)
    const verification = { source_url: sourceUrl, source_version: sourceVersion, is_verified: verified, verified_by: verified ? auth.actor.id : null, verified_at: verified ? new Date().toISOString() : null }
    let table: string
    let record: Record<string, unknown>
    if (kind === 'jurisdiction') {
      const level = String(body.level ?? '')
      if (!['state', 'district', 'municipality', 'ward', 'pin', 'locality'].includes(level)) return NextResponse.json({ error: 'Choose a valid jurisdiction level.' }, { status: 400 })
      const name = String(body.name ?? '').trim().slice(0, 160)
      if (!name) return NextResponse.json({ error: 'Add a jurisdiction name.' }, { status: 400 })
      table = 'jurisdictions'
      record = { ...verification, name, level, pin }
    } else {
      const { data: jurisdiction } = await service.from('jurisdictions').select('id').eq('pin', pin).limit(1).maybeSingle()
      if (!jurisdiction) return NextResponse.json({ error: 'Add a jurisdiction registry record for this PIN first.' }, { status: 400 })
      const base = { ...verification, jurisdiction_id: jurisdiction.id }
      if (kind === 'hub') {
      table = 'authority_hubs'
      record = { ...base, name: String(body.name ?? '').slice(0, 160), address: String(body.address ?? '').slice(0, 300), pin, ward: String(body.ward ?? '').slice(0, 100), municipality: String(body.municipality ?? '').slice(0, 120), district: String(body.district ?? '').slice(0, 120), state: String(body.state ?? '').slice(0, 100), public_phone: String(body.public_phone ?? '').slice(0, 40) || null, public_email: String(body.public_email ?? '').slice(0, 160) || null }
      } else if (kind === 'officer') {
      const { data: department } = await service.from('departments').select('id').eq('name', String(body.department ?? '').trim()).limit(1).maybeSingle()
      if (!department) return NextResponse.json({ error: 'Use a department name from the configured department registry so this officer can be matched to issues.' }, { status: 400 })
      table = 'officer_registry'
      record = { ...base, name: String(body.name ?? '').slice(0, 120), role: String(body.role ?? '').slice(0, 120), department: String(body.department ?? '').trim().slice(0, 120), pin, hub: String(body.hub ?? '').slice(0, 160), public_phone: String(body.public_phone ?? '').slice(0, 40) || null, public_email: String(body.public_email ?? '').slice(0, 160) || null }
      } else if (kind === 'document') {
      table = 'official_documents'
      record = { ...base, title: String(body.title ?? '').slice(0, 200), authority: String(body.authority ?? '').slice(0, 160), document_number: String(body.document_number ?? '').slice(0, 100) || null, published_at: body.published_at ? new Date(String(body.published_at)).toISOString() : new Date().toISOString(), effective_at: body.effective_at ? new Date(String(body.effective_at)).toISOString() : null, version: String(body.version ?? '1').slice(0, 40), checksum: String(body.checksum ?? '').slice(0, 128) || null }
      } else if (kind === 'sla') {
      const targetHours = Number(body.target_hours)
      if (!Number.isInteger(targetHours) || targetHours < 1 || targetHours > 87600) return NextResponse.json({ error: 'SLA target must be between 1 and 87,600 hours.' }, { status: 400 })
      const departmentName = String(body.department ?? '').trim()
      const categoryName = String(body.category ?? '').trim()
      const [{ data: department }, { data: category }] = await Promise.all([
        departmentName ? service.from('departments').select('id').eq('name', departmentName).limit(1).maybeSingle() : Promise.resolve({ data: null }),
        categoryName ? service.from('categories').select('id').eq('name', categoryName).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      ])
      if (departmentName && !department) return NextResponse.json({ error: 'That department is not in the approved department registry.' }, { status: 400 })
      if (categoryName && !category) return NextResponse.json({ error: 'That category is not in the approved category registry.' }, { status: 400 })
      table = 'sla_targets'
      record = { jurisdiction_id: jurisdiction.id, department_id: department?.id ?? null, category_id: category?.id ?? null, target_hours: targetHours, source_url: sourceUrl, source_version: String(body.source_version ?? '1').slice(0, 40), is_verified: verified, effective_at: body.effective_at ? new Date(String(body.effective_at)).toISOString() : null, expires_at: body.expires_at ? new Date(String(body.expires_at)).toISOString() : null, created_by: auth.actor.id }
      } else {
      return NextResponse.json({ error: 'Choose a hub, officer or document record.' }, { status: 400 })
      }
    }
    const { data, error } = await service.from(table).insert(record).select('*').single()
    if (error) throw error
    await service.from('audit_logs').insert({ actor_id: auth.actor.id, action: `registry.${kind}_created`, details: { id: data.id, verified, source_url: sourceUrl } })
    return NextResponse.json({ record: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to add registry record.' }, { status: 400 })
  }
}
