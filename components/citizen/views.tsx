'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { IssueRecord } from '@/lib/types'
import { fetchIssuesWithCache } from '@/lib/offline-cache'
import { civicFetch, submitIssuePayload } from '@/lib/client-api'
import { listOfflineDrafts, syncOfflineDrafts, type OfflineIssueDraft } from '@/lib/offline-queue'
import { useAuth } from '@/components/auth-provider'
import { useLanguage } from '@/components/language-provider'
import { ChaiCard } from '@/components/brand/chai-card'
import { ChaiHeatMeter } from '@/components/brand/chai-heat-meter'
import { CivicTimeline } from '@/components/brand/civic-timeline'
import { StatusBadge, PriorityBadge } from '@/components/brand/badges'
import {
  MapPin,
  Bell,
  Globe,
  Shield,
  Accessibility,
  HelpCircle,
  ChevronRight,
  Check,
} from 'lucide-react'

/* ---------------- Local Chai (Home feed) ---------------- */
export function LocalChaiView() {
  const { user } = useAuth()
  const [issues, setIssues] = useState<IssueRecord[]>([])
  const [pin, setPin] = useState('')
  const [locality, setLocality] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadArea = async () => {
      if (user?.demo || !user) {
        try { const saved = localStorage.getItem(`civicchai_profile_settings:${user?.id ?? 'guest'}`); if (saved) { const parsed = JSON.parse(saved); if (!cancelled) { setPin(parsed.preferred_pin ?? ''); setLocality(parsed.locality ?? '') } } } catch {}
      } else {
        try { const response = await civicFetch('/api/profile'); const payload = await response.json(); if (!cancelled && payload.profile) { setPin(payload.profile.preferred_pin ?? ''); setLocality(payload.profile.locality ?? '') } } catch {}
      }
    }
    void loadArea()
    return () => { cancelled = true }
  }, [user?.id, user?.demo])

  useEffect(() => {
    let cancelled = false
    const cacheKey = `civicchai:issues:v2:${pin || 'all'}`
    fetchIssuesWithCache(async () => {
      const res = await fetch(`/api/public/issues${pin ? `?pin=${encodeURIComponent(pin)}` : ''}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    }, cacheKey).then((cachedIssues) => {
      if (!cancelled && Array.isArray(cachedIssues) && cachedIssues.length > 0) {
        setIssues(cachedIssues as IssueRecord[])
      }
    }).catch(() => {
      if (!cancelled) setIssues([])
    })

    return () => {
      cancelled = true
    }
  }, [pin])

  return (
    <div className="space-y-6">
      {!pin && <p className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm text-charcoal/70">{locality ? `Your saved locality is ${locality}. ` : ''}Add your six-digit PIN and locality in Profile to make this feed local.</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {issues.map((issue) => (
          <ChaiCard key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  )
}

/* ---------------- Chai Tapri (trending) ---------------- */
const TABS = ['Hottest', 'Rising', 'Nearby', 'Unresolved'] as const

export function ChaiTapriView() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Hottest')
  const [issues, setIssues] = useState<Array<IssueRecord & { recentReports?: number; recentSupport?: number }>>([])
  const [pin, setPin] = useState('')
  const [locality, setLocality] = useState('')
  const { user } = useAuth()

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        if (user?.demo || !user) {
          const saved = localStorage.getItem(`civicchai_profile_settings:${user?.id ?? 'guest'}`)
          if (saved) { const parsed = JSON.parse(saved); if (!cancelled) { setPin(parsed.preferred_pin ?? ''); setLocality(parsed.locality ?? '') } }
        } else {
          const profile = await civicFetch('/api/profile').then((response) => response.ok ? response.json() : null)
          if (!cancelled && profile?.profile) { setPin(profile.profile.preferred_pin ?? ''); setLocality(profile.profile.locality ?? '') }
        }
        const response = await fetch('/api/public/trending')
        if (!response.ok) throw new Error('Failed')
        const payload = await response.json()
        if (!cancelled) setIssues(Array.isArray(payload.issues) ? payload.issues : [])
      } catch { if (!cancelled) setIssues([]) }
    }
    void load()

    return () => {
      cancelled = true
    }
  }, [user?.id, user?.demo])

  const base = tab === 'Nearby' ? pin ? issues.filter((issue) => issue.pin === pin) : [] : issues
  const selected = tab === 'Unresolved' ? base.filter((issue) => !['Resolved', 'Community Verified', 'Closed', 'Duplicate'].includes(issue.status)) : base
  const ranked = [...selected].sort((a, b) => {
    if (tab === 'Rising') return ((b.recentReports ?? 0) * 2 + (b.recentSupport ?? 0)) - ((a.recentReports ?? 0) * 2 + (a.recentSupport ?? 0)) || b.createdAt.localeCompare(a.createdAt)
    if (tab === 'Hottest') return ((b.priorityScore ?? 0) * 0.45 + b.chaiHeat * 0.35 + Math.log2(b.reports + 1) * 5) - ((a.priorityScore ?? 0) * 0.45 + a.chaiHeat * 0.35 + Math.log2(a.reports + 1) * 5)
    return b.createdAt.localeCompare(a.createdAt)
  })
  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t
                ? 'border-heat bg-heat text-heat-foreground'
                : 'border-border bg-card text-charcoal/70',
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Nearby' && !pin && <p className="rounded-xl bg-gold/10 p-3 text-sm text-charcoal/70">Save your six-digit PIN in Profile to view nearby issues. {locality ? `Saved locality: ${locality}.` : ''}</p>}
      <ol className="space-y-3">
        {ranked.map((issue, i) => (
          <li
            key={issue.id}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm md:flex-row md:items-center"
          >
            <div className="flex min-w-[56px] items-center justify-center">
              <span className="font-display text-3xl font-extrabold text-charcoal/20">
                {i + 1}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/issues/${encodeURIComponent(issue.id)}`} className="truncate font-display text-xl font-bold text-charcoal hover:text-chai hover:underline">
                  {issue.title}
                </Link>
                <PriorityBadge priority={issue.priority} />
              </div>
              <p className="mt-1 text-sm text-charcoal/60">
                {issue.department} · PIN {issue.pin} · {issue.locality}
              </p>
            </div>
            <div className="flex items-center gap-3 md:justify-end">
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-charcoal/45">
                  Heat
                </p>
                <p className="font-display text-xl font-extrabold text-heat">{issue.chaiHeat}</p>
              </div>
              <ChaiHeatMeter heat={issue.chaiHeat ?? 0} size="sm" showLabel={false} />
            </div>
            {tab === 'Rising' && <p className="text-xs text-charcoal/55">7-day activity: {issue.recentReports ?? 0} reports · {issue.recentSupport ?? 0} supports</p>}
          </li>
        ))}
        {ranked.length === 0 && <li className="rounded-xl border border-dashed border-border p-5 text-sm text-charcoal/55">No issues match this view in the current public feed.</li>}
      </ol>
    </div>
  )
}

