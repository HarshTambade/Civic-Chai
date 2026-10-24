import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'How CivicChai issue reporting works',
  description:
    'See how a local report moves from community discussion and duplicate checks to scoped review, public status updates, and resolution follow-up.',
  path: '/how-it-works',
  keywords: ['how civic issue reporting works', 'issue tracking', 'public service requests'],
})

export default function HowItWorksLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
