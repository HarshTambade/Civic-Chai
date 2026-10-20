import { NextResponse } from 'next/server'
import { addIssueComment, getIssueComments } from '@/lib/issues'
import { getRequestContext } from '@/lib/api-auth'
import { APP_ROLES } from '@/lib/roles'
import { consumeRateLimit } from '@/lib/rate-limit'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { client } = await getRequestContext(request)
  const { id } = await params
  return NextResponse.json({ comments: await getIssueComments(id, client) })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await consumeRateLimit(request, 'comment-create', 12, 120))) return NextResponse.json({ error: 'Too many comments from this connection. Please try again later.' }, { status: 429 })
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.role || !APP_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: 'Sign in to join the discussion.' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await request.json()
    const comment = await addIssueComment(id, String(body.body ?? ''), actor.id, actor.name, client)
    if (!comment) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to post comment.' }, { status: 400 })
  }
}
