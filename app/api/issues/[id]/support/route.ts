import { NextResponse } from 'next/server'
import { addIssueSupport, hasIssueSupport } from '@/lib/issues'
import { getRequestContext } from '@/lib/api-auth'
import { APP_ROLES } from '@/lib/roles'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.role || !APP_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: 'Sign in to support an issue.' }, { status: 401 })
  }
  if (actor.role !== 'citizen') return NextResponse.json({ error: 'Community support is reserved for citizen accounts.' }, { status: 403 })
  try {
    const { id } = await params
    const issue = await addIssueSupport(id, actor.id, client)
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    return NextResponse.json({ issue })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to add support.' }, { status: 400 })
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ supported: false })
  const { id } = await params
  return NextResponse.json({ supported: await hasIssueSupport(id, actor.id, client) })
}
