import { NextResponse } from 'next/server'
import { getRequestContext } from '@/lib/api-auth'
import { getMyIssues } from '@/lib/issues'

export async function GET(request: Request) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ issues: [], authenticated: false })
  const issues = await getMyIssues(actor.id, client)
  return NextResponse.json({ issues, authenticated: true })
}
