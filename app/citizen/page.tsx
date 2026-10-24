import type { Metadata } from 'next'
import { CitizenApp } from '@/components/citizen/citizen-app'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Report and follow local civic issues',
  description:
    'Open CivicChai’s citizen portal to find local reports, share a neighborhood issue, and follow community and authority updates.',
  path: '/citizen',
  keywords: ['citizen civic portal', 'report neighborhood problem', 'local issue updates'],
})

export default function CitizenPage() {
  return <CitizenApp />
}
