import { NextResponse } from 'next/server'
import { getRequestContext } from '@/lib/api-auth'
import { hasIssueFollow, setIssueFollow } from '@/lib/issues'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ following: false })
  const { id } = await params
  return NextResponse.json({ following: await hasIssueFollow(id, actor.id, client) })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to follow this issue.' }, { status: 401 })
  const { id } = await params
  try {
    const issue = await setIssueFollow(id, actor.id, true, client)
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    return NextResponse.json({ following: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to follow this issue.' }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to unfollow this issue.' }, { status: 401 })
  const { id } = await params
  try {
    const issue = await setIssueFollow(id, actor.id, false, client)
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    return NextResponse.json({ following: false })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to unfollow this issue.' }, { status: 400 })
  }
}
