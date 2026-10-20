import { NextResponse } from 'next/server'
import { getRequestContext } from '@/lib/api-auth'
import { getLocalModerationReports } from '@/lib/moderation'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'
import { safeComment } from '@/lib/privacy'

export async function GET(request: Request) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to view your moderation reports.' }, { status: 401 })
  if (!client) return NextResponse.json({ reports: getLocalModerationReports().filter((report) => report.reporter_id === actor.id) })
  const { data, error } = await client.from('moderation_reports').select('id,issue_id,comment_id,reason,details,status,moderator_note,appeal_details,appealed_at,created_at,reviewed_at').eq('reporter_id', actor.id).order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Unable to load your moderation reports.' }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}

export async function POST(request: Request) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to appeal a moderation decision.' }, { status: 401 })
  try {
    const body = await request.json()
    const id = String(body.id ?? '')
    const details = safeComment(String(body.details ?? '').trim())
    if (!id || details.length < 5) return NextResponse.json({ error: 'Add a short explanation for your appeal.' }, { status: 400 })
    if (!client) {
      const report = getLocalModerationReports().find((item) => item.id === id && item.reporter_id === actor.id)
      if (!report) return NextResponse.json({ error: 'Moderation report not found.' }, { status: 404 })
      if (!['actioned', 'dismissed'].includes(report.status)) return NextResponse.json({ error: 'Appeals are available after a report decision.' }, { status: 409 })
      Object.assign(report, { status: 'appealed', appeal_details: details, appealed_at: new Date().toISOString() })
      return NextResponse.json({ report })
    }
    const { data: report, error: readError } = await client.from('moderation_reports').select('id,reporter_id,status,issue_id').eq('id', id).eq('reporter_id', actor.id).maybeSingle()
    if (readError || !report) return NextResponse.json({ error: 'Moderation report not found.' }, { status: 404 })
    if (!['actioned', 'dismissed'].includes(report.status)) return NextResponse.json({ error: 'Appeals are available after a report decision.' }, { status: 409 })
    const service = getSupabaseServiceClient()
    if (hasSupabaseConfig() && !service) return NextResponse.json({ error: 'Appeal processing needs the configured server-only Supabase key.' }, { status: 503 })
    const writer = service ?? client
    const { data: updated, error } = await writer.from('moderation_reports').update({ status: 'appealed', appeal_details: details, appealed_at: new Date().toISOString() }).eq('id', id).eq('reporter_id', actor.id).select('id,issue_id,comment_id,reason,details,status,moderator_note,appeal_details,appealed_at,created_at,reviewed_at').single()
    if (error) throw error
    if (service) await service.from('audit_logs').insert({ issue_id: report.issue_id, actor_id: actor.id, action: 'moderation.appealed', details: { report_id: id } })
    return NextResponse.json({ report: updated })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send this appeal.' }, { status: 400 })
  }
}
