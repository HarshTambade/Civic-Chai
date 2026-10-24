import type { Metadata } from 'next'
import { SiteNav } from '@/components/landing/site-nav'
import { Hero } from '@/components/landing/hero'
import { WhatIs, HowItWorks, Channels, GovPreview, FinalCTA } from '@/components/landing/sections'
import { LocalChai, ChaiTapri } from '@/components/landing/trending'
import { AIShowcase } from '@/components/landing/ai-showcase'
import { ReportPreview } from '@/components/landing/report-preview'
import { SiteFooter } from '@/components/landing/site-footer'
import { SiteStructuredData } from '@/components/seo/site-structured-data'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Community civic issue reporting in India',
  description:
    'Report neighborhood problems, join local discussions, and follow civic response updates with CivicChai, a community-powered civic platform for India.',
  path: '/',
  keywords: ['report civic issues online', 'local government response', 'community problem solving'],
})

export default function LandingPage() {
  return (
    <>
      <SiteStructuredData />
      <main className="min-h-dvh bg-background">
        <SiteNav />
        <Hero />
        <WhatIs />
        <HowItWorks />
        <LocalChai />
        <ChaiTapri />
        <AIShowcase />
        <ReportPreview />
        <Channels />
        <GovPreview />
        <FinalCTA />
        <SiteFooter />
      </main>
    </>
  )
}