/* ---------------- My Charcha ---------------- */
const MY_TABS = ['Filed', 'Tracking', 'Upvoted', 'Followed', 'Resolved'] as const

export function MyCharchaView() {
  const { user } = useAuth()
  const [tab, setTab] = useState<(typeof MY_TABS)[number]>('Tracking')
  const [issues, setIssues] = useState<IssueRecord[]>([])
  const [active, setActive] = useState<IssueRecord | null>(null)
  const [drafts, setDrafts] = useState<OfflineIssueDraft[]>([])
  const [syncing, setSyncing] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState('')
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [notifications, setNotifications] = useState<Array<{ id: string; issue_id: string | null; title: string; body: string; read_at: string | null; created_at: string }>>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  async function refreshMyChai() {
    setDrafts(await listOfflineDrafts())
    if (navigator.onLine) {
      setSyncing(true)
      await syncOfflineDrafts(async (payload) => {
        return submitIssuePayload(payload)
      })
      setDrafts(await listOfflineDrafts())
      setSyncing(false)
    }
    const response = await civicFetch('/api/me/issues')
    if (response.ok) {
      const payload = await response.json()
      const myIssues = Array.isArray(payload.issues) ? payload.issues as IssueRecord[] : []
      setIssues(myIssues)
      setActive((current) => current ? myIssues.find((issue) => issue.id === current.id) ?? myIssues[0] ?? null : myIssues[0] ?? null)
    }
    const notificationResponse = await civicFetch('/api/notifications')
    if (notificationResponse.ok) {
      const payload = await notificationResponse.json()
      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : [])
    }
  }

  useEffect(() => {
    let cancelled = false
    void refreshMyChai().catch(() => { if (!cancelled) setIssues([]) })
    const onOnline = () => { void refreshMyChai() }
    window.addEventListener('online', onOnline)

    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
    }
  }, [user?.id])

  const filteredIssues = issues.filter((issue) => {
    if (tab === 'Filed') return issue.myRelationship === 'filed'
    if (tab === 'Upvoted') return issue.myRelationship === 'supported'
    if (tab === 'Followed') return issue.myRelationship === 'followed'
    if (tab === 'Resolved') return ['Resolved', 'Community Verified', 'Closed'].includes(issue.status)
    return true
  })

  const activeIssue = active ?? filteredIssues[0] ?? null

  async function markNotificationsRead() {
    const response = await civicFetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mark_all: true }) })
    const payload = await response.json()
    if (response.ok) setNotifications(Array.isArray(payload.notifications) ? payload.notifications : [])
  }

  async function verifyResolution(action: 'confirm' | 'reopen') {
    if (!activeIssue) return
    setVerificationBusy(true); setVerificationMessage('')
    try {
      const response = await civicFetch(`/api/issues/${activeIssue.id}/verification`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Unable to record your response.')
      setIssues((current) => current.map((issue) => issue.id === payload.issue.id ? payload.issue : issue))
      setActive(payload.issue)
      setVerificationMessage(action === 'confirm' ? 'Thank you. The community confirmed this resolution.' : 'The report was reopened for follow-up.')
    } catch (error) { setVerificationMessage(error instanceof Error ? error.message : 'Unable to record your response.') } finally { setVerificationBusy(false) }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <button onClick={() => setNotificationsOpen((open) => !open)} aria-expanded={notificationsOpen} className="flex items-center gap-2 text-sm font-semibold"><Bell className="h-4 w-4 text-chai" />Notifications {notifications.some((item) => !item.read_at) && <span className="rounded-full bg-terracotta px-2 py-0.5 text-[10px] font-bold text-cream">{notifications.filter((item) => !item.read_at).length}</span>}</button>
          <div className="flex items-center gap-3"><span className="text-xs text-charcoal/50">Issue status and community verification updates</span>{notifications.some((item) => !item.read_at) && <button onClick={() => void markNotificationsRead()} className="inline-flex items-center gap-1 text-xs font-semibold text-chai"><Check className="h-3.5 w-3.5" />Mark all read</button>}</div>
        </div>
        {notificationsOpen && <div className="space-y-2 border-t border-border p-4">{notifications.length ? notifications.map((item) => <article key={item.id} className={`rounded-xl p-3 ${item.read_at ? 'bg-muted/60' : 'bg-gold/10'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-relaxed text-charcoal/65">{item.body}</p>{item.issue_id && <Link href={`/issues/${encodeURIComponent(item.issue_id)}`} className="mt-1 inline-block text-xs font-semibold text-chai underline">Open report</Link>}</div><time className="shrink-0 text-[10px] text-charcoal/45">{new Date(item.created_at).toLocaleDateString('en-IN')}</time></div></article>) : <p className="text-sm text-charcoal/55">No status notifications yet.</p>}</div>}
      </section>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {MY_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t
                ? 'border-chai bg-chai text-cream'
                : 'border-border bg-card text-charcoal/70',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {drafts.length > 0 && <section className="rounded-2xl border border-gold/50 bg-gold/10 p-4" aria-live="polite">
        <div className="flex items-center justify-between gap-3"><h3 className="font-display font-bold text-charcoal">Pending sync on this device</h3><span className="text-xs text-charcoal/60">{syncing ? 'Syncing…' : `${drafts.length} ${drafts.length === 1 ? 'draft' : 'drafts'}`}</span></div>
        <ul className="mt-3 space-y-2">{drafts.map((draft) => <li key={draft.id} className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{draft.payload.title}</span><span className="text-xs text-charcoal/55">PIN {draft.payload.pin} · {draft.payload.locality}</span></span><span className="shrink-0 rounded-full bg-gold/20 px-2 py-1 text-[11px] font-semibold">Pending sync</span></li>)}</ul>
      </section>}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-2">
          {filteredIssues.slice(0, 20).map((issue) => (
            <button
              key={issue.id}
              onClick={() => setActive(issue)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors',
                activeIssue?.id === issue.id ? 'border-chai shadow-sm' : 'border-border',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-charcoal/50">{issue.id}</p>
                <p className="truncate font-display font-bold text-charcoal">
                  {issue.title}
                </p>
                <div className="mt-1">
                  <StatusBadge status={issue.status} />
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-charcoal/40" />
            </button>
          ))}
          {filteredIssues.length === 0 && <p className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-charcoal/60">{user ? 'No issues in this view yet.' : 'Sign in to see the reports and issues you support.'}</p>}
        </div>

        {activeIssue ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="font-mono text-xs text-charcoal/50">{activeIssue.documentId}</p>
            <Link href={`/issues/${encodeURIComponent(activeIssue.id)}`} className="mt-1 inline-block font-display text-xl font-bold text-charcoal hover:text-chai hover:underline">{activeIssue.title}</Link>
            <p className="mt-2 text-sm leading-relaxed text-charcoal/70">{activeIssue.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={activeIssue.status} />
              <PriorityBadge priority={activeIssue.priority} />
            </div>
            <div className="mt-6">
              <CivicTimeline status={activeIssue.status} issueId={activeIssue.id} />
            </div>
            {user?.role === 'citizen' && activeIssue.myRelationship && ['Resolved', 'Community Verified'].includes(activeIssue.status) && <div className="mt-5 rounded-xl border border-gold/40 bg-gold/10 p-4"><p className="text-sm font-semibold text-charcoal">Did the authority resolve this issue?</p><p className="mt-1 text-xs text-charcoal/60">Your response becomes part of the public status history and audit trail.</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={verificationBusy || activeIssue.status === 'Community Verified'} onClick={() => void verifyResolution('confirm')} className="rounded-lg bg-leaf px-3 py-2 text-xs font-semibold text-cream disabled:opacity-50">Confirm resolved</button><button disabled={verificationBusy} onClick={() => void verifyResolution('reopen')} className="rounded-lg border border-terracotta/40 px-3 py-2 text-xs font-semibold text-terracotta disabled:opacity-50">Still unresolved</button></div>{verificationMessage && <p role="status" className="mt-2 text-xs text-charcoal/70">{verificationMessage}</p>}</div>}
            <div className="mt-5 rounded-xl bg-secondary/50 p-4 text-sm">
              <p className="font-semibold text-charcoal">What happens next</p>
              <p className="mt-1 text-charcoal/65">The suggested department is {activeIssue.department}. Assignment and service targets are shown only when the responsible authority has configured them. CivicChai provides tracking and education; it is not a statutory appeal body.</p>
              <Link href={`/issues/${encodeURIComponent(activeIssue.id)}`} className="mt-2 inline-block text-xs font-semibold text-chai underline">Open the structured report for verified jurisdiction contacts and references</Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-charcoal/60">
            No issues are available in the live feed yet.
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Profile ---------------- */
export function ProfileView() {
  const { user } = useAuth()
  const { language, setLanguage } = useLanguage()
  const [profile, setProfile] = useState({ display_name: user?.name ?? '', city: '', ward: '', locality: '', preferred_pin: '', notification_preferences: { in_app: true, email: false }, consent_preferences: { online_ai: false, device_location: false, offline_storage: false } })
  const [issues, setIssues] = useState<IssueRecord[]>([])
  const [requests, setRequests] = useState<Array<Record<string, string>>>([])
  const [moderationReports, setModerationReports] = useState<Array<Record<string, any>>>([])
  const [appealTarget, setAppealTarget] = useState('')
  const [appealDetails, setAppealDetails] = useState('')
  const [requestType, setRequestType] = useState('access')
  const [requestDetails, setRequestDetails] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let cancelled = false
    const localKey = `civicchai_profile_settings:${user?.id ?? 'guest'}`
    try {
      const stored = localStorage.getItem(localKey)
      if (stored && !cancelled) setProfile((current) => ({ ...current, ...JSON.parse(stored) }))
    } catch {}
    if (!user?.demo) {
      civicFetch('/api/profile').then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load profile.'))).then((payload) => {
        if (!cancelled && payload.profile) setProfile((current) => ({ ...current, ...payload.profile }))
      }).catch(() => {})
    }
    civicFetch('/api/me/issues').then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load activity.'))).then((payload) => {
      if (!cancelled) setIssues(Array.isArray(payload.issues) ? payload.issues : [])
    }).catch(() => {})
    civicFetch('/api/privacy-requests').then((response) => response.ok ? response.json() : Promise.reject(new Error(''))).then((payload) => {
      if (!cancelled) setRequests(Array.isArray(payload.requests) ? payload.requests : [])
    }).catch(() => {})
    civicFetch('/api/me/moderation-reports').then((response) => response.ok ? response.json() : Promise.reject(new Error(''))).then((payload) => {
      if (!cancelled) setModerationReports(Array.isArray(payload.reports) ? payload.reports : [])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [user?.id])
  const filedCount = issues.filter((issue) => issue.myRelationship === 'filed').length
  const supportedCount = issues.filter((issue) => issue.myRelationship === 'supported').length
  const resolvedCount = issues.filter((issue) => ['Resolved', 'Community Verified', 'Closed'].includes(issue.status)).length
  const preferenceCards = [
    { Icon: Globe, title: 'Language', text: 'Choose English, Hindi or Marathi above.' },
    { Icon: Shield, title: 'Privacy', text: 'Use separate per-report consent for cloud AI, location and offline drafts.' },
    { Icon: Accessibility, title: 'Accessibility', text: 'Keyboard, screen-reader and voice/keypad workflows are supported.' },
  ]

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setNotice('')
    const payload = { ...profile, preferred_language: language }
    try {
      if (user?.demo || !user) {
        localStorage.setItem(`civicchai_profile_settings:${user?.id ?? 'guest'}`, JSON.stringify(payload))
      } else {
        const response = await civicFetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Unable to save profile.')
        setProfile((current) => ({ ...current, ...data.profile }))
      }
      setNotice('Profile and preferences saved.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save profile.') } finally { setSaving(false) }
  }

  async function sendPrivacyRequest(event: React.FormEvent) {
    event.preventDefault(); setNotice('')
    try {
      const response = await civicFetch('/api/privacy-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_type: requestType, details: requestDetails }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Unable to send your request.')
      setRequests((current) => [data.request, ...current])
      setRequestDetails('')
      setNotice(`Privacy request ${data.request.id} recorded.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to send your request.') }
  }

  async function sendModerationAppeal(event: React.FormEvent) {
    event.preventDefault()
    try {
      const response = await civicFetch('/api/me/moderation-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: appealTarget, details: appealDetails }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Unable to appeal this moderation decision.')
      setModerationReports((current) => current.map((item) => item.id === data.report.id ? data.report : item))
      setAppealTarget(''); setAppealDetails(''); setNotice('Your moderation appeal has been recorded for review.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to appeal this moderation decision.') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-5 rounded-2xl border border-border bg-card p-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-terracotta/15 font-display text-2xl font-extrabold text-terracotta">
          {(profile.display_name || user?.name || 'C').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
        </span>
        <div>
          <p className="font-display text-xl font-extrabold text-charcoal">
            {profile.display_name || user?.name || 'Guest citizen'}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-charcoal/60">
            <MapPin className="h-3.5 w-3.5" /> {[profile.locality, profile.ward, profile.city].filter(Boolean).join(' · ') || 'Set your locality to personalize your feed'}
          </p>
          {user && <p className="mt-1 text-xs text-charcoal/45">{user.email} · {user.role.replaceAll('_', ' ')}</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-chai p-6 text-cream">
        <p className="text-xs uppercase tracking-widest text-cream/60">
          Your Civic Impact
        </p>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          {[
            [filedCount.toLocaleString('en-IN'), 'Reports filed'],
            [supportedCount.toLocaleString('en-IN'), 'Issues supported'],
            [resolvedCount.toLocaleString('en-IN'), 'Issues resolved'],
          ].map(([v, k]) => (
            <div key={k} className="rounded-xl bg-cream/10 p-3">
              <p className="font-display text-3xl font-extrabold text-gold">{v}</p>
              <p className="mt-1 text-xs text-cream/70">{k}</p>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={saveProfile} className="space-y-5 rounded-2xl border border-border bg-card p-6">
        <div><h2 className="font-display text-lg font-bold">Profile & preferences</h2><p className="mt-1 text-xs text-charcoal/55">Your saved area helps prioritize nearby issues. PIN is confirmed for each report and is not inferred from your profile.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-charcoal/65">Display name<input value={profile.display_name} onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} maxLength={80} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-charcoal" /></label>
          <label className="text-xs font-semibold text-charcoal/65">Preferred language<select value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'hi' | 'mr')} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-charcoal"><option value="en">English</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option></select></label>
          <label className="text-xs font-semibold text-charcoal/65">City<input value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} maxLength={120} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-charcoal" /></label>
          <label className="text-xs font-semibold text-charcoal/65">Ward<input value={profile.ward} onChange={(event) => setProfile({ ...profile, ward: event.target.value })} maxLength={100} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-charcoal" /></label>
          <label className="text-xs font-semibold text-charcoal/65">Preferred service-area PIN<input value={profile.preferred_pin} onChange={(event) => setProfile({ ...profile, preferred_pin: event.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-charcoal" /></label>
          <label className="text-xs font-semibold text-charcoal/65 sm:col-span-2">Locality<input value={profile.locality} onChange={(event) => setProfile({ ...profile, locality: event.target.value })} maxLength={120} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-charcoal" /></label>
        </div>
        <fieldset className="space-y-2"><legend className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">Notifications</legend>{(['in_app', 'email'] as const).map((key) => <label key={key} className="flex items-center gap-2 text-sm text-charcoal/70"><input type="checkbox" checked={Boolean(profile.notification_preferences?.[key])} onChange={(event) => setProfile({ ...profile, notification_preferences: { ...profile.notification_preferences, [key]: event.target.checked } })} />{key === 'in_app' ? 'In-app status updates' : 'Email status updates (when email delivery is configured)'}</label>)}</fieldset>
        <fieldset className="space-y-2"><legend className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">Optional processing choices</legend>{([['online_ai', 'Allow optional cloud AI for complaint classification'], ['device_location', 'Allow device coordinates on a report when I explicitly attach them'], ['offline_storage', 'Allow pending report drafts to be stored on this device']] as const).map(([key, label]) => <label key={key} className="flex items-start gap-2 text-sm text-charcoal/70"><input type="checkbox" checked={Boolean(profile.consent_preferences?.[key])} onChange={(event) => setProfile({ ...profile, consent_preferences: { ...profile.consent_preferences, [key]: event.target.checked } })} className="mt-1" />{label}</label>)}</fieldset>
        {notice && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{notice}</p>}
        <button disabled={saving} className="rounded-lg bg-chai px-4 py-2.5 text-sm font-semibold text-cream disabled:opacity-50">{saving ? 'Saving…' : 'Save preferences'}</button>
      </form>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6"><div><h2 className="font-display text-lg font-bold">Privacy & data rights</h2><p className="mt-1 text-sm leading-relaxed text-charcoal/65">CivicChai uses your profile, report text, selected location, evidence and discussion activity to route and track civic issues. You can request access, correction, erasure or raise a privacy grievance. Requests are recorded for review by the configured platform administrator.</p></div><form onSubmit={sendPrivacyRequest} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]"><label className="text-xs font-semibold text-charcoal/65">Request<select value={requestType} onChange={(event) => setRequestType(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"><option value="access">Access my data</option><option value="correction">Correct my data</option><option value="erasure">Request erasure</option><option value="grievance">Privacy grievance</option></select></label><label className="text-xs font-semibold text-charcoal/65">Details<textarea value={requestDetails} onChange={(event) => setRequestDetails(event.target.value)} maxLength={2000} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal" /></label><button className="self-end rounded-lg border border-chai px-4 py-2 text-sm font-semibold text-chai">Send request</button></form>{requests.length > 0 && <ul className="space-y-2">{requests.map((request) => <li key={request.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-xs"><span>{request.request_type} · {new Date(request.created_at).toLocaleDateString()}</span><span className="font-semibold uppercase">{request.status}</span>{request.response_note && <span className="w-full text-charcoal/65">{request.response_note}</span>}</li>)}</ul>}<p className="text-[11px] leading-relaxed text-charcoal/45">The connected deployment must set its retention schedule and grievance contact. Avoid including sensitive information in free-text details.</p></section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-6"><div><h2 className="font-display text-lg font-bold">Content reports & appeals</h2><p className="mt-1 text-sm text-charcoal/60">Track your reports about issues or comments. If a report was actioned or dismissed, you can ask for a review.</p></div>{moderationReports.length ? moderationReports.map((report) => <article key={report.id} className="rounded-xl bg-muted/70 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold capitalize">{report.reason?.replaceAll('_', ' ') ?? 'Content report'}</p><span className="text-xs font-semibold uppercase text-charcoal/55">{report.status}</span></div><p className="mt-1 text-xs text-charcoal/55">Submitted {new Date(report.created_at).toLocaleDateString('en-IN')} · reference {String(report.id).slice(0, 12)}</p>{report.moderator_note && <p className="mt-2 text-xs text-charcoal/70">Moderator response: {report.moderator_note}</p>}{report.appeal_details && <p className="mt-2 text-xs text-charcoal/70">Appeal: {report.appeal_details}</p>}{['actioned', 'dismissed'].includes(report.status) && <button onClick={() => setAppealTarget(report.id)} className="mt-2 text-xs font-semibold text-chai underline">Appeal this decision</button>}{appealTarget === report.id && <form onSubmit={sendModerationAppeal} className="mt-3 space-y-2"><label className="block text-xs font-medium">Why should this decision be reviewed?<textarea required minLength={5} maxLength={2000} rows={3} value={appealDetails} onChange={(event) => setAppealDetails(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm" /></label><div className="flex gap-2"><button className="rounded-lg bg-chai px-3 py-2 text-xs font-semibold text-cream">Send appeal</button><button type="button" onClick={() => { setAppealTarget(''); setAppealDetails('') }} className="rounded-lg border border-border px-3 py-2 text-xs">Cancel</button></div></form>}</article>) : <p className="text-sm text-charcoal/55">No content reports are attached to this account yet.</p>}</section>
      <div className="grid gap-3 sm:grid-cols-3">{preferenceCards.map(({ Icon, title, text }) => <div key={title} className="rounded-xl border border-border bg-card p-4"><p className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-chai" />{title}</p><p className="mt-2 text-xs leading-relaxed text-charcoal/60">{text}</p></div>)}</div>
    </div>
  )
}
