import { NextResponse } from 'next/server'
import { coveredPins } from '@/lib/scope'
import { authorizeRoles } from '@/lib/api-auth'
import { getFallbackAudit } from '@/lib/audit'
import { getSupabaseServiceClient } from '@/lib/supabase'

export async function GET(request: Request) {
  const auth = await authorizeRoles(request, ['auditor', 'authority_admin'])
  if (auth.response) return auth.response
  const service = getSupabaseServiceClient()
  if (!service) return NextResponse.json({ events: getFallbackAudit() })
  const pins = coveredPins(auth.actor)
  if (!pins.length && !auth.actor?.allAreas) return NextResponse.json({ events: [] })

  let issueIds: string[] | undefined
  if (!auth.actor?.allAreas && (auth.actor?.role === 'authority_admin' || auth.actor?.role === 'auditor')) {
    const { data: issues } = await service.from('issues').select('id').in('pin', pins)
    issueIds = (issues ?? []).map((issue) => issue.id)
    if (!issueIds.length) return NextResponse.json({ events: [] })
  }
  let query = service.from('audit_logs').select('id, issue_id, actor_id, action, details, created_at').order('created_at', { ascending: false }).limit(200)
  if (issueIds) query = query.in('issue_id', issueIds)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Unable to load the audit trail.' }, { status: 500 })
  return NextResponse.json({ events: data ?? [] })
}
