import type { Metadata } from 'next'
import { LoginPage } from '@/components/auth/login-page'

export const metadata: Metadata = {
  title: 'Sign in — CivicChai',
  robots: { index: false, follow: false },
}

export default function LoginRoute() {
  return <LoginPage />
}
