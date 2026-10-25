'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { CATEGORY_OPTIONS, analyzeComplaintRequest, categoryOption } from '@/lib/ai'
import { ChaiHeatMeter } from '@/components/brand/chai-heat-meter'
import type { CreateIssueInput, IssueRecord } from '@/lib/types'
import { saveOfflineDraft } from '@/lib/offline-queue'
import { civicFetch, submitIssuePayload } from '@/lib/client-api'
import { canManageIssues } from '@/lib/roles'
import { useAuth } from '@/components/auth-provider'
import { PwaInstallButton } from '@/components/pwa-install-button'
import { useServiceArea } from './use-service-area'
import { SPEECH_UNSUPPORTED_MESSAGE, getSpeechRecognition, speechErrorMessage, speechLanguage } from './speech'
import { LocationStep, type ReportLocation } from './location-step'
import Link from 'next/link'
import {
  X,
  Mic,
  Camera,
  MapPin,
  Phone,
  Sparkles,
  Flame,
  Check,
  Loader2,
  ArrowLeft,
} from 'lucide-react'

type Step = 'location' | 'compose' | 'analyzing' | 'result' | 'duplicate' | 'done'
type Analysis = Awaited<ReturnType<typeof analyzeComplaintRequest>>

const LANGS = ['Auto Detect', 'English', 'हिन्दी', 'मराठी']

function isInstalledApp() {
  return typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
}

