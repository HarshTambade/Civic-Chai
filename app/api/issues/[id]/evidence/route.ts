import { NextResponse } from 'next/server'
import { canSeeIssue } from '@/lib/scope'
import { getRequestContext } from '@/lib/api-auth'
import { getIssueById } from '@/lib/issues'
import { canManageIssues } from '@/lib/roles'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to view protected evidence.' }, { status: 401 })
  const service = getSupabaseServiceClient()
  if (hasSupabaseConfig() && !service) return NextResponse.json({ error: 'Protected evidence requires the server-only Supabase key.' }, { status: 503 })
  const { id } = await params
  try {
    const issue = await getIssueById(id, service ?? client, true)
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    const manager = canManageIssues(actor.role ?? 'citizen')
    const inManagerScope = canSeeIssue(actor, issue)
    if ((manager && !inManagerScope) || (!manager && issue.createdBy !== actor.id)) return NextResponse.json({ error: 'Evidence is outside your authorized access.' }, { status: 404 })

    if (!service) {
      const evidence = (issue.evidenceUrls ?? []).filter((url) => url.startsWith('data:')).map((url, index) => ({ id: `local-${index}`, media_type: url.slice(5, url.indexOf(';')), url }))
      return NextResponse.json({ evidence }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const { data: rows, error } = await service.from('issue_evidence').select('id,storage_path,media_type,caption,created_at').eq('issue_id', issue.id).order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: 'Unable to load protected evidence metadata.' }, { status: 503 })
    const evidence = await Promise.all((rows ?? []).filter((row) => row.storage_path).map(async (row) => {
      const { data, error: urlError } = await service.storage.from('issue-evidence').createSignedUrl(row.storage_path!, 120)
      return urlError || !data?.signedUrl ? null : { id: row.id, media_type: row.media_type ?? 'application/octet-stream', caption: row.caption, created_at: row.created_at, url: data.signedUrl }
    }))
    return NextResponse.json({ evidence: evidence.filter(Boolean) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load protected evidence.' }, { status: 500 })
  }
}
