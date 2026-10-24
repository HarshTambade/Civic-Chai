import type { Metadata } from 'next'
import { getIssueById } from '@/lib/issues'
import { toPublicIssue } from '@/lib/privacy'
import { pageMetadata } from '@/lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const issue = await getIssueById(id).catch(() => null)

  if (!issue) {
    return pageMetadata({
      title: 'Public civic issue report',
      description: 'View a public civic issue report and its latest status information on CivicChai.',
      path: `/issues/${encodeURIComponent(id)}`,
      index: false,
      follow: true,
    })
  }

  const publicIssue = toPublicIssue(issue)
  const canonicalId = encodeURIComponent(publicIssue.documentId)

  return pageMetadata({
    title: `Civic issue report: ${publicIssue.title.slice(0, 34)}`,
    description: `Follow public updates for this ${publicIssue.category.toLowerCase()} report in ${publicIssue.locality}. CivicChai is a community platform, not an official grievance channel.`,
    path: `/issues/${canonicalId}`,
    keywords: [publicIssue.category, publicIssue.locality, 'public issue status'],
    index: false,
    follow: true,
  })
}

export default function IssueLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
