import { NextResponse } from 'next/server'
import { getRequestContext } from '@/lib/api-auth'
import { consumeRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Optional natural female voices for the call agent. Many phones and laptops have no Hindi
// or Marathi voice, so a pilot can configure Azure AI Speech to guarantee one.
const VOICES: Record<string, { lang: string; voice: string }> = {
  en: { lang: 'en-IN', voice: 'en-IN-NeerjaNeural' },
  hi: { lang: 'hi-IN', voice: 'hi-IN-SwaraNeural' },
  mr: { lang: 'mr-IN', voice: 'mr-IN-AarohiNeural' },
}

function config() {
  const key = process.env.AZURE_SPEECH_KEY?.trim()
  const region = process.env.AZURE_SPEECH_REGION?.trim()
  return key && region && /^[a-z0-9-]+$/i.test(region) ? { key, region } : null
}

function xmlEscape(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!)
}

export async function GET() {
  return NextResponse.json({ enabled: Boolean(config()) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const azure = config()
  if (!azure) return NextResponse.json({ error: 'Cloud voice is not configured.' }, { status: 404 })
  const { authenticated } = await getRequestContext(request)
  if (!authenticated) return NextResponse.json({ error: 'Sign in to use the call agent.' }, { status: 401 })
  const rateLimit = await consumeRateLimit(request, 'voice-tts', 90, 600)
  if (rateLimit === null) return NextResponse.json({ error: 'Request protection is temporarily unavailable.' }, { status: 503 })
  if (!rateLimit) return NextResponse.json({ error: 'Too many voice requests. Please wait a moment.' }, { status: 429 })
  const body = await request.json().catch(() => ({}))
  const text = String(body?.text ?? '').trim().slice(0, 1500)
  const target = VOICES[String(body?.language ?? 'en')] ?? VOICES.en
  if (!text) return NextResponse.json({ error: 'Text is required.' }, { status: 400 })
  try {
    const response = await fetch(`https://${azure.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azure.key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'CivicChai',
      },
      body: `<speak version="1.0" xml:lang="${target.lang}"><voice name="${target.voice}">${xmlEscape(text)}</voice></speak>`,
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return NextResponse.json({ error: 'The cloud voice did not respond.' }, { status: 502 })
    return new NextResponse(await response.arrayBuffer(), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'The cloud voice did not respond.' }, { status: 502 })
  }
}
