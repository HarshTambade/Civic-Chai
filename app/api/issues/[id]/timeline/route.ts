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
      const events = getFallbackAudit().filter((event) => event.issue_id === issue.id && event.action.includes('status')).map((event) => ({ id: event.id, old_status: event.details.before && typeof event.details.before === 'object' ? (event.details.before as Record<string, unknown>).status : null, new_status: event.details.status, note: event.details.note, created_at: event.created_at }))
      return NextResponse.json({ events })
    }
    const { data, error } = await client.from('public_issue_timeline').select('id,old_status,new_status,note,evidence_url,created_at').eq('issue_id', issue.id).order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: 'Unable to load issue history.' }, { status: 500 })
    return NextResponse.json({ events: (data ?? []).map((event) => ({ ...event, note: event.note ? redactPublicText(event.note) : null, evidence_url: undefined })) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load issue history.' }, { status: 500 })
  }
}
