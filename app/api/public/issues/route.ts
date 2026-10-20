import { NextResponse } from 'next/server'
import { getIssues } from '@/lib/issues'
import { toPublicIssue } from '@/lib/privacy'

// This route is deliberately independent of the signed-in admin feed. The
// service worker may cache it because it contains only published, redacted data.
export async function GET(request: Request) {
  try {
    const pin = new URL(request.url).searchParams.get('pin') ?? ''
    if (pin && !/^\d{6}$/.test(pin)) return NextResponse.json({ error: 'PIN must contain six digits.' }, { status: 400 })
    const issues = await getIssues()
    const publicIssues = issues.filter((issue) => !pin || issue.pin === pin).map(toPublicIssue)
    return NextResponse.json({ issues: publicIssues }, {
      headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' },
    })
  } catch {
    return NextResponse.json({ error: 'The public issue feed is unavailable until the Supabase schema is ready.' }, { status: 503 })
  }
}
