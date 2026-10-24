import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'CivicChai offline mode',
  description: 'Information about saved drafts and offline access in CivicChai.',
  path: '/offline',
  index: false,
  follow: true,
})

export default function OfflineLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
