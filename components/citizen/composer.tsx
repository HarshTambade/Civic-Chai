'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { analyzeComplaintRequest } from '@/lib/ai'
import { ChaiHeatMeter } from '@/components/brand/chai-heat-meter'
import type { IssueRecord } from '@/lib/types'
import { saveOfflineDraft } from '@/lib/offline-queue'
import { civicFetch } from '@/lib/client-api'
import { submitIssuePayload } from '@/lib/client-api'
import { useAuth } from '@/components/auth-provider'
import { PwaInstallButton } from '@/components/pwa-install-button'
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
} from 'lucide-react'

type Step = 'compose' | 'analyzing' | 'result' | 'duplicate' | 'done'

type SpeechRecognitionCtor = new () => {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: any) => void) | null
  onend: (() => void) | null
  onerror: ((event: any) => void) | null
  onstart: (() => void) | null
}

const LANGS = ['Auto Detect', 'English', 'हिन्दी', 'मराठी']

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null

  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }

  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null
}

export function Composer({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('compose')
  const [text, setText] = useState('')
  const [lang, setLang] = useState('Auto Detect')
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof analyzeComplaintRequest>> | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [proofUrls, setProofUrls] = useState<string[]>([])
  const [locationLabel, setLocationLabel] = useState('')
  const [pin, setPin] = useState('')
  const [locality, setLocality] = useState('')
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [onlineConsent, setOnlineConsent] = useState(false)
  const [offlineStorageConsent, setOfflineStorageConsent] = useState(false)
  const [submissionState, setSubmissionState] = useState<'submitted' | 'queued' | 'error'>('submitted')
  const [submissionError, setSubmissionError] = useState('')
  const [submittedIssue, setSubmittedIssue] = useState<IssueRecord | null>(null)
  const [distinctFromId, setDistinctFromId] = useState('')
  const [forceDistinctId, setForceDistinctId] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const recognitionRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const documentId = useMemo(
    () => `CC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`,
    [],
  )

  useEffect(() => {
    let cancelled = false
    const localKey = `civicchai_profile_settings:${user?.id ?? 'guest'}`
    if (user?.demo || !user) {
      try {
        const saved = localStorage.getItem(localKey)
        if (saved) {
          const profile = JSON.parse(saved) as { preferred_pin?: string; locality?: string; consent_preferences?: { online_ai?: boolean; device_location?: boolean; offline_storage?: boolean } }
          if (!cancelled) {
            setPin(profile.preferred_pin ?? '')
            setLocality(profile.locality ?? '')
            setOnlineConsent(Boolean(profile.consent_preferences?.online_ai))
            setOfflineStorageConsent(Boolean(profile.consent_preferences?.offline_storage))
          }
        }
      } catch {
        // Invalid local preferences are ignored; the citizen can enter the area manually.
      }
    } else {
      civicFetch('/api/profile').then((response) => response.ok ? response.json() : null).then((payload) => {
        const profile = payload?.profile
        if (!cancelled && profile) {
          setPin(profile.preferred_pin ?? '')
          setLocality(profile.locality ?? '')
          setOnlineConsent(Boolean(profile.consent_preferences?.online_ai))
          setOfflineStorageConsent(Boolean(profile.consent_preferences?.offline_storage))
        }
      }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [user?.id, user?.demo])

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = lang === 'Auto Detect' ? 'en-IN' : lang === 'हिन्दी' ? 'hi-IN' : lang === 'मराठी' ? 'mr-IN' : 'en-IN'
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onresult = (event: any) => {
      const latestResult = event.results?.[event.results.length - 1]
      const transcript = latestResult?.[0]?.transcript ?? ''
      const cleaned = transcript.trim()

      if (!cleaned) return

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
    recognition.onerror = () => setIsListening(false)
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
      setSubmissionError('Confirm a six-digit PIN and locality before classification.')
      return
    }
    setSubmissionError('')
    setStep('analyzing')
    const result = await analyzeComplaintRequest(text, lang, { pin, locality, hasEvidence: proofUrls.length > 0, onlineConsent })
    setAnalysis(result)
    if (result.duplicateIssueFound && result.duplicateIssue?.id !== forceDistinctId) setStep('duplicate')
    else setStep('result')
  }

  function toggleVoice() {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition || !recognitionRef.current) {
      setText((current) => current || 'Voice input is not supported in this browser. Please type your complaint.')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch {
      setIsListening(false)
    }
  }

  function handleProofSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    const maxSize = (file: File) => file.type.startsWith('video/') ? 15 * 1024 * 1024 : 4 * 1024 * 1024
    const allowed = files.filter((file) => ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type) && file.size <= maxSize(file))
    if (allowed.length !== files.length || allowed.length + proofUrls.length > 3) {
      setSubmissionError('Add up to three JPG/PNG/WebP images (4 MB each) or MP4/WebM videos (15 MB each).')
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
      .catch((error) => {
        console.error('Failed to read proof files', error)
      })
      .finally(() => {
        if (event.target) event.target.value = ''
      })
  }

  function handleLocationCapture() {
    if (!navigator.geolocation) {
      setLocationLabel('Location permission unavailable')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const label = `Current location • ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        setLocationLabel(label)
        setCoordinates({ lat: latitude, lng: longitude })
        setIsLocating(false)
      },
      () => {
        setLocationLabel('Location unavailable • using nearest civic area')
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  function handleCallCivicChai() {
    window.location.href = '/voice-agent'
  }

  async function submitReport() {
    if (!analysis) return

    setIsSubmitting(true)
    setSubmissionError('')
    try {
      const payload = {
        title: analysis.issue,
        description: text.trim(),
        original_text: text.trim(),
        normalized_text: analysis.summary,
        category: analysis.category,
        department: analysis.department,
        pin: pin.trim(),
        locality: locality.trim(),
        distinct_from: distinctFromId || undefined,
        status: 'Filed' as const,
        priority: analysis.priority,
        source_channel: 'pwa' as const,
        language: analysis.language,
        ai_confidence: analysis.confidence,
        severity: analysis.severity,
        location_lat: coordinates?.lat,
        location_lng: coordinates?.lng,
        consent: { online_ai: onlineConsent, device_location: Boolean(coordinates), private_evidence: proofUrls.length > 0, offline_storage: offlineStorageConsent },
        image_url: proofUrls[0] ?? undefined,
        image_urls: proofUrls.length ? proofUrls : undefined,
        evidence: proofUrls.length ? proofUrls : undefined,
      }

      if (!navigator.onLine) {
        if (!offlineStorageConsent) throw new Error('Allow temporary on-device draft storage before saving this complaint offline.')
        const draft = await saveOfflineDraft(payload)
        setSubmissionState('queued')
        setSubmittedIssue({ id: draft.id, documentId: draft.id, title: payload.title, description: payload.description, category: payload.category, department: payload.department, pin: payload.pin, locality: payload.locality, status: 'Filed', priority: payload.priority, trust: 0, chaiHeat: 0, supporters: 0, reports: 1, comments: 0, daysUnresolved: 0, officer: 'Pending sync', hub: 'Pending sync', createdAt: draft.saved_at })
        setStep('done')
        setAnalysis((prev) => prev ? { ...prev, summary: 'Saved on this device. It will sync when a secure connection returns; it has not been submitted yet.' } : prev)
        return
      }

      const issue = await submitIssuePayload(payload)
      setSubmittedIssue(issue)
      setDistinctFromId('')
      setSubmissionState('submitted')
      setStep('done')
      setAnalysis((prev) => prev ? { ...prev, summary: `Report ${issue.documentId ?? issue.id} successfully filed for ${issue.department}.` } : prev)
    } catch (error) {
      if (!navigator.onLine || error instanceof TypeError) {
        try {
          if (!offlineStorageConsent) throw new Error('Allow temporary on-device draft storage before saving this complaint offline.')
          const payload = {
            title: analysis.issue,
            description: text.trim(),
            original_text: text.trim(),
            normalized_text: analysis.summary,
            category: analysis.category,
            department: analysis.department,
            pin: pin.trim(),
            locality: locality.trim(),
            source_channel: 'pwa' as const,
            language: analysis.language,
            ai_confidence: analysis.confidence,
            severity: analysis.severity,
            location_lat: coordinates?.lat,
            location_lng: coordinates?.lng,
            consent: { online_ai: onlineConsent, device_location: Boolean(coordinates), private_evidence: proofUrls.length > 0, offline_storage: offlineStorageConsent },
            image_url: proofUrls[0],
            evidence_urls: proofUrls,
          }
          const draft = await saveOfflineDraft(payload)
          setSubmissionState('queued')
          setSubmittedIssue({ id: draft.id, documentId: draft.id, title: payload.title, description: payload.description, category: payload.category, department: payload.department, pin: payload.pin, locality: payload.locality, status: 'Filed', priority: analysis.priority, trust: 0, chaiHeat: 0, supporters: 0, reports: 1, comments: 0, daysUnresolved: 0, officer: 'Pending sync', hub: 'Pending sync', createdAt: draft.saved_at })
          setAnalysis((prev) => prev ? { ...prev, summary: 'Saved on this device. It will sync when a secure connection returns; it has not been submitted yet.' } : prev)
          setStep('done')
        } catch (storageError) {
          setSubmissionState('error')
          setSubmissionError(storageError instanceof Error ? storageError.message : 'Unable to save a local draft.')
          setStep('result')
        }
      } else {
        setSubmissionState('error')
        setSubmissionError(error instanceof Error ? error.message : 'Unable to submit. Your complaint remains in this form.')
        setStep('result')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-background shadow-xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="font-display text-lg font-extrabold text-charcoal">
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
          {(step === 'compose' || step === 'analyzing') && (
            <div className="space-y-4">
              <button
                onClick={toggleVoice}
                className={cn(
                  'flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed py-6 text-terracotta transition-colors',
                  isListening
                    ? 'border-terracotta bg-terracotta/15'
                    : 'border-terracotta/50 bg-terracotta/5 hover:bg-terracotta/10',
                )}
                aria-label="Record your complaint by voice"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-terracotta text-cream shadow-sm">
                  <Mic className={cn('h-6 w-6', isListening && 'animate-pulse')} />
                </span>
                <span className="text-sm font-semibold">
                  {isListening ? 'Listening… speak now' : 'Tap to record'}
                </span>
              </button>

              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setDistinctFromId(''); setForceDistinctId('') }}
                rows={3}
                placeholder="e.g. Station road ki light 15 din se band hai..."
                className="w-full resize-none rounded-xl border border-border bg-card p-3 text-sm text-charcoal outline-none placeholder:text-charcoal/40 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20"
              />

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-charcoal/65">PIN code
                  <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} required className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-charcoal outline-none focus:border-terracotta" />
                </label>
                <label className="text-xs font-semibold text-charcoal/65">Locality / ward
                  <input value={locality} onChange={(event) => setLocality(event.target.value.slice(0, 120))} required className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-charcoal outline-none focus:border-terracotta" />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {LANGS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
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

              <div className="grid grid-cols-3 gap-2">
                {[
                  [Camera, 'Add Proof', () => fileInputRef.current?.click()],
                  [MapPin, 'Location', handleLocationCapture],
                  [Phone, 'Call CivicChai', handleCallCivicChai],
                ].map(([Icon, label, onClick], i) => {
                  const I = Icon as React.ElementType
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={onClick as () => void}
                      className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-3 text-xs font-medium text-charcoal/70 hover:border-chai/40"
                    >
                      <I className="h-4 w-4 text-chai" />
                      {label as string}
                    </button>
                  )
                })}
              </div>

              {(proofUrls.length > 0 || locationLabel) && (
                <div className="space-y-2 rounded-xl border border-dashed border-border bg-card p-3">
                  {proofUrls.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {proofUrls.map((url, index) => (
                        url.startsWith('data:video/') ? <video
                          key={`${url}-${index}`}
                          src={url}
                          aria-label={`Complaint proof video ${index + 1}`}
                          controls
                          className="h-16 w-28 rounded-lg object-cover"
                        /> : <img
                          key={`${url}-${index}`}
                          src={url}
                          alt={`Complaint proof ${index + 1}`}
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {locationLabel && (
                    <p className="text-xs text-charcoal/60">Location: {locationLabel}</p>
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
              <div className="flex items-center justify-center gap-3 text-center text-xs text-charcoal/50">
                <span>Offline drafts stay on this device until connection returns.</span>
                <PwaInstallButton className="inline-flex items-center gap-1 font-semibold text-chai" />
              </div>
            </div>
          )}

          {step === 'result' && analysis && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-chai">
                <Sparkles className="h-4 w-4" />
                AI ne problem samajh li
              </div>
              <dl className="rounded-2xl border border-border bg-card p-4 text-sm">
                {[
                  ['Language', analysis.language],
                  ['Category', analysis.category],
                  ['Issue', analysis.issue],
                  ['Location', `${analysis.locality}, PIN ${analysis.pin}`],
                  ['Department', analysis.department],
                  ['Priority', analysis.priority],
                  ['Priority score', `${analysis.priorityScore}/100`],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between border-b border-border py-2 last:border-0"
                  >
                    <dt className="text-charcoal/60">{k}</dt>
                    <dd className="font-semibold text-charcoal">{v}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <dt className="text-charcoal/60">Report confidence</dt>
                  <dd className="rounded-md bg-leaf/15 px-2 py-0.5 font-semibold text-leaf">
                    {analysis.confidence}%
                  </dd>
                </div>
              </dl>
              <button
                onClick={submitReport}
                disabled={isSubmitting}
                className="w-full rounded-xl bg-chai px-4 py-3 text-sm font-semibold text-cream disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting...' : 'Create report'}
              </button>
            </div>
          )}

          {step === 'duplicate' && analysis?.duplicateIssue && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
                <p className="font-display font-bold text-charcoal">
                  Arre, yeh Chai pehle se chal rahi hai!
                </p>
                <p className="mt-1 text-sm text-charcoal/70">
                  We found a similar civic issue nearby.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="font-display font-bold text-charcoal">
                  {analysis.duplicateIssue.title}
                </p>
                <p className="text-xs text-charcoal/60">
                  PIN {analysis.duplicateIssue.pin} &middot; {analysis.duplicateIssue.status}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <ChaiHeatMeter heat={analysis.duplicateIssue.chaiHeat} size="sm" />
                  <span className="text-xs text-charcoal/60">
                    {analysis.duplicateIssue.reports} reports &middot; {analysis.duplicateIssue.supporters} supporters
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!user) {
                    setSubmissionError('Sign in to add support to an existing issue.')
                    return
                  }
                  void civicFetch(`/api/issues/${analysis.duplicateIssue!.id}/support`, { method: 'POST' }).then(async (response) => {
                    const data = await response.json()
                    if (!response.ok) throw new Error(data.error ?? 'Unable to support this issue.')
                    setSubmittedIssue(data.issue)
                    setSubmissionState('submitted')
                    setAnalysis((prev) => prev ? { ...prev, summary: `Support added to ${data.issue.documentId}. This report is now part of the community issue.` } : prev)
                    setStep('done')
                  }).catch((error) => setSubmissionError(error instanceof Error ? error.message : 'Unable to support this issue.'))
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-heat px-4 py-3 text-sm font-semibold text-heat-foreground"
              >
                <Flame className="h-4 w-4" />
                Is Charcha ko Support Karo
              </button>
              {!user && <p className="text-center text-xs text-charcoal/60">Please <Link href="/login" className="font-semibold text-chai underline">sign in</Link> to add account-linked support.</p>}
              {submissionError && <p role="alert" className="text-xs text-heat">{submissionError}</p>}
              <button
                onClick={() => { setDistinctFromId(analysis.duplicateIssue!.id); setForceDistinctId(analysis.duplicateIssue!.id); setStep('compose'); setSubmissionError('You marked the suggested issue as different. Create a separate report to record that decision.') }}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-charcoal"
              >
                Yeh alag problem hai
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 py-6 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf/15 text-leaf">
                <Check className="h-8 w-8" />
              </span>
              <div>
                <p className="font-display text-lg font-extrabold text-charcoal">
                  {submissionState === 'queued' ? 'Draft saved on this device' : submissionState === 'error' ? 'Report not submitted yet' : 'Charcha shuru ho gayi!'}
                </p>
                <p className="mt-1 text-sm text-charcoal/60">
                  {analysis ? analysis.summary : 'Your support was added. Track it in My Charcha.'}
                </p>
              </div>
              <p className="font-mono text-sm font-semibold text-chai">{submittedIssue?.documentId ?? documentId}</p>
              {submittedIssue && !submittedIssue.id.startsWith('draft-') && <Link href={`/issues/${encodeURIComponent(submittedIssue.id)}`} className="inline-flex w-full justify-center rounded-xl border border-chai/30 bg-chai/5 px-4 py-3 text-sm font-semibold text-chai">Open structured public report</Link>}
              <button
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
