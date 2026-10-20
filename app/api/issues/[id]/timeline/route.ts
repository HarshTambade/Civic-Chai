import { NextResponse } from 'next/server'
import { getRequestContext } from '@/lib/api-auth'
import { getIssueById } from '@/lib/issues'
import { getFallbackAudit } from '@/lib/audit'
import { redactPublicText } from '@/lib/privacy'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { client, actor } = await getRequestContext(request)
    const issue = await getIssueById(id, client, false)
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    if (!client) {
      const statusActions = new Set(['issue.created', 'issue.status_changed', 'issue.community_verified', 'issue.reopened_by_citizen', 'duplicate.merged', 'duplicate.unmerged'])
      const events = getFallbackAudit()
        .filter((event) => event.issue_id === issue.id && statusActions.has(event.action))
        .map((event) => {
          const before = event.details.before && typeof event.details.before === 'object' ? (event.details.before as Record<string, unknown>).status : undefined
          const oldStatus = before ?? event.details.old_status ?? event.details.from ?? null
          const newStatus = event.details.status ?? event.details.new_status ?? event.details.to ?? (event.action === 'issue.created' ? issue.status : null)
          const note = typeof event.details.note === 'string' ? event.details.note : event.action === 'issue.community_verified' ? 'A participating citizen confirmed the resolution.' : event.action === 'issue.reopened_by_citizen' ? 'A participating citizen reported that the issue remains unresolved.' : event.action.startsWith('duplicate.') ? 'A reviewer updated the duplicate decision.' : event.action === 'issue.created' ? 'Report filed.' : null
          return { id: event.id, old_status: oldStatus, new_status: newStatus, note: note ? redactPublicText(note) : null, created_at: event.created_at }
        })
        .filter((event) => event.new_status && event.old_status !== event.new_status)
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      return NextResponse.json({ events })
    }
    const { data, error } = await client.from('public_issue_timeline').select('id,old_status,new_status,note,evidence_url,created_at').eq('issue_id', issue.id).order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: 'Unable to load issue history.' }, { status: 500 })
    return NextResponse.json({ events: (data ?? []).map((event) => ({ ...event, note: event.note ? redactPublicText(event.note) : null, evidence_url: undefined })) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load issue history.' }, { status: 500 })
  }
}
