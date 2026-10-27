import { NextResponse } from 'next/server'
import { coveredPins } from '@/lib/scope'
import { authorizeRoles } from '@/lib/api-auth'
import { getLocalModerationReports } from '@/lib/moderation'
import { getSupabaseServiceClient } from '@/lib/supabase'

export async function GET(request: Request) {
  const auth = await authorizeRoles(request, ['moderator', 'authority_admin'])
  if (auth.response) return auth.response
  const service = getSupabaseServiceClient()
  if (!service) return NextResponse.json({ reports: getLocalModerationReports() })
  const pins = coveredPins(auth.actor)
  if (auth.actor?.role === 'authority_admin' && !pins.length && !auth.actor.allAreas) return NextResponse.json({ reports: [] })
  const query = service.from('moderation_reports').select('id,reporter_id,issue_id,comment_id,reason,details,status,moderator_note,appeal_details,appealed_at,created_at,reviewed_at,issues!moderation_reports_issue_id_fkey(document_id,title,pin,locality),issue_comments!moderation_reports_comment_id_fkey(issue_id,body,status)').order('created_at', { ascending: false }).limit(200)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Unable to load moderation reports.' }, { status: 500 })
  let reports = data ?? []
  if (auth.actor?.role === 'authority_admin' && !auth.actor.allAreas) {
    const commentIssueIds = reports.map((report) => report.issue_comments[0]?.issue_id).filter((id): id is string => typeof id === 'string')
    const issueIds = [...new Set([...reports.map((report) => report.issue_id).filter((id): id is string => typeof id === 'string'), ...commentIssueIds])]
    const { data: scopedIssues } = issueIds.length ? await service.from('issues').select('id').in('id', issueIds).in('pin', pins) : { data: [] }
    const scopedIds = new Set((scopedIssues ?? []).map((issue) => issue.id))
    reports = reports.filter((report) => {
      const commentIssueId = report.issue_comments[0]?.issue_id
      return Boolean((report.issue_id && scopedIds.has(report.issue_id)) || (commentIssueId && scopedIds.has(commentIssueId)))
    })
  }
  return NextResponse.json({ reports })
}
