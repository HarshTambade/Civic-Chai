import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

// This route deliberately exposes only rows explicitly verified by the
// authority. Unverified contacts and documents stay inside the control room.
export async function GET(request: Request) {
  const pin = new URL(request.url).searchParams.get('pin') ?? ''
  if (!/^\d{6}$/.test(pin)) return NextResponse.json({ error: 'PIN must contain six digits.' }, { status: 400 })
  const client = getSupabaseClient()
  if (!client) return NextResponse.json({ jurisdiction: null, hubs: [], officers: [], documents: [], sla_targets: [] })

  try {
    const [jurisdictionResult, hubsResult, officersResult] = await Promise.all([
      client.from('jurisdictions').select('id,name,level,parent_id,source_url,source_version,verified_at').eq('pin', pin).eq('is_verified', true),
      client.from('authority_hubs').select('id,name,address,pin,ward,municipality,district,state,public_phone,public_email,source_url,source_version,verified_at').eq('pin', pin).eq('is_verified', true),
      client.from('officer_registry').select('id,name,role,department,pin,hub,public_phone,public_email,source_url,source_version,verified_at').eq('pin', pin).eq('is_verified', true),
    ])
    if (jurisdictionResult.error || hubsResult.error || officersResult.error) throw new Error('Verified public registry is unavailable.')
    const jurisdictionIds = (jurisdictionResult.data ?? []).map((row) => row.id)
    const [documentsResult, slaResult] = jurisdictionIds.length
      ? await Promise.all([
          client.from('official_documents').select('id,title,authority,document_number,source_url,published_at,effective_at,version,checksum,issuing_authority,verified_at').in('jurisdiction_id', jurisdictionIds).eq('is_verified', true).order('published_at', { ascending: false }),
          client.from('sla_targets').select('id,target_hours,source_url,source_version,effective_at,expires_at,department_id,category_id,departments(name),categories(name)').in('jurisdiction_id', jurisdictionIds).eq('is_verified', true).order('created_at', { ascending: false }),
        ])
      : [{ data: [], error: null }, { data: [], error: null }]
    if (documentsResult.error || slaResult.error) throw new Error('Verified public references are unavailable.')
    return NextResponse.json({
      jurisdiction: jurisdictionResult.data?.[0] ?? null,
      jurisdictions: jurisdictionResult.data ?? [],
      hubs: hubsResult.data ?? [],
      officers: officersResult.data ?? [],
      documents: documentsResult.data ?? [],
      sla_targets: slaResult.data ?? [],
    }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } })
  } catch {
    return NextResponse.json({ error: 'Verified public registry is unavailable until the CivicChai migrations are ready.' }, { status: 503 })
  }
}
