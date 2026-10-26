'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { SiteNav } from '@/components/landing/site-nav'
import { SiteFooter } from '@/components/landing/site-footer'
import { useAuth } from '@/components/auth-provider'
import { useServiceArea } from '@/components/citizen/use-service-area'
import { locationAlreadyAllowed, useLiveLocation } from '@/components/citizen/use-location'
import { getSpeechRecognition, speakText, speechErrorMessage, speechLanguage, stopSpeaking, transcriptFromResults, warmUpVoices, type SpeechRecognitionLike } from '@/components/citizen/speech'
import { haptic } from '@/components/haptics'
import { analyzeComplaint, analyzeComplaintRequest, type ComplaintAnalysis } from '@/lib/ai'
import { submitIssuePayload } from '@/lib/client-api'
import { saveOfflineDraft } from '@/lib/offline-queue'
import {
  afterClassify, afterDraftSaved, afterFileFailed, afterFiled, awaitingCaller, currentQuestion, handleDigits, handleReply, handleSilence,
  startCall, withCoverage, withDetectedLocation, type CallLanguage, type CallSlots, type CallStage, type CallState, type CallTurn,
} from '@/lib/voice-call'
import type { IssueRecord } from '@/lib/types'
import { Check, Coffee, Grid3x3, MapPin, Mic, MicOff, Phone, PhoneOff, Send } from 'lucide-react'

type Phase = 'idle' | 'ringing' | 'connected' | 'ended'
type Activity = 'speaking' | 'listening' | 'thinking' | 'waiting'
type Line = { who: 'agent' | 'caller'; text: string }

const LANGUAGES: Array<{ code: CallLanguage; label: string; name: string }> = [
  { code: 'en', label: 'English', name: 'English' },
  { code: 'hi', label: 'हिन्दी', name: 'Hindi' },
  { code: 'mr', label: 'मराठी', name: 'Marathi' },
]

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']
const DTMF: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
}

const RING_SECONDS = 3.6
// After this many unanswered prompts in a row the agent stops opening the microphone on its own.
const MAX_AUTO_LISTEN_MISSES = 3

function tone(context: AudioContext | null, frequencies: number[], start: number, length: number, volume = 0.06) {
  if (!context) return
  const gain = context.createGain()
  gain.gain.setValueAtTime(volume, context.currentTime + start)
  gain.gain.setValueAtTime(0, context.currentTime + start + length)
  gain.connect(context.destination)
  for (const frequency of frequencies) {
    const oscillator = context.createOscillator()
    oscillator.frequency.value = frequency
    oscillator.connect(gain)
    oscillator.start(context.currentTime + start)
    oscillator.stop(context.currentTime + start + length + 0.05)
  }
}

/** Indian ringback: two 0.4 s bursts of 400 + 450 Hz, then a pause. */
function ringback(context: AudioContext | null) {
  for (const cycle of [0, 2]) {
    tone(context, [400, 450], cycle + 0.1, 0.4)
    tone(context, [400, 450], cycle + 0.7, 0.4)
  }
}

