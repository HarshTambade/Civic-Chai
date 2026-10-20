import { NextResponse } from 'next/server'
import { authorizeRoles } from '@/lib/api-auth'
import { getLocalModerationReports, type ModerationStatus } from '@/lib/moderation'
import { getSupabaseServiceClient } from '@/lib/supabase'

const STATUSES: ModerationStatus[] = ['reviewing', 'actioned', 'dismissed', 'appealed']

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRoles(request, ['moderator', 'authority_admin'])
  if (auth.response) return auth.response
  const { id } = await params
  try {
    const body = await request.json()
    const status = String(body.status ?? '') as ModerationStatus
    if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Choose a valid review action.' }, { status: 400 })
    const moderatorNote = typeof body.moderator_note === 'string' ? body.moderator_note.trim().slice(0, 2000) : ''
    const service = getSupabaseServiceClient()
    if (!service) {
      const report = getLocalModerationReports().find((item) => item.id === id)
      if (!report) return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
      Object.assign(report, { status, moderator_note: moderatorNote, reviewed_at: new Date().toISOString() })
      return NextResponse.json({ report })
    }
    const { data: report, error: reportError } = await service.from('moderation_reports').select('id,issue_id,comment_id,status').eq('id', id).maybeSingle()
    if (reportError || !report) return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
    if (auth.actor?.role === 'authority_admin') {
      let issueId = report.issue_id
      if (!issueId && report.comment_id) {
        const { data: comment } = await service.from('issue_comments').select('issue_id').eq('id', report.comment_id).maybeSingle()
        issueId = comment?.issue_id ?? null
      }
      const { data: issue } = issueId ? await service.from('issues').select('pin').eq('id', issueId).maybeSingle() : { data: null }
      if (!issue || issue.pin !== auth.actor.pin) return NextResponse.json({ error: 'Report is outside your jurisdiction.' }, { status: 404 })
    }
    const { error } = await service.from('moderation_reports').update({ status, moderator_note: moderatorNote || null, reviewed_by: auth.actor?.id ?? null, reviewed_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
    if (status === 'actioned' && report.comment_id) {
      await service.from('issue_comments').update({ status: 'hidden' }).eq('id', report.comment_id)
    }
    if (status === 'actioned' && report.issue_id) {
      await service.from('issues').update({ is_public: false }).eq('id', report.issue_id)
    }
    if (status === 'dismissed' && report.issue_id && report.status === 'actioned') {
      const { data: otherActions } = await service.from('moderation_reports').select('id').eq('issue_id', report.issue_id).eq('status', 'actioned').neq('id', id).limit(1)
      if (!otherActions?.length) await service.from('issues').update({ is_public: true }).eq('id', report.issue_id)
    }
    if (status === 'dismissed' && report.comment_id && report.status === 'actioned') {
      const { data: otherActions } = await service.from('moderation_reports').select('id').eq('comment_id', report.comment_id).eq('status', 'actioned').neq('id', id).limit(1)
      if (!otherActions?.length) await service.from('issue_comments').update({ status: 'visible' }).eq('id', report.comment_id)
    }
    await service.from('audit_logs').insert({ issue_id: report.issue_id, actor_id: auth.actor?.id, action: `moderation.${status}`, details: { report_id: id, comment_id: report.comment_id, moderator_note: moderatorNote } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update this moderation report.' }, { status: 400 })
  }
}
