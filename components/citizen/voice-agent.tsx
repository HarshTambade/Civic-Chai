'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { SiteNav } from '@/components/landing/site-nav'
import { SiteFooter } from '@/components/landing/site-footer'
import { analyzeComplaintRequest } from '@/lib/ai'
import { submitIssuePayload } from '@/lib/client-api'
import { useAuth } from '@/components/auth-provider'
import { useServiceArea } from '@/components/citizen/use-service-area'
import { SPEECH_UNSUPPORTED_MESSAGE, getSpeechRecognition, joinTranscript, speechErrorMessage, speechLanguage, transcriptFromResults, type SpeechRecognitionLike } from '@/components/citizen/speech'
import { useLiveLocation } from '@/components/citizen/use-location'
import { saveOfflineDraft } from '@/lib/offline-queue'
import { haptic } from '@/components/haptics'
import type { IssueRecord } from '@/lib/types'
import { Check, Delete, MapPin, Mic, Phone, Square, Volume2 } from 'lucide-react'

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

export function VoiceAgent() {
  const { user, isHydrated } = useAuth()
  const area = useServiceArea()
  const [language, setLanguage] = useState('English')
  const [problem, setProblem] = useState('')
  const [interim, setInterim] = useState('')
  const [pin, setPin] = useState('')
  const [locality, setLocality] = useState('')
  const [duration, setDuration] = useState('')
  const [proof, setProof] = useState('2')
  const [voiceConsent, setVoiceConsent] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [speechMessage, setSpeechMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [issue, setIssue] = useState<IssueRecord | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const live = useLiveLocation()
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)

  async function fillFromLocation() {
    const result = await live.locate()
    if (!result) return
    setCoordinates({ latitude: result.latitude, longitude: result.longitude })
    if (result.place?.pin) setPin(result.place.pin)
    if (result.place?.locality) setLocality(result.place.locality)
  }

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()))
    return () => { try { recognitionRef.current?.stop() } catch { /* already stopped */ } }
  }, [])

  useEffect(() => {
    if (!area.loaded) return
    setPin((current) => current || area.pin)
    setLocality((current) => current || area.locality)
  }, [area.loaded, area.pin, area.locality])

  // Any change after confirmation must be read back and confirmed again.
  useEffect(() => { setConfirmed(false) }, [problem, pin, locality, duration, proof])

  const summary = `${problem.trim()}. PIN ${pin || 'not entered'}. ${locality || 'Locality not entered'}. ${duration ? `Happening for ${duration}` : 'Duration not provided'}. Proof ${proof === '1' ? 'is available' : 'is not available'}.`

  function readSummary() {
    if (!('speechSynthesis' in window)) {
      setMessage('Read-aloud is not available in this browser. Please read the summary on screen.')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(summary)
    utterance.lang = speechLanguage(language)
    window.speechSynthesis.speak(utterance)
  }

  function stopSpeech() {
    try { recognitionRef.current?.stop() } catch { /* already stopped */ }
    setListening(false)
  }

  function startSpeech() {
    setSpeechMessage('')
    const Recognition = getSpeechRecognition()
    if (!Recognition) { setSpeechMessage(SPEECH_UNSUPPORTED_MESSAGE); return }
    const recognition = new Recognition()
    recognition.lang = speechLanguage(language)
    recognition.interimResults = true
    recognition.continuous = true
    recognition.onstart = () => { setListening(true); setSpeechMessage('Listening… speak clearly, then tap Stop.') }
    // The whole session is rebuilt from all results each time, so nothing is written twice.
    const before = problem
    recognition.onresult = (event) => {
      const { finalText, interim: partial } = transcriptFromResults(event.results)
      if (finalText) setProblem(joinTranscript(before, finalText))
      setInterim(partial)
    }
    recognition.onerror = (event) => {
      setListening(false)
      setInterim('')
      const text = speechErrorMessage(event.error)
      if (text) setSpeechMessage(text)
    }
    recognition.onend = () => {
      setListening(false)
      setInterim('')
      setSpeechMessage((current) => current.startsWith('Listening') ? 'Recording stopped. Review and correct the transcript below.' : current)
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setListening(false)
      setSpeechMessage('Voice input could not start. Wait a moment and tap Speak again.')
    }
  }

  function addDigit(digit: string) {
    setPin((current) => `${current}${digit}`.slice(0, 6))
  }

  async function submit() {
    if (!confirmed) { setMessage('Read back and confirm the complaint summary before filing.'); return }
    if (problem.trim().length < 8 || !/^\d{6}$/.test(pin) || !locality.trim()) { setMessage('Enter the problem (at least a short sentence), a six-digit PIN and a locality first.'); return }
    if (!user) { setMessage('Sign in before filing so you can track the report and confirm when it is fixed.'); return }
    setBusy(true)
    setMessage('')
    try {
      const analysis = await analyzeComplaintRequest(`${problem} ${duration}`.trim(), language, { pin, locality })
      const payload = {
        title: `${analysis.issue} — ${locality.trim()}`.slice(0, 140),
        description: `${problem.trim()}${duration ? ` (for ${duration})` : ''}${proof === '1' ? ' Proof is available on request.' : ''}`,
        original_text: problem.trim(),
        normalized_text: analysis.summary,
        category: analysis.category,
        department: analysis.department,
        pin,
        locality: locality.trim(),
        source_channel: 'voice' as const,
        language: analysis.language,
        ai_confidence: analysis.confidence,
        severity: analysis.severity,
        location_lat: coordinates?.latitude,
        location_lng: coordinates?.longitude,
        consent: { browser_speech: voiceConsent, caller_confirmed: true, raw_audio_retained: false, device_location: Boolean(coordinates) },
      }
      if (!navigator.onLine) {
        if (!area.consent.offline_storage) { setMessage('You are offline. Allow on-device draft storage in Profile, or reconnect to submit.'); return }
        await saveOfflineDraft(payload)
        setMessage('Saved locally as a pending draft. It is not submitted until you reconnect and sync it.')
        return
      }
      const data = await submitIssuePayload(payload)
      setIssue(data)
      haptic('success')
      setMessage(`Report ${data.documentId} is filed. The issue is routed to ${data.department}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The issue could not be submitted.')
    } finally {
      setBusy(false)
    }
  }

  const canSpeak = speechSupported && voiceConsent

  return (
    <main className="min-h-dvh bg-background text-charcoal">
      <SiteNav />
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">Voice-first filing · keypad fallback</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">Tell CivicChai what happened</h1>
          <p className="mt-2 text-sm leading-relaxed text-charcoal/65">Speak or type your complaint, enter the PIN with the keypad, then listen to the summary and confirm it before filing.</p>

          {isHydrated && !user && <p className="mt-4 rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm text-charcoal/75"><Link href="/login?next=/voice-agent" className="font-semibold text-chai underline">Sign in</Link> first so you can track this report and confirm when it is fixed.</p>}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Language
              <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={listening} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal">
                <option>English</option><option>हिन्दी</option><option>मराठी</option>
              </select>
            </label>
            <label className="flex items-start gap-2 self-end rounded-xl border border-gold/50 bg-gold/10 p-3 text-xs leading-relaxed text-charcoal/70">
              <input type="checkbox" checked={voiceConsent} onChange={(event) => { setVoiceConsent(event.target.checked); setSpeechMessage('') }} className="mt-0.5 accent-chai" />
              <span>I agree that my browser may convert my speech to text. CivicChai does not upload or keep the audio.</span>
            </label>
          </div>

          <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-terracotta/50 bg-terracotta/5 p-5 text-center">
            {listening
              ? <button type="button" onClick={stopSpeech} className="inline-flex items-center gap-2 rounded-full bg-heat px-6 py-3 text-sm font-semibold text-cream"><Square className="h-4 w-4" />Stop</button>
              : <button type="button" onClick={startSpeech} disabled={!canSpeak} className="inline-flex items-center gap-2 rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream disabled:opacity-50"><Mic className="h-4 w-4" />Speak</button>}
            <p role="status" aria-live="polite" className="text-xs text-charcoal/65">
              {!speechSupported ? SPEECH_UNSUPPORTED_MESSAGE : !voiceConsent ? 'Tick the agreement above to enable the microphone, or just type below.' : speechMessage || 'Tap Speak and describe the problem in your own words.'}
            </p>
            {interim && <p className="text-sm italic text-charcoal/55">{interim}</p>}
          </div>

          <label className="mt-4 block text-sm font-semibold">Complaint description (you can edit the transcript)
            <textarea value={problem} onChange={(event) => setProblem(event.target.value)} rows={4} maxLength={5000} placeholder="Describe the civic problem. You can type or dictate." className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm font-normal outline-none focus:border-terracotta" />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold">PIN code
                <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em]" />
              </label>
              <div className="mt-2 grid grid-cols-5 gap-1.5" role="group" aria-label="PIN keypad">
                {KEYPAD.map((digit) => <button key={digit} type="button" onClick={() => addDigit(digit)} className="rounded-lg border border-border bg-background py-2 font-mono text-sm font-semibold hover:border-chai">{digit}</button>)}
                <button type="button" onClick={() => setPin((current) => current.slice(0, -1))} aria-label="Delete last digit" className="col-span-5 flex items-center justify-center gap-1 rounded-lg border border-border bg-background py-1.5 text-xs text-charcoal/65"><Delete className="h-3.5 w-3.5" />Delete</button>
              </div>
            </div>
            <div className="space-y-3">
              <button type="button" onClick={() => void fillFromLocation()} disabled={live.status === 'locating'} className="flex w-full items-center justify-center gap-2 rounded-xl border border-chai/30 bg-chai/5 px-3 py-2.5 text-sm font-semibold text-chai disabled:opacity-60"><MapPin className="h-4 w-4" />{live.status === 'locating' ? 'Finding your location…' : coordinates ? 'Location attached · update' : 'Use my current location'}</button>
              {live.error && <p role="alert" className="text-xs text-heat">{live.error}</p>}
              <label className="block text-sm font-semibold">Locality / ward
                <input value={locality} onChange={(event) => setLocality(event.target.value.slice(0, 120))} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal" />
              </label>
              <label className="block text-sm font-semibold">How long has this been happening?
                <input value={duration} onChange={(event) => setDuration(event.target.value.slice(0, 60))} placeholder="For example, 15 days" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal" />
              </label>
            </div>
          </div>

          <fieldset className="mt-5 rounded-xl border border-border p-4"><legend className="px-1 text-sm font-semibold">Do you have proof to share later?</legend><div className="flex gap-3"><button type="button" onClick={() => setProof('1')} aria-pressed={proof === '1'} className={`rounded-lg border px-4 py-2 text-sm ${proof === '1' ? 'border-chai bg-chai text-cream' : 'border-border'}`}>1 · Yes</button><button type="button" onClick={() => setProof('2')} aria-pressed={proof === '2'} className={`rounded-lg border px-4 py-2 text-sm ${proof === '2' ? 'border-chai bg-chai text-cream' : 'border-border'}`}>2 · No</button></div></fieldset>

          <div className="mt-5 rounded-xl bg-secondary/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Read back before filing</p>
            <p className="mt-2 text-sm leading-relaxed">{problem.trim() ? summary : 'Your complaint summary will appear here.'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={readSummary} disabled={!problem.trim()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold disabled:opacity-50"><Volume2 className="h-4 w-4" />Read it aloud</button>
              <button type="button" onClick={() => { setConfirmed(true); setMessage('') }} disabled={!problem.trim() || confirmed} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-3 py-2 text-xs font-semibold text-cream disabled:opacity-60"><Check className="h-4 w-4" />{confirmed ? 'Summary confirmed' : 'Yes, this is correct'}</button>
            </div>
          </div>

          {message && <p role="status" className="mt-4 rounded-lg bg-muted p-3 text-sm">{message}</p>}
          {issue && <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold"><Link href={`/issues/${encodeURIComponent(issue.id)}`} className="text-chai underline">Open report {issue.documentId}</Link><Link href="/citizen" className="text-chai underline">Track it in My Charcha</Link></div>}

          <button onClick={submit} disabled={busy || !confirmed || Boolean(issue)} className="mt-5 w-full rounded-xl bg-chai px-4 py-3 text-sm font-semibold text-cream disabled:opacity-50">{busy ? 'Submitting…' : issue ? 'Report filed' : 'Confirm and submit report'}</button>
          {!confirmed && problem.trim() && !issue && <p className="mt-2 text-center text-xs text-charcoal/55">Confirm the summary above to enable submission.</p>}

          <p className="mt-4 flex items-center gap-2 text-xs leading-relaxed text-charcoal/50"><Phone className="h-4 w-4 shrink-0" />A live phone hotline requires an authority-assigned number and a configured telephony provider. This browser flow uses the same intake and confirmation steps.</p>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
