import type { Metadata } from 'next'
import { VoiceAgent } from '@/components/citizen/voice-agent'

export const metadata: Metadata = { title: 'Voice Filing — CivicChai' }

export default function VoiceAgentPage() {
  return <VoiceAgent />
}
