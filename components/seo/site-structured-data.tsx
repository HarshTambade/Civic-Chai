import { absoluteSiteUrl } from '@/lib/seo'

const siteUrl = absoluteSiteUrl('/')
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}#website`,
      url: siteUrl,
      name: 'CivicChai',
      description:
        'A community civic platform for reporting local issues and following public progress in India.',
      inLanguage: 'en-IN',
    },
    {
      '@type': 'WebApplication',
      '@id': `${siteUrl}#application`,
      name: 'CivicChai',
      url: siteUrl,
      description:
        'Report neighborhood civic issues, discuss local needs, and follow public issue updates with your community.',
      applicationCategory: 'SocialNetworkingApplication',
      operatingSystem: 'Web',
      image: absoluteSiteUrl('/icon-512.png'),
      inLanguage: 'en-IN',
    },
  ],
}

export function SiteStructuredData() {
  const safeStructuredData = JSON.stringify(structuredData).replace(/</g, '\\u003c')

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeStructuredData }}
    />
  )
}
