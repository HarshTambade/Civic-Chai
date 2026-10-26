import { NextResponse } from 'next/server'
import { MIGRATION_HELP, isSchemaError, publicErrorMessage } from '@/lib/api-errors'
import { analyzeComplaintWithGroq } from '@/lib/ai'
import { findDuplicateCandidates } from '@/lib/scoring'
import { getIssues } from '@/lib/issues'
import { consumeRateLimit } from '@/lib/rate-limit'
import { directoryArea } from '@/lib/geo'
import { assessJurisdiction } from '@/lib/jurisdiction'

export async function POST(request: Request) {
  try {
    const rateLimit = await consumeRateLimit(request, 'ai-analysis', 30, 60)
    if (rateLimit === null) return NextResponse.json({ error: 'Request protection is temporarily unavailable. Please try again shortly.' }, { status: 503 })
    if (!rateLimit) return NextResponse.json({ error: 'Too many analysis requests. Please wait a moment.' }, { status: 429 })
    const body = await request.json()
    const text = String(body?.text ?? '').trim()
    const language = String(body?.language ?? 'Auto Detect')
    const pin = String(body?.pin ?? '')
    const locality = String(body?.locality ?? '')
    const hasEvidence = Boolean(body?.hasEvidence)
    const onlineConsent = Boolean(body?.onlineConsent)

    if (!text) {
      return NextResponse.json({ error: 'Text is required.' }, { status: 400 })
    }

    const [result, area] = await Promise.all([
      onlineConsent
        ? analyzeComplaintWithGroq(text, language, { pin, locality, hasEvidence })
        : import('@/lib/ai').then(({ analyzeComplaint }) => analyzeComplaint(text, language, { pin, locality, hasEvidence })),
      directoryArea(pin, locality).catch(() => null),
    ])
    const candidates = findDuplicateCandidates({ text, pin: result.pin, locality: result.locality, department: result.department, category: result.category, hasEvidence }, await getIssues())
    // SOP bands: 0.90+ strong suggestion, 0.75-0.89 related suggestion, below 0.75 treated as distinct.
    const suggested = candidates.filter((candidate) => candidate.similarity >= 0.75)
    const strong = suggested[0]
    return NextResponse.json({
      ...result,
      area,
      jurisdiction: assessJurisdiction({ text, category: result.category, localBodyType: area?.localBodyType }),
      duplicateCandidates: suggested,
      duplicateIssueFound: Boolean(strong),
      duplicateIssue: strong ? { ...strong.issue, similarity: strong.similarity, band: strong.band } : undefined,
      duplicateIssueId: strong?.issue.id,
    })
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error, 'Unable to analyze complaint.') }, { status: 500 })
  }
}
