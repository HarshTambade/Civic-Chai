import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { PwaRegister } from '@/components/pwa-register'
import { AuthProvider } from '@/components/auth-provider'
import { StreeChat } from '@/components/stree-chat'
import { LanguageProvider } from '@/components/language-provider'
import { SITE_URL } from '@/lib/seo'
import 'leaflet/dist/leaflet.css'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: 'CivicChai | Community civic issue reporting in India',
    template: '%s | CivicChai',
  },
  description:
    'CivicChai helps communities report local civic issues, discuss neighborhood needs, and follow public progress in one place.',
  applicationName: 'CivicChai',
  keywords: [
    'civic engagement',
    'neighborhood issues',
    'community action',
    'municipal services',
    'civic technology India',
  ],
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'CivicChai',
    title: 'CivicChai | Community civic issue reporting in India',
    description:
      'Report local civic issues, discuss neighborhood needs, and follow public progress with your community.',
    url: '/',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'CivicChai community civic platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CivicChai | Community civic issue reporting in India',
    description:
      'Report local civic issues, discuss neighborhood needs, and follow public progress with your community.',
    images: ['/opengraph-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
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
