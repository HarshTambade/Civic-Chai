'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SiteNav } from '@/components/landing/site-nav'
import { SiteFooter } from '@/components/landing/site-footer'
import { analyzeComplaintRequest } from '@/lib/ai'
import { submitIssuePayload } from '@/lib/client-api'
import { useAuth } from '@/components/auth-provider'
import { useServiceArea } from '@/components/citizen/use-service-area'
import { saveOfflineDraft } from '@/lib/offline-queue'
import type { IssueRecord } from '@/lib/types'
import { Check, Mic, Phone, Volume2 } from 'lucide-react'

type Recognition = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: ((event: any) => void) | null; onerror: (() => void) | null; onend: (() => void) | null }

function speechRecognition() {
  const target = window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  const Constructor = target.SpeechRecognition ?? target.webkitSpeechRecognition
  return Constructor ? new Constructor() : null
}

export function VoiceAgent() {
  const { user, isHydrated } = useAuth()
  const area = useServiceArea()
  const [language, setLanguage] = useState('English')
  const [problem, setProblem] = useState('')
  const [pin, setPin] = useState('')
  const [locality, setLocality] = useState('')
  const [duration, setDuration] = useState('')
  const [proof, setProof] = useState('2')
  const [voiceConsent, setVoiceConsent] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [issue, setIssue] = useState<IssueRecord | null>(null)

  useEffect(() => {
    if (!area.loaded) return
    setPin((current) => current || area.pin)
    setLocality((current) => current || area.locality)
  }, [area.loaded, area.pin, area.locality])

  function readSummary() {
    const summary = `${problem}. PIN ${pin}. ${locality}. Reported for ${duration || 'an unspecified duration'}. Evidence ${proof === '1' ? 'is available' : 'is not available'}.`
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(summary))
    }
    return summary
  }

  function startSpeech() {
    if (!voiceConsent) {
      setMessage('Please read and accept the browser voice processing notice before recording.')
      return
    }
    const recognition = speechRecognition()
    if (!recognition) {
      setMessage('Speech recognition is unavailable here. Type your complaint or use the PIN keypad below.')
      return
    }
    recognition.lang = language === 'हिन्दी' ? 'hi-IN' : language === 'मराठी' ? 'mr-IN' : 'en-IN'
    recognition.interimResults = false
    recognition.onresult = (event) => setProblem((current) => `${current} ${event.results?.[0]?.[0]?.transcript ?? ''}`.trim())
    recognition.onerror = () => { setListening(false); setMessage('Voice recognition stopped. You can correct the transcript or type instead.') }
    recognition.onend = () => setListening(false)
    setMessage('Listening. Speak clearly, then review and correct the transcript.')
    setListening(true)
    recognition.start()
  }

  function addDigit(digit: string) {
    setPin((current) => `${current}${digit}`.slice(-6))
  }

  async function submit() {
    if (!confirmed) { setMessage('Read back and confirm the complaint summary before filing.'); return }
    if (problem.trim().length < 8 || !/^\d{6}$/.test(pin) || !locality.trim()) { setMessage('Enter the problem, a six-digit PIN and a locality first.'); return }
    if (!user) { setMessage('Sign in before filing so you can track the report and confirm when it is fixed.'); return }
    setBusy(true)
    setMessage('')
    try {
      const analysis = await analyzeComplaintRequest(`${problem} ${duration}`.trim(), language, { pin, locality })
      const payload = {
        title: `${analysis.issue} — ${locality.trim()}`.slice(0, 140),
        description: problem.trim(),
        original_text: problem.trim(),
        normalized_text: analysis.summary,
        category: analysis.category,
        department: analysis.department,
        pin,
        locality,
        source_channel: 'voice' as const,
        language: analysis.language,
        ai_confidence: analysis.confidence,
        severity: analysis.severity,
        consent: { browser_speech: voiceConsent, caller_confirmed: true, raw_audio_retained: false },
      }
      if (!navigator.onLine) {
        if (!area.consent.offline_storage) { setMessage('You are offline. Allow on-device draft storage in Profile, or reconnect to submit.'); return }
        await saveOfflineDraft(payload)
        setMessage('Saved locally as a pending draft. It is not submitted until you reconnect and sync it.')
        return
      }
      const data = await submitIssuePayload(payload)
      setIssue(data)
      setMessage(`Report ${data.documentId} is filed. The issue is routed to ${data.department}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The issue could not be submitted.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-dvh bg-background text-charcoal">
      <SiteNav />
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">Voice-first filing · keypad fallback</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">Tell CivicChai what happened</h1>
          <p className="mt-2 text-sm leading-relaxed text-charcoal/65">This accessible browser workflow supports speech and touch-tone style entry. The final report is read back and requires your confirmation before submission.</p>

          <label className="mt-5 flex items-start gap-2 rounded-xl border border-gold/50 bg-gold/10 p-3 text-xs leading-relaxed text-charcoal/70">
            <input type="checkbox" checked={voiceConsent} onChange={(event) => setVoiceConsent(event.target.checked)} className="mt-0.5 accent-chai" />
            <span>I understand my browser may process audio to produce a transcript. CivicChai does not upload or retain the raw audio in this browser workflow. I can correct the transcript before filing.</span>
          </label>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="text-sm font-semibold">Complaint description
              <textarea value={problem} onChange={(event) => setProblem(event.target.value)} rows={4} maxLength={5000} placeholder="Describe the civic problem. You can type or dictate." className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm font-normal outline-none focus:border-terracotta" />
            </label>
            <button type="button" onClick={startSpeech} disabled={listening} className="inline-flex h-fit items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-cream disabled:opacity-60"><Mic className="h-4 w-4" />{listening ? 'Listening…' : 'Speak'}</button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Language
              <select value={language} onChange={(event) => setLanguage(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal">
                <option>English</option><option>हिन्दी</option><option>मराठी</option>
              </select>
            </label>
            <label className="text-sm font-semibold">PIN code
              <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="text-sm font-semibold">Locality / ward
              <input value={locality} onChange={(event) => setLocality(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="text-sm font-semibold">How long has this been happening?
              <input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="For example, 15 days" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal" />
            </label>
          </div>

          <fieldset className="mt-5 rounded-xl border border-border p-4"><legend className="px-1 text-sm font-semibold">Do you have proof to share?</legend><div className="flex gap-3"><button type="button" onClick={() => setProof('1')} aria-pressed={proof === '1'} className={`rounded-lg border px-4 py-2 text-sm ${proof === '1' ? 'border-chai bg-chai text-cream' : 'border-border'}`}>1 · Yes</button><button type="button" onClick={() => setProof('2')} aria-pressed={proof === '2'} className={`rounded-lg border px-4 py-2 text-sm ${proof === '2' ? 'border-chai bg-chai text-cream' : 'border-border'}`}>2 · No</button></div></fieldset>

          <div className="mt-5 rounded-xl bg-secondary/50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Read back before filing</p><p className="mt-2 text-sm leading-relaxed">{problem.trim() ? `${problem.trim()}. PIN ${pin}. ${locality}. ${duration || 'Duration not provided'}.` : 'Your complaint summary will appear here.'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { readSummary(); setConfirmed(false) }} disabled={!problem.trim()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold"><Volume2 className="h-4 w-4" />Read it aloud</button><button type="button" onClick={() => { setConfirmed(true); setMessage('Summary confirmed. File the report when ready.') }} disabled={!problem.trim()} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-3 py-2 text-xs font-semibold text-cream"><Check className="h-4 w-4" />Confirm summary</button></div></div>

          {message && <p role="status" className="mt-4 rounded-lg bg-muted p-3 text-sm">{message}</p>}
          {issue && <Link href={`/citizen`} className="mt-3 inline-flex text-sm font-semibold text-chai underline">Open My Charcha to track {issue.documentId}</Link>}

          {isHydrated && !user && <p className="mt-4 rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm text-charcoal/75"><Link href="/login?next=/voice-agent" className="font-semibold text-chai underline">Sign in</Link> to file this report so you can track it and confirm when it is fixed.</p>}

          <button onClick={submit} disabled={busy || !confirmed} className="mt-5 w-full rounded-xl bg-chai px-4 py-3 text-sm font-semibold text-cream disabled:opacity-50">{busy ? 'Submitting…' : 'Confirm and submit report'}</button>

          <p className="mt-4 flex items-center gap-2 text-xs leading-relaxed text-charcoal/50"><Phone className="h-4 w-4 shrink-0" />A live phone hotline requires an authority assigned number and a configured telephony provider. This browser flow is ready for the same verified intake and confirmation steps.</p>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
