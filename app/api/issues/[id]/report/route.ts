import { NextResponse } from 'next/server'
import { getRequestContext } from '@/lib/api-auth'
import { getIssueById } from '@/lib/issues'
import { getLocalModerationReports, type ModerationReason } from '@/lib/moderation'
import { safeComment } from '@/lib/privacy'
import { consumeRateLimit } from '@/lib/rate-limit'

const REASONS: ModerationReason[] = ['abuse', 'personal_data', 'spam', 'misinformation', 'other']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to report content.' }, { status: 401 })
  if (!(await consumeRateLimit(request, 'moderation-report', 5, 600))) return NextResponse.json({ error: 'Too many reports. Please try again later.' }, { status: 429 })
  const { id } = await params
  const issue = await getIssueById(id, client)
  if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
  try {
    const body = await request.json()
    const reason = String(body.reason ?? '') as ModerationReason
    if (!REASONS.includes(reason)) return NextResponse.json({ error: 'Choose a report reason.' }, { status: 400 })
    const details = safeComment(String(body.details ?? '').trim())
    const commentId = typeof body.comment_id === 'string' ? body.comment_id : ''
    if (commentId) {
      const comments = await import('@/lib/issues').then(({ getIssueComments }) => getIssueComments(issue.id, client))
      if (!comments.some((comment) => comment.id === commentId)) return NextResponse.json({ error: 'Comment not found on this issue.' }, { status: 404 })
    }
    if (!client) {
      const report = { id: crypto.randomUUID(), reporter_id: actor.id, issue_id: commentId ? null : issue.id, comment_id: commentId || null, reason, details, status: 'open' as const, created_at: new Date().toISOString() }
      getLocalModerationReports().unshift(report)
      return NextResponse.json({ report: { id: report.id, status: report.status } }, { status: 201 })
    }
    const { data, error } = await client.from('moderation_reports').insert({ reporter_id: actor.id, issue_id: commentId ? null : issue.id, comment_id: commentId || null, reason, details: details || null }).select('id,status').single()
    if (error) throw error
    return NextResponse.json({ report: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send this report.' }, { status: 400 })
  }
}
