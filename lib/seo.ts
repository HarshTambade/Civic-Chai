import type { Metadata } from 'next'

function getSiteUrl() {
  const configuredUrl = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL,
  ].find((value) => value?.trim()) ?? 'http://localhost:3000'
  const urlWithProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(configuredUrl)
    ? configuredUrl
    : `https://${configuredUrl}`

  return new URL(new URL(urlWithProtocol).origin)
}

export const SITE_URL = getSiteUrl()

const DEFAULT_IMAGE = {
  url: '/opengraph-image.png',
  width: 1200,
  height: 630,
  alt: 'CivicChai, a community civic issue reporting platform',
}

const DEFAULT_KEYWORDS = [
  'civic issue reporting',
  'community reporting',
  'local civic problems',
  'public issue tracking',
  'India',
]

export function pageMetadata({
  title,
  description,
  path,
  keywords = [],
  index = true,
  follow = true,
}: {
  title: string
  description: string
  path: string
  keywords?: string[]
  index?: boolean
  follow?: boolean
}): Metadata {
  const robots: NonNullable<Metadata['robots']> = index
    ? {
        index: true,
        follow,
        googleBot: {
          index: true,
          follow,
          'max-image-preview': 'large',
          'max-snippet': -1,
          'max-video-preview': -1,
        },
      }
    : { index: false, follow }

  return {
    title,
    description,
    keywords: [...DEFAULT_KEYWORDS, ...keywords],
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: 'en_IN',
      siteName: 'CivicChai',
      title,
      description,
      url: path,
      images: [DEFAULT_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_IMAGE.url],
    },
    robots,
  }
}

export function absoluteSiteUrl(path: string) {
  return new URL(path, SITE_URL).toString()
}
