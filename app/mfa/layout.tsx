import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Staff account verification',
  description: 'Complete staff multi-factor authentication for CivicChai.',
  path: '/mfa',
  index: false,
  follow: false,
})

export default function MfaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
