import type { Metadata } from 'next'
import { VoiceAgent } from '@/components/citizen/voice-agent'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Voice-assisted civic issue filing',
  description:
    'Use CivicChai’s browser voice assistant to prepare a civic issue report, review the transcript, and submit it when ready.',
  path: '/voice-agent',
  index: false,
  follow: true,
})

export default function VoiceAgentPage() {
  return <VoiceAgent />
}