export function Composer({ onClose }: { onClose: () => void }) {
  const { user, isHydrated } = useAuth()
  const area = useServiceArea()
  const [step, setStep] = useState<Step>('location')
  const [text, setText] = useState('')
  const [lang, setLang] = useState('Auto Detect')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [usedVoice, setUsedVoice] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [proofUrls, setProofUrls] = useState<string[]>([])
  const [pin, setPin] = useState('')
  const [locality, setLocality] = useState('')
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [onlineConsent, setOnlineConsent] = useState(false)
  const [offlineStorageConsent, setOfflineStorageConsent] = useState(false)
  const [submissionState, setSubmissionState] = useState<'submitted' | 'joined' | 'queued'>('submitted')
  const [submissionError, setSubmissionError] = useState('')
  const [submittedIssue, setSubmittedIssue] = useState<IssueRecord | null>(null)
  const [distinctFromId, setDistinctFromId] = useState('')
  const [deployment, setDeployment] = useState({ intake: true, uploads: true })
  const recognitionRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const prefilled = useRef(false)

  const canFile = Boolean(user && (user.role === 'citizen' || canManageIssues(user.role)))
  const updateLocation = useCallback((next: Partial<ReportLocation>) => {
    if (next.pin !== undefined) setPin(next.pin)
    if (next.locality !== undefined) setLocality(next.locality)
    if (next.coordinates !== undefined) setCoordinates(next.coordinates)
  }, [])

  // Saved area and consent choices are defaults; the citizen confirms them for each report.
  useEffect(() => {
    if (!area.loaded || prefilled.current) return
    prefilled.current = true
    setPin((current) => current || area.pin)
    setLocality((current) => current || area.locality)
    setOnlineConsent(area.consent.online_ai)
    setOfflineStorageConsent(area.consent.offline_storage)
  }, [area])

  useEffect(() => {
    let cancelled = false
    fetch('/api/health', { cache: 'no-store' }).then((response) => response.json()).then((payload) => {
      if (!cancelled) setDeployment({ intake: payload?.publicIntakeEnabled !== false, uploads: payload?.evidenceUploadsEnabled !== false })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = speechLanguage(lang)
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onresult = (event: any) => {
      const latestResult = event.results?.[event.results.length - 1]
      const transcript = latestResult?.[0]?.transcript ?? ''
      const cleaned = transcript.trim()

      if (!cleaned) return

      setUsedVoice(true)
      setText((current) => {
        if (!current) return cleaned

        const lastWords = current.trim().split(/\s+/).slice(-5).join(' ')
        if (lastWords && cleaned.includes(lastWords)) {
          return current
        }

        return `${current.trim()} ${cleaned}`.trim()
      })
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = (event) => {
      setIsListening(false)
      const text = speechErrorMessage(event.error)
      if (text) setSubmissionError(text)
    }
    recognition.onstart = () => setIsListening(true)

    recognitionRef.current = recognition

    return () => {
      try {
        recognition.stop()
      } catch {
        // no-op
      }
    }
  }, [lang])

  async function analyze() {
    if (!text.trim()) return
    if (pin.length !== 6 || !locality.trim()) {
      setSubmissionError('Set the location (PIN and locality) before classification.')
      setStep('location')
      return
    }
    setSubmissionError('')
    setStep('analyzing')
    const result = await analyzeComplaintRequest(text, lang, { pin, locality, hasEvidence: proofUrls.length > 0, onlineConsent })
    setAnalysis(result)
    setStep(result.duplicateIssueFound && !distinctFromId ? 'duplicate' : 'result')
  }

  function toggleVoice() {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition || !recognitionRef.current) {
      setSubmissionError(SPEECH_UNSUPPORTED_MESSAGE)
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    try {
      setSubmissionError('')
      recognitionRef.current.start()
      setIsListening(true)
    } catch {
      setIsListening(false)
      setSubmissionError('Voice input could not start. Wait a moment and tap record again.')
    }
  }

  function handleProofSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    const maxSize = 4 * 1024 * 1024
    const allowed = files.filter((file) => ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type) && file.size <= maxSize)
    if (allowed.length !== files.length || allowed.length + proofUrls.length > 3) {
      setSubmissionError('Add up to three JPG/PNG/WebP images or MP4/WebM videos (4 MB each).')
      if (event.target) event.target.value = ''
      return
    }

    Promise.all(
      allowed.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result ?? ''))
            reader.onerror = () => reject(new Error(`Unable to read ${file.name}`))
            reader.readAsDataURL(file)
          }),
      ),
    )
      .then((dataUrls) => {
        setProofUrls((current) => [...current, ...dataUrls])
        setSubmissionError('')
      })
      .catch(() => {
        setSubmissionError('One of the selected files could not be read. Try a different photo or video.')
      })
      .finally(() => {
        if (event.target) event.target.value = ''
      })
  }

  function changeCategory(category: string) {
    const option = categoryOption(category)
    setAnalysis((current) => current ? { ...current, category: option.category, issue: option.issue, department: option.department } : current)
  }

  function buildPayload(result: Analysis): CreateIssueInput {
    return {
      title: `${result.issue} — ${locality.trim()}`.slice(0, 140),
      description: text.trim(),
      original_text: text.trim(),
      normalized_text: result.summary,
      category: result.category,
      department: result.department,
      pin: pin.trim(),
      locality: locality.trim(),
      distinct_from: distinctFromId || undefined,
      source_channel: usedVoice ? 'voice' : isInstalledApp() ? 'pwa' : 'web',
      language: result.language,
      ai_confidence: result.confidence,
      severity: result.severity,
      location_lat: coordinates?.lat,
      location_lng: coordinates?.lng,
      consent: { online_ai: onlineConsent, device_location: Boolean(coordinates), private_evidence: proofUrls.length > 0, offline_storage: offlineStorageConsent, browser_speech: usedVoice },
      image_urls: proofUrls.length ? proofUrls : undefined,
    }
  }

  async function saveDraft(payload: CreateIssueInput) {
    if (!offlineStorageConsent) throw new Error('You are offline. Allow temporary on-device draft storage to keep this complaint until you reconnect.')
    const draft = await saveOfflineDraft(payload)
    setSubmissionState('queued')
    setSubmittedIssue({ id: draft.id, documentId: draft.id, title: payload.title, description: payload.description, category: payload.category, department: payload.department, pin: payload.pin, locality: payload.locality, status: 'Filed', priority: analysis?.priority ?? 'Moderate', trust: 0, chaiHeat: 0, supporters: 0, reports: 1, comments: 0, daysUnresolved: 0, officer: 'Pending sync', hub: 'Pending sync', createdAt: draft.saved_at })
    setStep('done')
  }

  async function submitReport() {
    if (!analysis) return
    setIsSubmitting(true)
    setSubmissionError('')
    const payload = buildPayload(analysis)
    try {
      if (!navigator.onLine) {
        await saveDraft(payload)
        return
      }
      const issue = await submitIssuePayload(payload)
      setSubmittedIssue(issue)
      setDistinctFromId('')
      setSubmissionState('submitted')
      setStep('done')
    } catch (error) {
      // A network failure (TypeError) falls back to an on-device draft when the citizen allowed it.
      if (!navigator.onLine || error instanceof TypeError) {
        try {
          await saveDraft(payload)
        } catch (storageError) {
          setSubmissionError(storageError instanceof Error ? storageError.message : 'Unable to save a local draft.')
        }
      } else {
        setSubmissionError(error instanceof Error ? error.message : 'Unable to submit. Your complaint remains in this form.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function joinExisting(issueId: string) {
    if (!analysis) return
    setIsSubmitting(true)
    setSubmissionError('')
    try {
      const response = await civicFetch(`/api/issues/${encodeURIComponent(issueId)}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_text: text.trim(), language: analysis.language, source_channel: usedVoice ? 'voice' : 'web', has_evidence: proofUrls.length > 0, consent: { online_ai: onlineConsent } }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Unable to support this issue.')
      setSubmittedIssue(data.issue)
      setSubmissionState('joined')
      setStep('done')
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Unable to support this issue.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const candidates = analysis?.duplicateCandidates?.length
    ? analysis.duplicateCandidates
    : analysis?.duplicateIssue ? [{ issue: { ...analysis.duplicateIssue, department: analysis.department }, similarity: analysis.duplicateIssue.similarity, band: analysis.duplicateIssue.band, signals: [] as string[] }] : []

  const gate = !isHydrated ? null
    : !deployment.intake ? <p className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm leading-relaxed text-charcoal/75">Online issue intake is not enabled for this deployment yet. Please use your authority&apos;s official grievance or emergency channel.</p>
      : !user ? <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-center"><p className="font-display text-lg font-bold text-charcoal">Sign in to report an issue</p><p className="text-sm text-charcoal/65">An account lets you track the report, receive status updates and confirm when it is fixed. Your name is never shown publicly.</p><Link href="/login?next=/citizen?report=1" className="inline-flex w-full justify-center rounded-xl bg-chai px-4 py-3 text-sm font-semibold text-cream">Sign in or create an account</Link><Link href="/voice-agent" className="block text-xs font-semibold text-chai underline">No smartphone app? Use the voice-assisted form</Link></div>
        : !canFile ? <p className="rounded-2xl border border-border bg-card p-4 text-sm text-charcoal/70">This account role cannot file civic reports. Use a citizen account, or a department account for assisted filing.</p>
          : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="composer-title">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-background shadow-xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 id="composer-title" className="font-display text-lg font-extrabold text-charcoal">
              Batao, kya problem hai?
            </h2>
            <p className="text-xs text-charcoal/60">Type karo ya bolke batao.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close composer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-charcoal/60 hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {!isHydrated && <p role="status" className="text-sm text-charcoal/60">Loading…</p>}
          {gate}
          {isHydrated && !gate && step === 'location' && (
            <LocationStep value={{ pin, locality, coordinates }} onChange={updateLocation} onConfirm={() => { setSubmissionError(''); setStep('compose') }} />
          )}
          {isHydrated && !gate && (step === 'compose' || step === 'analyzing') && (
            <div className="space-y-4">
              <button type="button" onClick={() => setStep('location')} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left">
                <MapPin className="h-4 w-4 shrink-0 text-terracotta" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-charcoal">{locality || 'Location not set'}</span><span className="block text-[11px] text-charcoal/55">PIN {pin || '—'}{coordinates ? ' · exact spot marked' : ''}</span></span>
                <span className="shrink-0 text-xs font-semibold text-chai underline">Change</span>
              </button>
              {user && user.role !== 'citizen' && <p className="rounded-lg bg-gold/10 p-3 text-xs text-charcoal/70">You are filing as staff. The report is recorded as assisted filing on behalf of a citizen; confirm the citizen agreed to this.</p>}
              {distinctFromId && <p className="rounded-lg bg-leaf/10 p-3 text-xs text-charcoal/70">You marked the suggested issue as a different problem. This report will be filed separately and the decision recorded for reviewers.</p>}
              <button
                type="button"
                onClick={toggleVoice}
                className={cn(
                  'flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed py-6 text-terracotta transition-colors',
                  isListening
                    ? 'border-terracotta bg-terracotta/15'
                    : 'border-terracotta/50 bg-terracotta/5 hover:bg-terracotta/10',
                )}
                aria-label={isListening ? 'Stop voice recording' : 'Record your complaint by voice'}
                aria-pressed={isListening}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-terracotta text-cream shadow-sm">
                  <Mic className={cn('h-6 w-6', isListening && 'animate-pulse')} />
                </span>
                <span className="text-sm font-semibold">
                  {isListening ? 'Listening… tap to stop' : 'Tap to record'}
                </span>
                <span className="px-4 text-[11px] text-charcoal/50">Your browser converts speech to text. CivicChai does not keep audio.</span>
              </button>

              <label className="block text-xs font-semibold text-charcoal/65">Complaint
                <textarea
                  value={text}
                  onChange={(e) => { setText(e.target.value); setDistinctFromId('') }}
                  rows={3}
                  maxLength={5000}
                  placeholder="e.g. Station road ki light 15 din se band hai..."
                  className="mt-1 w-full resize-none rounded-xl border border-border bg-card p-3 text-sm font-normal text-charcoal outline-none placeholder:text-charcoal/40 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20"
                />
              </label>

              <div className="flex flex-wrap gap-2" role="group" aria-label="Complaint language">
                {LANGS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      lang === l
                        ? 'border-chai bg-chai text-cream'
                        : 'border-border bg-card text-charcoal/70',
                      l === 'हिन्दी' || l === 'मराठी' ? 'font-deva' : '',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                multiple
                className="hidden"
                onChange={handleProofSelection}
              />

              <div className="grid grid-cols-2 gap-2">
                {[
                  [Camera, deployment.uploads ? 'Add Proof' : 'Proof later', () => deployment.uploads ? fileInputRef.current?.click() : setSubmissionError('Photo and video uploads are not enabled for this deployment yet. Mention in your complaint that you have proof.'), false],
                  [Phone, 'Voice form', () => { window.location.href = '/voice-agent' }, false],
                ].map(([Icon, label, onClick, disabled], i) => {
                  const I = Icon as React.ElementType
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={onClick as () => void}
                      disabled={disabled as boolean}
                      className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-3 text-xs font-medium text-charcoal/70 hover:border-chai/40 disabled:opacity-60"
                    >
                      <I className="h-4 w-4 text-chai" />
                      {label as string}
                    </button>
                  )
                })}
              </div>

              {proofUrls.length > 0 && (
                <div className="space-y-2 rounded-xl border border-dashed border-border bg-card p-3">
                  {proofUrls.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {proofUrls.map((url, index) => (
                        <span key={`${index}-${url.length}`} className="relative shrink-0">
                          {url.startsWith('data:video/') ? <video
                            src={url}
                            aria-label={`Complaint proof video ${index + 1}`}
                            controls
                            className="h-16 w-28 rounded-lg object-cover"
                          /> : <img
                            src={url}
                            alt={`Complaint proof ${index + 1}`}
                            className="h-16 w-16 rounded-lg object-cover"
                          />}
                          <button type="button" onClick={() => setProofUrls((current) => current.filter((_, position) => position !== index))} aria-label={`Remove proof ${index + 1}`} className="absolute -right-1.5 -top-1.5 rounded-full bg-charcoal p-0.5 text-cream"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-charcoal/65">
                <input type="checkbox" checked={onlineConsent} onChange={(event) => setOnlineConsent(event.target.checked)} className="mt-0.5 accent-chai" />
                <span>Optional: allow this complaint text to be sent to the configured online AI provider for classification. Without consent, analysis stays in this app and uses its local rules-based model.</span>
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs leading-relaxed text-charcoal/65">
                <input type="checkbox" checked={offlineStorageConsent} onChange={(event) => setOfflineStorageConsent(event.target.checked)} className="mt-0.5 accent-chai" />
                <span>Allow a pending complaint and selected proof to stay temporarily in this browser on this device when offline. Anyone with access to this browser can view it. The draft is removed from local storage after a confirmed sync.</span>
              </label>

              {submissionError && <p role="alert" className="rounded-lg bg-heat/10 p-3 text-xs text-heat">{submissionError}</p>}

              <button
                type="button"
                onClick={analyze}
                disabled={step === 'analyzing' || !text.trim() || pin.length !== 6 || !locality.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-chai px-4 py-3 text-sm font-semibold text-cream disabled:opacity-50"
              >
                {step === 'analyzing' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI samajh raha hai...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Understand my complaint
                  </>
                )}
              </button>
              {(!text.trim() || pin.length !== 6 || !locality.trim()) && <p className="text-center text-[11px] text-charcoal/50">{pin.length !== 6 || !locality.trim() ? 'Set the location first (tap the location above).' : 'Describe the problem to continue.'}</p>}
              <div className="flex items-center justify-center gap-3 text-center text-xs text-charcoal/50">
                <span>Offline drafts stay on this device until connection returns.</span>
                <PwaInstallButton className="inline-flex items-center gap-1 font-semibold text-chai" />
              </div>
            </div>
          )}

          {!gate && step === 'result' && analysis && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-chai">
                <Sparkles className="h-4 w-4" />
                AI ne problem samajh li — please confirm
              </div>
              <label className="block text-xs font-semibold text-charcoal/65">Category (change it if the suggestion is wrong)
                <select value={analysis.category} onChange={(event) => changeCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-charcoal">
                  {CATEGORY_OPTIONS.map((option) => <option key={option.category} value={option.category}>{option.category}</option>)}
                </select>
              </label>
              <dl className="rounded-2xl border border-border bg-card p-4 text-sm">
                {[
                  ['Language', analysis.language],
                  ['Issue', analysis.issue],
                  ['Location', `${locality}, PIN ${pin}`],
                  ['Suggested department', analysis.department],
                  ['Priority', `${analysis.priority} · ${analysis.priorityScore}/100`],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                  >
                    <dt className="text-charcoal/60">{k}</dt>
                    <dd className="text-right font-semibold text-charcoal">{v}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <dt className="text-charcoal/60">Classification confidence</dt>
                  <dd className="rounded-md bg-leaf/15 px-2 py-0.5 font-semibold text-leaf">
                    {analysis.confidence}%
                  </dd>
                </div>
              </dl>
              <p className="text-[11px] leading-relaxed text-charcoal/50">Routing is a suggestion ({analysis.modelVersion}). Authority staff review the category and department.</p>
              {submissionError && <p role="alert" className="rounded-lg bg-heat/10 p-3 text-xs text-heat">{submissionError}</p>}
              <button
                type="button"
                onClick={submitReport}
                disabled={isSubmitting}
                className="w-full rounded-xl bg-chai px-4 py-3 text-sm font-semibold text-cream disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting...' : 'Create report'}
              </button>
              <button type="button" onClick={() => { setStep('compose'); setSubmissionError('') }} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-charcoal/70"><ArrowLeft className="h-4 w-4" />Edit complaint</button>
            </div>
          )}

          {!gate && step === 'duplicate' && analysis && candidates.length > 0 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
                <p className="font-display font-bold text-charcoal">
                  Arre, yeh Chai pehle se chal rahi hai!
                </p>
                <p className="mt-1 text-sm text-charcoal/70">
                  We found {candidates.length === 1 ? 'a similar issue' : 'similar issues'} in PIN {pin}. Joining adds your report and support to it. You can still file separately.
                </p>
              </div>
              {candidates.map((candidate) => (
                <div key={candidate.issue.id} className="rounded-2xl border border-border bg-card p-4">
                  <Link href={`/issues/${encodeURIComponent(candidate.issue.id)}`} target="_blank" className="font-display font-bold text-charcoal hover:underline">
                    {candidate.issue.title}
                  </Link>
                  <p className="text-xs text-charcoal/60">
                    {candidate.issue.locality} &middot; {candidate.issue.status} &middot; {Math.round(candidate.similarity * 100)}% {candidate.band === 'strong' ? 'strong match' : 'related'}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <ChaiHeatMeter heat={candidate.issue.chaiHeat} size="sm" />
                    <span className="text-xs text-charcoal/60">
                      {candidate.issue.reports} reports &middot; {candidate.issue.supporters} supporters
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void joinExisting(candidate.issue.id)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-heat px-4 py-3 text-sm font-semibold text-heat-foreground disabled:opacity-60"
                  >
                    <Flame className="h-4 w-4" />
                    {isSubmitting ? 'Adding…' : 'Is Charcha ko Support Karo'}
                  </button>
                </div>
              ))}
              {user?.role !== 'citizen' && <p className="text-center text-xs text-charcoal/60">Community support is limited to citizen accounts. File a separate assisted report instead.</p>}
              {submissionError && <p role="alert" className="text-xs text-heat">{submissionError}</p>}
              <button
                type="button"
                onClick={() => { setDistinctFromId(candidates[0].issue.id); setSubmissionError(''); setStep('result') }}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-charcoal"
              >
                Yeh alag problem hai — file separately
              </button>
            </div>
          )}

          {!gate && step === 'done' && submittedIssue && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf/15 text-leaf">
                  <Check className="h-8 w-8" />
                </span>
                <p className="mt-3 font-display text-lg font-extrabold text-charcoal">
                  {submissionState === 'queued' ? 'Draft saved on this device' : submissionState === 'joined' ? 'You joined this Charcha' : 'Charcha shuru ho gayi!'}
                </p>
                <p className="mt-1 text-sm text-charcoal/60">
                  {submissionState === 'queued'
                    ? 'It has not been submitted yet. It will be filed when you are online and signed in; check My Charcha.'
                    : submissionState === 'joined'
                      ? 'Your report and support were added to the existing issue. Follow it in My Charcha.'
                      : 'Your report was filed. Keep this reference to track it.'}
                </p>
                {submissionState !== 'queued' && <p className="mt-2 font-mono text-sm font-semibold text-chai">{submittedIssue.documentId}</p>}
              </div>
              {submissionState !== 'queued' && <section aria-label="What happens next" className="rounded-2xl border border-border bg-card p-4 text-sm">
                <p className="font-display font-bold text-charcoal">What happens next</p>
                <dl className="mt-2 space-y-1.5">
                  {[
                    ['What is the problem?', `${submittedIssue.category}`],
                    ['Who handles it?', submittedIssue.department],
                    ['Where?', `PIN ${submittedIssue.pin} · ${submittedIssue.locality}`],
                    ['Official contact & rules', 'Shown on the report only when the authority has verified them'],
                    ['Next steps', 'Acknowledgement → assignment → field action → resolution → your confirmation'],
                  ].map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="shrink-0 text-charcoal/55">{k}</dt><dd className="text-right font-medium text-charcoal">{v}</dd></div>)}
                </dl>
                <p className="mt-3 text-[11px] text-charcoal/50">CivicChai helps you track civic work. It is not an emergency service or a statutory appeal channel.</p>
              </section>}
              {submissionState !== 'queued' && <Link href={`/issues/${encodeURIComponent(submittedIssue.id)}`} className="inline-flex w-full justify-center rounded-xl border border-chai/30 bg-chai/5 px-4 py-3 text-sm font-semibold text-chai">Open structured public report</Link>}
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-chai px-4 py-3 text-sm font-semibold text-cream"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
