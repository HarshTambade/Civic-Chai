import { NextResponse } from 'next/server'
import { getRequestContext } from '@/lib/api-auth'
import { MIGRATION_HELP, isSchemaError, publicErrorMessage } from '@/lib/api-errors'
import { WithdrawRefused, withdrawIssue } from '@/lib/issues'
import { consumeRateLimit } from '@/lib/rate-limit'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'

/** The reporter takes back their own complaint: deleted if untouched, otherwise withdrawn. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, authenticated, mfaRequired } = await getRequestContext(request)
  if (mfaRequired) return NextResponse.json({ error: 'Verify your multi-factor authentication first.', code: 'mfa_required' }, { status: 403 })
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to take back your complaint.' }, { status: 401 })
  const rateLimit = await consumeRateLimit(request, 'issue-withdraw', 10, 600)
  if (rateLimit === null) return NextResponse.json({ error: 'Request protection is temporarily unavailable. Please try again shortly.' }, { status: 503 })
  if (!rateLimit) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  const service = getSupabaseServiceClient()
  if (hasSupabaseConfig() && !service) return NextResponse.json({ error: 'Withdrawals require the server-only Supabase service key.' }, { status: 503 })
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  try {
    const result = await withdrawIssue(id, actor.id, String(body?.reason ?? ''), service)
    if (!result) return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 })
    return NextResponse.json({
      ...result,
      message: result.outcome === 'deleted'
        ? `Complaint ${result.documentId} is deleted.`
        : `Complaint ${result.documentId} is withdrawn. It is no longer public and the authority will not act on it.`,
    })
  } catch (error) {
    if (error instanceof WithdrawRefused) return NextResponse.json({ error: `${error.message}.` }, { status: 409 })
    if (isSchemaError(error)) return NextResponse.json({ error: MIGRATION_HELP }, { status: 503 })
    return NextResponse.json({ error: publicErrorMessage(error, 'The complaint could not be withdrawn.') }, { status: 500 })
  }
}
