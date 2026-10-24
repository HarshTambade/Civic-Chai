import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Authority control room',
  description: 'A private CivicChai workspace for authorized civic operations staff.',
  path: '/control-room',
  index: false,
  follow: false,
})

export default function ControlRoomLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
