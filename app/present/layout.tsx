import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'CivicChai pitch deck',
  description: 'The CivicChai idea, product, scenarios, research and pilot plan in one presentation.',
  path: '/present',
})

export default function PresentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
