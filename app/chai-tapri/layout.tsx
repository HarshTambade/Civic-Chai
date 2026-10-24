import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Explore local civic issues on Chai Tapri',
  description:
    'Browse community civic reports, see which local issues are gaining support, and join the discussion on CivicChai’s Chai Tapri.',
  path: '/chai-tapri',
  keywords: ['local civic issues', 'community reports', 'neighborhood updates'],
})

export default function ChaiTapriLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
