import type { MetadataRoute } from 'next'
import { absoluteSiteUrl } from '@/lib/seo'

const PUBLIC_ROUTES = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/how-it-works', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/knowledge', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/community-guidelines', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/chai-tapri', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/citizen', priority: 0.7, changeFrequency: 'monthly' },
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: absoluteSiteUrl(path),
    changeFrequency,
    priority,
  }))
}
