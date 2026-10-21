import { NextResponse } from 'next/server'
import { analyzeComplaintWithGroq } from '@/lib/ai'
import { findDuplicateCandidates } from '@/lib/scoring'
import { getIssues } from '@/lib/issues'
import { consumeRateLimit } from '@/lib/rate-limit'

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

    const result = onlineConsent
      ? await analyzeComplaintWithGroq(text, language, { pin, locality, hasEvidence })
      : (await import('@/lib/ai')).analyzeComplaint(text, language, { pin, locality, hasEvidence })
    const candidates = findDuplicateCandidates({ text, pin: result.pin, locality: result.locality, department: result.department, category: result.category, hasEvidence }, await getIssues())
    const strong = candidates.find((candidate) => candidate.similarity >= 0.75)
    return NextResponse.json({
      ...result,
      duplicateCandidates: candidates,
      duplicateIssueFound: Boolean(strong),
      duplicateIssue: strong ? { ...strong.issue, similarity: strong.similarity, band: strong.band } : undefined,
      duplicateIssueId: strong?.issue.id,
    })
  } catch (error) {
    console.error('AI analyze route error:', error)
    return NextResponse.json({ error: 'Unable to analyze complaint.' }, { status: 500 })
  }
}
