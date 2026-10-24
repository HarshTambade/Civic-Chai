import { NextResponse } from 'next/server'
import { addCorroboratingReport, addIssueSupport, hasIssueSupport } from '@/lib/issues'
import { getRequestContext } from '@/lib/api-auth'
import { APP_ROLES } from '@/lib/roles'
import { toPublicIssue } from '@/lib/privacy'
import { consumeRateLimit } from '@/lib/rate-limit'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimit = await consumeRateLimit(request, 'issue-support', 30, 600)
  if (rateLimit === null) return NextResponse.json({ error: 'Request protection is temporarily unavailable. Please try again shortly.' }, { status: 503 })
  if (!rateLimit) return NextResponse.json({ error: 'Too many support requests from this connection. Please try again later.' }, { status: 429 })
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.role || !APP_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: 'Sign in to support an issue.' }, { status: 401 })
  }
  if (actor.role !== 'citizen' || !actor.id) return NextResponse.json({ error: 'Community support is reserved for citizen accounts.' }, { status: 403 })
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    let issue = await addIssueSupport(id, actor.id, client)
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })

    // Joining from a duplicate suggestion also records the citizen's own report
    // as an independent corroborating report on the existing issue.
    const reportText = typeof body.report_text === 'string' ? body.report_text : ''
    if (reportText.trim()) {
      const service = getSupabaseServiceClient()
      if (hasSupabaseConfig() && !service) return NextResponse.json({ error: 'Joining a report requires the server-only Supabase key.' }, { status: 503 })
      issue = await addCorroboratingReport(issue.id, actor.id, {
        text: reportText,
        language: typeof body.language === 'string' ? body.language : undefined,
        sourceChannel: body.source_channel === 'voice' ? 'voice' : body.source_channel === 'pwa' ? 'pwa' : 'web',
        hasEvidence: body.has_evidence === true,
        consent: body.consent && typeof body.consent === 'object' ? body.consent as Record<string, boolean> : {},
      }, service ?? client) ?? issue
    }
    return NextResponse.json({ issue: toPublicIssue(issue) })
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
