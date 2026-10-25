import { NextResponse } from 'next/server'
import { MIGRATION_HELP, isSchemaError, publicErrorMessage } from '@/lib/api-errors'
import { getIssueById } from '@/lib/issues'
import { toPublicIssue } from '@/lib/privacy'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const issue = await getIssueById(id)
    if (!issue) return NextResponse.json({ error: 'Public issue not found.' }, { status: 404 })
    return NextResponse.json({ issue: toPublicIssue(issue) }, { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' } })
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error, 'The public report is unavailable right now.') }, { status: 503 })
  }
}
