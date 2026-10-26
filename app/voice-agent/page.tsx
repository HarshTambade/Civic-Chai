import type { Metadata } from 'next'
import { VoiceAgent } from '@/components/citizen/voice-agent'
import { VoiceCall } from '@/components/citizen/voice-call'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Call the CivicChai voice agent',
  description:
    'Call CivicChai’s AI voice agent in your browser: say the problem, confirm the place, hear it read back, and the report is filed by voice.',
  path: '/voice-agent',
  index: false,
  follow: true,
})

export default async function VoiceAgentPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams
  return mode === 'form' ? <VoiceAgent /> : <VoiceCall />
}