function clock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function VoiceCall() {
  const { user, isHydrated } = useAuth()
  const area = useServiceArea()
  const live = useLiveLocation()

  const [phase, setPhase] = useState<Phase>('idle')
  const [language, setLanguage] = useState<CallLanguage>('en')
  const [voiceConsent, setVoiceConsent] = useState(true)
  const [shareLocation, setShareLocation] = useState(false)
  const [cloudAi, setCloudAi] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)

  const [lines, setLines] = useState<Line[]>([])
  const [interim, setInterim] = useState('')
  const [activity, setActivity] = useState<Activity>('waiting')
  const [stage, setStage] = useState<CallStage>('problem')
  const [slots, setSlots] = useState<CallSlots | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)
  const [keypadOpen, setKeypadOpen] = useState(false)
  const [keyBuffer, setKeyBuffer] = useState('')
  const [typed, setTyped] = useState('')
  const [notice, setNotice] = useState('')
  const [issue, setIssue] = useState<IssueRecord | null>(null)
  const [pendingDraft, setPendingDraft] = useState(false)

  // Speech and timer callbacks outlive renders, so the live call lives in refs.
  const callRef = useRef<CallState | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const mutedRef = useRef(false)
  const turnRef = useRef(0)
  const sessionRef = useRef(0)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const analysisRef = useRef<ComplaintAnalysis | null>(null)
  const coordsRef = useRef<{ latitude: number; longitude: number } | null>(null)
  const coverageRef = useRef<Record<string, boolean | null>>({})
  const captionsRef = useRef<HTMLDivElement | null>(null)
  const optionsRef = useRef({ voiceConsent, cloudAi, offline: false })
  optionsRef.current = { voiceConsent, cloudAi, offline: area.consent.offline_storage }

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()))
    warmUpVoices()
    void locationAlreadyAllowed().then((allowed) => { if (allowed) setShareLocation(true) })
    return () => {
      phaseRef.current = 'ended'
      sessionRef.current += 1
      try { recognitionRef.current?.stop() } catch { /* already stopped */ }
      stopSpeaking()
      void audioRef.current?.close().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'connected') return
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => {
    captionsRef.current?.scrollTo({ top: captionsRef.current.scrollHeight, behavior: 'smooth' })
  }, [lines, interim])

  const speechTag = speechLanguage(LANGUAGES.find((item) => item.code === language)?.name ?? 'English')

  function addLine(line: Line) {
    setLines((current) => [...current, line])
  }

  function setCall(state: CallState) {
    callRef.current = state
    setStage(state.stage)
    setSlots(state.slots)
  }

  async function coverage(pin: string) {
    if (!/^\d{6}$/.test(pin)) return null
    if (pin in coverageRef.current) return coverageRef.current[pin]
    try {
      const response = await fetch(`/api/coverage?pin=${pin}`)
      const payload = response.ok ? await response.json() : null
      coverageRef.current[pin] = typeof payload?.covered === 'boolean' ? payload.covered : null
    } catch {
      coverageRef.current[pin] = null
    }
    return coverageRef.current[pin]
  }

  // ---- Listening --------------------------------------------------------------------

  function stopListening() {
    sessionRef.current += 1
    try { recognitionRef.current?.stop() } catch { /* already stopped */ }
    recognitionRef.current = null
    setInterim('')
  }

  function listen() {
    const call = callRef.current
    if (phaseRef.current !== 'connected' || !call || !awaitingCaller(call)) return
    const Recognition = getSpeechRecognition()
    if (mutedRef.current || !Recognition || !optionsRef.current.voiceConsent) { setActivity('waiting'); return }
    stopListening()
    setActivity('listening')
    const session = sessionRef.current
    const recognition = new Recognition()
    recognition.lang = speechLanguage(LANGUAGES.find((item) => item.code === call.language)?.name ?? 'English')
    recognition.interimResults = true
    recognition.continuous = false
    let heard = ''
    let failed = false
    recognition.onstart = () => { if (session === sessionRef.current) setActivity('listening') }
    recognition.onresult = (event) => {
      if (session !== sessionRef.current) return
      const { finalText, interim: partial } = transcriptFromResults(event.results)
      if (finalText) heard = finalText
      setInterim(partial || finalText)
    }
    recognition.onerror = (event) => {
      if (session !== sessionRef.current || event.error === 'no-speech' || event.error === 'aborted') return
      failed = true
      const message = speechErrorMessage(event.error)
      if (message) setNotice(message)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { mutedRef.current = true; setMuted(true) }
    }
    recognition.onend = () => {
      if (session !== sessionRef.current) return
      recognitionRef.current = null
      setInterim('')
      if (phaseRef.current !== 'connected') return
      if (heard.trim()) { void callerSaid(heard.trim()); return }
      if (failed) { setActivity('waiting'); return }
      const state = callRef.current
      if (state && state.misses < MAX_AUTO_LISTEN_MISSES) void applyTurn(handleSilence(state))
      else setActivity('waiting')
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setActivity('waiting')
    }
  }

  // ---- The conversation loop ---------------------------------------------------------

  async function agentSay(text: string, token: number) {
    addLine({ who: 'agent', text })
    setActivity('speaking')
    await speakText(text, speechLanguage(LANGUAGES.find((item) => item.code === callRef.current?.language)?.name ?? 'English'))
    return token === turnRef.current && phaseRef.current === 'connected'
  }

  async function applyTurn(turn: CallTurn): Promise<void> {
    if (phaseRef.current !== 'connected') return
    const token = ++turnRef.current
    let state = turn.state
    let say = turn.say
    // The read-back mentions when no authority team covers the PIN yet.
    if (state.stage === 'confirm' && state.slots.covered === undefined) {
      const covered = await coverage(state.slots.pin)
      const before = currentQuestion(state)
      state = withCoverage(state, state.slots.pin, covered)
      if (say === before) say = currentQuestion(state)
    } else if (state.slots.pin && state.slots.covered === undefined) {
      void coverage(state.slots.pin).then((covered) => {
        if (callRef.current) callRef.current = withCoverage(callRef.current, state.slots.pin, covered)
      })
    }
    setCall(state)
    if (say && !(await agentSay(say, token))) return
    if (token !== turnRef.current || phaseRef.current !== 'connected') return

    if (turn.action === 'classify') {
      setActivity('thinking')
      const name = LANGUAGES.find((item) => item.code === state.language)?.name ?? 'English'
      const analysis = await analyzeComplaintRequest(state.slots.problem, name, { pin: state.slots.pin, locality: state.slots.locality, onlineConsent: optionsRef.current.cloudAi })
      analysisRef.current = analysis
      if (token !== turnRef.current) return
      return applyTurn(afterClassify(callRef.current ?? state, analysis))
    }
    if (turn.action === 'file') return fileComplaint(token)
    if (turn.action === 'hangup') { await wait(500); hangUp(); return }
    if (state.misses < MAX_AUTO_LISTEN_MISSES) listen()
    else setActivity('waiting')
  }

  async function callerSaid(text: string) {
    const state = callRef.current
    if (!state || !awaitingCaller(state)) return
    stopListening()
    addLine({ who: 'caller', text })
    await applyTurn(handleReply(state, text))
  }

  async function fileComplaint(token: number) {
    const state = callRef.current
    if (!state) return
    setActivity('thinking')
    const { slots: s } = state
    const analysis = analysisRef.current ?? analyzeComplaint(s.problem, LANGUAGES.find((item) => item.code === state.language)?.name, { pin: s.pin, locality: s.locality })
    if (!user) return applyTurn(afterFileFailed(state, 'Please sign in on this site first.'))
    const payload = {
      title: `${s.issue || analysis.issue} — ${s.locality}`.slice(0, 140),
      description: `${s.problem}${s.duration ? ` (for ${s.duration})` : ''}${s.proof ? ' Proof is available on request.' : ''}`,
      original_text: s.problem,
      normalized_text: analysis.summary,
      category: analysis.category,
      department: s.department || analysis.department,
      pin: s.pin,
      locality: s.locality,
      source_channel: 'voice' as const,
      language: analysis.language,
      ai_confidence: analysis.confidence,
      severity: analysis.severity,
      location_lat: coordsRef.current?.latitude,
      location_lng: coordsRef.current?.longitude,
      consent: { browser_speech: optionsRef.current.voiceConsent, caller_confirmed: true, raw_audio_retained: false, device_location: Boolean(coordsRef.current), ai_call_agent: true },
    }
    try {
      if (!navigator.onLine) {
        if (!optionsRef.current.offline) throw new Error('You are offline. Reconnect, or allow on-device drafts in your profile.')
        await saveOfflineDraft(payload)
        setPendingDraft(true)
        if (token !== turnRef.current) return
        return applyTurn(afterDraftSaved(state))
      }
      const filed = await submitIssuePayload(payload)
      setIssue(filed)
      haptic('success')
      if (token !== turnRef.current) return
      return applyTurn(afterFiled(state, filed.documentId))
    } catch (error) {
      haptic('error')
      if (token !== turnRef.current) return
      return applyTurn(afterFileFailed(state, error instanceof Error ? error.message : 'The server did not accept it.'))
    }
  }

  // ---- Call controls -----------------------------------------------------------------

  async function dial() {
    if (phaseRef.current === 'ringing' || phaseRef.current === 'connected') return
    haptic('tap')
    try {
      const AudioCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      audioRef.current = audioRef.current ?? (AudioCtor ? new AudioCtor() : null)
      void audioRef.current?.resume()
    } catch {
      audioRef.current = null
    }
    // Unlock speech synthesis inside the tap; some browsers block speech started later otherwise.
    try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance('')) } catch { /* no speech synthesis */ }

    setLines([]); setInterim(''); setSeconds(0); setIssue(null); setPendingDraft(false); setNotice('')
    setKeyBuffer(''); setKeypadOpen(false); setTyped(''); setSlots(null)
    analysisRef.current = null
    coordsRef.current = null
    mutedRef.current = muted
    phaseRef.current = 'ringing'
    setPhase('ringing')
    ringback(audioRef.current)

    let detected: CallState['detected'] = null
    const located = shareLocation ? live.locate().then((result) => {
      if (!result) return null
      coordsRef.current = { latitude: result.latitude, longitude: result.longitude }
      const place = result.place?.pin && result.place.locality ? { pin: result.place.pin, locality: result.place.locality } : null
      if (place) void coverage(place.pin)
      return place
    }) : Promise.resolve(null)
    void located.then((place) => { detected = place })

    await wait(RING_SECONDS * 1000)
    if (phaseRef.current !== 'ringing') return
    tone(audioRef.current, [1400], 0, 0.08, 0.04)
    haptic('success')
    phaseRef.current = 'connected'
    setPhase('connected')
    const opening = startCall(language, detected)
    // Location that arrives after pickup is still offered when the agent reaches that question.
    if (!detected) void located.then((place) => { if (place && callRef.current) callRef.current = withDetectedLocation(callRef.current, place) })
    await applyTurn(opening)
  }

  function hangUp() {
    if (phaseRef.current === 'idle' || phaseRef.current === 'ended') return
    haptic('warning')
    turnRef.current += 1
    stopListening()
    stopSpeaking()
    tone(audioRef.current, [480, 620], 0, 0.25)
    phaseRef.current = 'ended'
    setPhase('ended')
    setActivity('waiting')
    setKeypadOpen(false)
  }

  function toggleMute() {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    haptic('tap')
    if (next) { stopListening(); setActivity('waiting') } else if (activity !== 'speaking' && activity !== 'thinking') listen()
  }

  function talkNow() {
    haptic('tap')
    stopSpeaking()
    turnRef.current += 1
    if (mutedRef.current) { mutedRef.current = false; setMuted(false) }
    listen()
  }

  function sendTyped() {
    const text = typed.trim()
    if (!text) return
    setTyped('')
    stopSpeaking()
    void callerSaid(text)
  }

  function sendDigits(digits: string) {
    const state = callRef.current
    if (!state || !awaitingCaller(state)) return
    stopListening()
    stopSpeaking()
    setKeyBuffer('')
    addLine({ who: 'caller', text: `⌨ ${digits}` })
    void applyTurn(handleDigits(state, digits))
  }

  function pressKey(key: string) {
    haptic('tap')
    const [low, high] = DTMF[key]
    tone(audioRef.current, [low, high], 0, 0.12)
    if (key === '*') { setKeyBuffer(''); return }
    if (key === '#') { if (keyBuffer) sendDigits(keyBuffer); return }
    const next = `${keyBuffer}${key}`.slice(0, 6)
    // Yes/no questions take one key; the PIN is sent once all six digits are in.
    if (['proof', 'confirm', 'failed'].includes(stage)) { sendDigits(key); return }
    if (next.length === 6 && (stage === 'location' || stage === 'pin')) { sendDigits(next); return }
    setKeyBuffer(next)
  }

  // ---- Screen ------------------------------------------------------------------------

  const statusText = phase === 'ringing'
    ? 'Ringing…'
    : activity === 'speaking' ? 'CivicChai is speaking'
      : activity === 'listening' ? 'Listening… go ahead'
        : activity === 'thinking' ? (stage === 'filing' ? 'Filing your report…' : 'Understanding…')
          : muted || !speechSupported || !voiceConsent ? 'Your turn: type or use the keypad' : 'Your turn: tap the mic to talk'

  const checklist: Array<[string, boolean]> = slots ? [
    ['Problem', Boolean(slots.issue)],
    ['Place', Boolean(slots.locality && callRef.current?.locationSettled)],
    ['PIN', /^\d{6}$/.test(slots.pin) && Boolean(callRef.current?.locationSettled)],
    ['How long', slots.duration !== null],
    ['Proof', slots.proof !== null],
    ['Filed', Boolean(issue)],
  ] : []

  return (
    <main className="min-h-dvh bg-background text-charcoal">
      <SiteNav />
      <section className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:items-start lg:justify-center lg:py-12">
        <div className="max-w-md text-center lg:mt-16 lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">Voice-first filing · SOP calling agent</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">Just call. Talk. Done.</h1>
          <p className="mt-3 text-sm leading-relaxed text-charcoal/70">Call the CivicChai agent and say what is wrong, in English, Hindi or Marathi. It asks where, for how long and whether you have proof, reads the complaint back, and files it only when you say yes. Then it reads your report ID aloud.</p>
          <ol className="mt-5 hidden space-y-2 text-sm text-charcoal/70 lg:block">
            {['Tell the problem in your own words', 'Confirm the place and PIN', 'Say how long, and if you have proof', 'Hear it read back and say yes', 'Get your report ID'].map((step, index) => (
              <li key={step} className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chai/10 text-xs font-bold text-chai">{index + 1}</span>{step}</li>
            ))}
          </ol>
          <p className="mt-6 hidden text-xs leading-relaxed text-charcoal/50 lg:block">This demo call runs in your browser. A real toll-free number needs an authority-assigned line and a telephony provider; the same agent script then runs on the phone line.</p>
        </div>

        <div className="relative flex h-[680px] max-h-[calc(100dvh-5rem)] min-h-[580px] w-full max-w-sm flex-col overflow-hidden rounded-[2.25rem] border-[6px] border-charcoal bg-[#1d1714] text-cream shadow-2xl">
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 pt-5 text-[11px] font-semibold text-cream/55">
            <span>{phase === 'connected' ? clock(seconds) : 'CivicChai'}</span>
            <span className="rounded-full bg-cream/10 px-2 py-0.5">AI agent · demo call</span>
          </div>

          {/* Caller ID */}
          <div className={`flex flex-col items-center px-6 ${phase === 'connected' ? 'pt-4' : 'pt-10'} transition-all`}>
            <div className="relative flex items-center justify-center">
              {(phase === 'ringing' || activity === 'speaking') && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terracotta/40" />}
              {activity === 'listening' && phase === 'connected' && <span className="absolute -inset-2 animate-pulse rounded-full border-2 border-leaf/70" />}
              <div className={`relative flex items-center justify-center rounded-full bg-gradient-to-br from-terracotta to-chai shadow-lg ${phase === 'connected' ? 'h-20 w-20' : 'h-28 w-28'} transition-all`}>
                <Coffee className={phase === 'connected' ? 'h-9 w-9' : 'h-12 w-12'} />
              </div>
            </div>
            <p className="mt-4 font-display text-xl font-extrabold">CivicChai Helpline</p>
            <p role="status" aria-live="polite" className="mt-1 text-sm text-cream/60">
              {phase === 'idle' ? 'Neighbourhood complaint line' : phase === 'ended' ? `Call ended · ${clock(seconds)}` : statusText}
            </p>
          </div>

          {phase === 'idle' && (
            <div className="mt-6 flex flex-1 flex-col px-6 pb-7">
              <div className="grid grid-cols-3 gap-1 rounded-full bg-cream/10 p-1" role="radiogroup" aria-label="Call language">
                {LANGUAGES.map((item) => (
                  <button key={item.code} type="button" role="radio" aria-checked={language === item.code} onClick={() => setLanguage(item.code)}
                    className={`rounded-full py-2 text-sm font-semibold transition ${language === item.code ? 'bg-cream text-charcoal' : 'text-cream/70'}`}>{item.label}</button>
                ))}
              </div>
              <div className="mt-4 space-y-2 text-xs leading-relaxed text-cream/70">
                <label className="flex items-start gap-2"><input type="checkbox" checked={voiceConsent} onChange={(event) => setVoiceConsent(event.target.checked)} className="mt-0.5 accent-terracotta" /><span>My browser may turn my speech into text. No audio is uploaded or kept.</span></label>
                <label className="flex items-start gap-2"><input type="checkbox" checked={shareLocation} onChange={(event) => setShareLocation(event.target.checked)} className="mt-0.5 accent-terracotta" /><span>Share my location so the agent can find the PIN.</span></label>
                <label className="flex items-start gap-2"><input type="checkbox" checked={cloudAi} onChange={(event) => setCloudAi(event.target.checked)} className="mt-0.5 accent-terracotta" /><span>Let cloud AI classify my complaint text (optional; otherwise on-site rules are used).</span></label>
              </div>
              {!speechSupported && <p className="mt-3 rounded-xl bg-gold/15 p-2.5 text-xs text-cream/80">This browser cannot hear speech. The agent still talks; you can answer by typing or with the keypad. Chrome or Edge can hear you.</p>}
              <div className="mt-auto flex flex-col items-center gap-3 pt-6">
                {!isHydrated ? null : user ? (
                  <>
                    <button type="button" onClick={() => void dial()} aria-label="Call CivicChai" className="flex h-16 w-16 items-center justify-center rounded-full bg-leaf text-cream shadow-lg transition active:scale-95"><Phone className="h-7 w-7" /></button>
                    <span className="text-xs text-cream/55">Tap to call · you are {user.handle ?? 'signed in'}</span>
                  </>
                ) : (
                  <Link href="/login?next=/voice-agent" className="w-full rounded-full bg-leaf py-3 text-center text-sm font-semibold text-cream">Sign in to call</Link>
                )}
              </div>
            </div>
          )}

          {(phase === 'ringing' || phase === 'connected') && (
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-6">
              {checklist.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label="Report progress">
                  {checklist.map(([label, done]) => (
                    <span key={label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${done ? 'bg-leaf/25 text-cream' : 'bg-cream/8 text-cream/45'}`}>{done && <Check className="h-3 w-3" />}{label}</span>
                  ))}
                </div>
              )}

              {keypadOpen ? (
                <div className="mt-3 flex flex-1 flex-col">
                  <p className="h-9 text-center font-mono text-2xl tracking-[0.35em]">{keyBuffer || <span className="text-sm tracking-normal text-cream/40">{stage === 'location' || stage === 'pin' ? 'Type the 6-digit PIN' : '1 = yes · 2 = no'}</span>}</p>
                  <div className="mx-auto mt-2 grid w-full max-w-[250px] grid-cols-3 gap-3">
                    {KEYS.map((key) => (
                      <button key={key} type="button" onClick={() => pressKey(key)} className="aspect-square rounded-full bg-cream/10 font-display text-2xl font-bold transition active:scale-95 active:bg-cream/25">{key}</button>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-[11px] text-cream/45"># sends · * clears</p>
                </div>
              ) : (
                <div ref={captionsRef} className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-black/20 p-3 text-sm" aria-live="polite" aria-label="Call captions">
                  {phase === 'ringing' && <p className="py-10 text-center text-cream/45">{live.status === 'locating' ? <><MapPin className="mr-1 inline h-4 w-4" />Finding your location…</> : 'Connecting you to the CivicChai agent…'}</p>}
                  {lines.map((line, index) => (
                    <p key={index} className={`max-w-[88%] rounded-2xl px-3 py-2 leading-snug ${line.who === 'agent' ? 'bg-cream/10 text-cream' : 'ml-auto bg-terracotta text-cream'}`}>{line.text}</p>
                  ))}
                  {interim && <p className="ml-auto max-w-[88%] rounded-2xl bg-terracotta/40 px-3 py-2 italic text-cream/80">{interim}</p>}
                </div>
              )}

              {notice && <p role="alert" className="mt-2 text-center text-[11px] text-gold">{notice}</p>}

              {phase === 'connected' && (
                <form onSubmit={(event) => { event.preventDefault(); sendTyped() }} className="mt-3 flex gap-2">
                  <input value={typed} onChange={(event) => setTyped(event.target.value.slice(0, 500))} placeholder="Or type your answer" lang={speechTag} className="min-w-0 flex-1 rounded-full bg-cream/10 px-4 py-2 text-sm text-cream placeholder:text-cream/40 outline-none focus:bg-cream/15" />
                  <button type="submit" aria-label="Send answer" disabled={!typed.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-terracotta disabled:opacity-40"><Send className="h-4 w-4" /></button>
                </form>
              )}

              <div className="mt-4 flex items-center justify-around">
                <button type="button" onClick={toggleMute} disabled={phase !== 'connected'} aria-pressed={muted} className="flex flex-col items-center gap-1 text-[11px] text-cream/70 disabled:opacity-40">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full ${muted ? 'bg-cream text-charcoal' : 'bg-cream/10'}`}>{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</span>{muted ? 'Unmute' : 'Mute'}
                </button>
                <button type="button" onClick={hangUp} aria-label="End call" className="flex h-16 w-16 items-center justify-center rounded-full bg-heat text-cream shadow-lg transition active:scale-95"><PhoneOff className="h-7 w-7" /></button>
                <button type="button" onClick={() => setKeypadOpen((open) => !open)} disabled={phase !== 'connected'} aria-pressed={keypadOpen} className="flex flex-col items-center gap-1 text-[11px] text-cream/70 disabled:opacity-40">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full ${keypadOpen ? 'bg-cream text-charcoal' : 'bg-cream/10'}`}><Grid3x3 className="h-5 w-5" /></span>Keypad
                </button>
              </div>
              {phase === 'connected' && activity === 'waiting' && speechSupported && voiceConsent && (
                <button type="button" onClick={talkNow} className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-leaf px-4 py-2 text-xs font-semibold text-cream"><Mic className="h-4 w-4" />Tap to talk</button>
              )}
              {phase === 'connected' && activity === 'speaking' && stage !== 'filing' && stage !== 'done' && speechSupported && voiceConsent && (
                <button type="button" onClick={talkNow} className="mx-auto mt-3 text-[11px] font-semibold text-cream/50 underline">Interrupt and answer</button>
              )}
            </div>
          )}

          {phase === 'ended' && (
            <div className="mt-6 flex flex-1 flex-col px-6 pb-7">
              {issue ? (
                <div className="rounded-2xl bg-leaf/20 p-4 text-center">
                  <Check className="mx-auto h-8 w-8 text-leaf" />
                  <p className="mt-2 text-sm text-cream/70">Report filed</p>
                  <p className="mt-1 font-mono text-base font-bold">{issue.documentId}</p>
                  <p className="mt-1 text-xs text-cream/60">Routed to {issue.department}</p>
                  <div className="mt-3 flex justify-center gap-4 text-sm font-semibold">
                    <Link href={`/issues/${encodeURIComponent(issue.id)}`} className="underline">Open report</Link>
                    <Link href="/citizen" className="underline">My Charcha</Link>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl bg-cream/10 p-4 text-center text-sm text-cream/70">{pendingDraft ? 'Your complaint is saved on this device as a draft. It is sent when you reconnect.' : 'No report was filed on this call.'}</p>
              )}
              {lines.length > 0 && (
                <details className="mt-4 text-xs text-cream/60">
                  <summary className="cursor-pointer font-semibold">Call transcript ({lines.length} lines)</summary>
                  <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                    {lines.map((line, index) => <p key={index}><span className="font-semibold text-cream/80">{line.who === 'agent' ? 'Agent' : 'You'}:</span> {line.text}</p>)}
                  </div>
                </details>
              )}
              <div className="mt-auto flex flex-col items-center gap-2 pt-6">
                <button type="button" onClick={() => void dial()} className="flex h-14 w-14 items-center justify-center rounded-full bg-leaf text-cream shadow-lg active:scale-95" aria-label="Call again"><Phone className="h-6 w-6" /></button>
                <span className="text-xs text-cream/55">Call again</span>
              </div>
            </div>
          )}
        </div>
      </section>
      <p className="mx-auto max-w-md px-4 pb-10 text-center text-xs text-charcoal/55">Prefer filling it in yourself? <Link href="/voice-agent?mode=form" className="font-semibold text-chai underline">Use the step-by-step voice form</Link>.</p>
      <SiteFooter />
    </main>
  )
}
