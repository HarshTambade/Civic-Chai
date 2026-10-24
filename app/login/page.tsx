import type { Metadata } from 'next'
import { LoginPage } from '@/components/auth/login-page'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Sign in',
  description: 'Sign in to your CivicChai account.',
  path: '/login',
  index: false,
  follow: false,
})

export default function LoginRoute() {
  return <LoginPage />
}
