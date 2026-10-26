import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Civic knowledge and official documents',
  description: 'Verified local offices, officers, service standards and official documents for your PIN code.',
  path: '/knowledge',
})

export default function KnowledgeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
