import { NextResponse } from 'next/server'
import { canSeeIssue } from '@/lib/scope'
import { getIssueById } from '@/lib/issues'
import { getRequestContext } from '@/lib/api-auth'
import { canManageIssues } from '@/lib/roles'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'
import { toPublicIssue } from '@/lib/privacy'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { client, actor } = await getRequestContext(_request)
  const privileged = canManageIssues(actor?.role ?? 'citizen')
  const service = privileged ? getSupabaseServiceClient() : null
  if (privileged && hasSupabaseConfig() && !service) return NextResponse.json({ error: 'Privileged issue reads require the server-only Supabase service key.' }, { status: 503 })
  const issue = await getIssueById(id, service ?? client, privileged)

  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  }

  if (privileged && !canSeeIssue(actor, issue)) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  return NextResponse.json(privileged ? issue : toPublicIssue(issue))
}
