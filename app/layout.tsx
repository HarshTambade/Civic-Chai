import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { PwaRegister } from '@/components/pwa-register'
import { AuthProvider } from '@/components/auth-provider'
import { StreeChat } from '@/components/stree-chat'
import { LanguageProvider } from '@/components/language-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'CivicChai — India mein har ek Charcha Chai Pe hoti hai',
  description:
    'CivicChai turns everyday civic problems into community discussions. Report karo, charcha karo, vote karo — aur dekho tumhari awaaz kahan tak pahunchti hai.',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'CivicChai',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor: '#6b3f24',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased">
        <LanguageProvider>
          <AuthProvider>
            <PwaRegister />
            {children}
            <StreeChat />
          </AuthProvider>
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </LanguageProvider>
      </body>
    </html>
  )
}
