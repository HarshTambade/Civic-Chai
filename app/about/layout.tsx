import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'About CivicChai and community civic action',
  description:
    'Learn how CivicChai brings residents together to report neighborhood issues, share community context, and follow documented civic responses.',
  path: '/about',
  keywords: ['about CivicChai', 'civic participation', 'community problem solving'],
})

export default function AboutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
