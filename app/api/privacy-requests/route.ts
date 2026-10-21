import { NextResponse } from 'next/server'
import { authorizeRoles, getRequestContext } from '@/lib/api-auth'
import { getSupabaseServiceClient } from '@/lib/supabase'
import { safeComment } from '@/lib/privacy'

const TYPES = ['access', 'correction', 'erasure', 'grievance'] as const

export async function GET(request: Request) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to view privacy requests.' }, { status: 401 })
  if (actor.role === 'system_admin') {
    const service = getSupabaseServiceClient()
    if (!service) return NextResponse.json({ error: 'Privacy request review requires the server-only Supabase key.' }, { status: 503 })
    const { data, error } = await service.from('data_rights_requests').select('id,user_id,request_type,details,status,response_note,created_at,reviewed_at').order('created_at', { ascending: false }).limit(200)
    if (error) return NextResponse.json({ error: 'Unable to load privacy requests.' }, { status: 500 })
    return NextResponse.json({ requests: data ?? [] })
  }
  if (!client) return NextResponse.json({ requests: [] })
  const { data, error } = await client.from('data_rights_requests').select('id,request_type,details,status,response_note,created_at,reviewed_at').eq('user_id', actor.id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Unable to load privacy requests.' }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}

export async function POST(request: Request) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to send a privacy request.' }, { status: 401 })
  try {
    const body = await request.json()
    const requestType = String(body.request_type ?? '') as (typeof TYPES)[number]
    if (!TYPES.includes(requestType)) return NextResponse.json({ error: 'Choose access, correction, erasure or grievance.' }, { status: 400 })
    const details = safeComment(String(body.details ?? '').trim())
    if (!client) {
      return NextResponse.json({ error: 'Privacy request records need Supabase to retain and route them. Sign in to a connected deployment or use the site support channel.' }, { status: 503 })
    }
    const { data, error } = await client.from('data_rights_requests').insert({ user_id: actor.id, request_type: requestType, details: details || null }).select('id,request_type,status,created_at').single()
    if (error) throw error
    return NextResponse.json({ request: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send your request.' }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeRoles(request, ['system_admin'])
  if (auth.response) return auth.response
  const service = getSupabaseServiceClient()
  if (!service) return NextResponse.json({ error: 'Privacy request review requires the server-only Supabase key.' }, { status: 503 })
  try {
    const body = await request.json()
    const id = String(body.id ?? '')
    const status = String(body.status ?? '')
    if (!id || !['in_review', 'fulfilled', 'declined'].includes(status)) return NextResponse.json({ error: 'Choose a privacy request and a valid review status.' }, { status: 400 })
    const responseNote = safeComment(String(body.response_note ?? '').trim())
    if (status !== 'in_review' && !responseNote) return NextResponse.json({ error: 'Add the action taken or the reason for declining this request before closing it.' }, { status: 400 })
    const { data, error } = await service.from('data_rights_requests').update({ status, response_note: responseNote || null, reviewed_by: auth.actor?.id, reviewed_at: new Date().toISOString() }).eq('id', id).select('id,user_id,request_type,status,response_note,reviewed_at').single()
    if (error) throw error
    await service.from('audit_logs').insert({ actor_id: auth.actor?.id, action: `privacy_request.${status}`, details: { request_id: id, request_type: data.request_type } })
    return NextResponse.json({ request: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update the privacy request.' }, { status: 400 })
  }
}
