'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SiteNav } from '@/components/landing/site-nav'
import { SiteFooter } from '@/components/landing/site-footer'
import { Composer } from './composer'
import {
  LocalChaiView,
  ChaiTapriView,
  MyCharchaView,
  ProfileView,
} from './views'
import { Home, Flame, ScrollText, User, Plus, ArrowRight, WifiOff } from 'lucide-react'
import { ChaiHeatMeter } from '@/components/brand/chai-heat-meter'
import { MapPin } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import type { IssueRecord } from '@/lib/types'
import { useLanguage } from '@/components/language-provider'
import { useAuth } from '@/components/auth-provider'
import { civicFetch } from '@/lib/client-api'
import { PwaInstallButton } from '@/components/pwa-install-button'

type Tab = 'home' | 'tapri' | 'charcha' | 'profile'

export function CitizenApp() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const NAV: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'home', label: t.citizenApp.tabs[0], icon: Home },
    { key: 'tapri', label: t.citizenApp.tabs[1], icon: Flame },
    { key: 'charcha', label: t.citizenApp.tabs[2], icon: ScrollText },
    { key: 'profile', label: t.citizenApp.tabs[3], icon: User },
  ]

  const [tab, setTab] = useState<Tab>('home')
  const [composerOpen, setComposerOpen] = useState(false)
  const [localHeat, setLocalHeat] = useState<number | null>(null)
  const [area, setArea] = useState({ pin: '', locality: '' })
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('report') === '1') setComposerOpen(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadArea = async () => {
      if (user?.demo || !user) {
        try { const saved = localStorage.getItem(`civicchai_profile_settings:${user?.id ?? 'guest'}`); if (saved) { const parsed = JSON.parse(saved); if (!cancelled) setArea({ pin: parsed.preferred_pin ?? '', locality: parsed.locality ?? '' }) } } catch {}
      } else {
        try { const response = await civicFetch('/api/profile'); const payload = await response.json(); if (!cancelled && payload.profile) setArea({ pin: payload.profile.preferred_pin ?? '', locality: payload.profile.locality ?? '' }) } catch {}
      }
    }
    void loadArea()
    return () => { cancelled = true }
  }, [user?.id, user?.demo])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/public/issues${area.pin ? `?pin=${encodeURIComponent(area.pin)}` : ''}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed'))))
      .then((payload) => {
        if (cancelled) return
        const issues: IssueRecord[] = Array.isArray(payload?.issues) ? payload.issues : []
        const topIssue = [...issues].sort((a, b) => (b.chaiHeat ?? 0) - (a.chaiHeat ?? 0))[0]
        setLocalHeat(topIssue ? topIssue.chaiHeat : 0)
      })
      .catch(() => {
        if (!cancelled) setLocalHeat(0)
      })

    return () => {
      cancelled = true
    }
  }, [area.pin])

  return (
    <main className="min-h-dvh bg-background pb-[calc(5.25rem+env(safe-area-inset-bottom))] text-charcoal md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-xl md:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-3 sm:gap-3 sm:px-4">
          <button type="button" onClick={() => setTab('home')} aria-label="CivicChai home" className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta">
            <Logo className="gap-2 [&>span:first-child]:h-8 [&>span:first-child]:w-8 [&>span:first-child]:rounded-lg [&>span:first-child>svg]:h-[18px] [&>span:first-child>svg]:w-[18px] [&>span:last-child]:text-base" />
          </button>
          <button type="button" onClick={() => setTab('profile')} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left active:bg-muted" aria-label="Edit your service area">
            <MapPin className="h-4 w-4 shrink-0 text-terracotta" />
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal/45">Your area</span>
              <span className="block truncate text-xs font-bold text-charcoal">{area.locality || (area.pin ? `PIN ${area.pin}` : 'Set your locality')}</span>
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <span role="status" aria-label={online ? 'You are online' : 'You are offline'} title={online ? 'You are online' : 'You are offline'} className={cn('flex h-8 w-2 items-center justify-center', online ? 'text-leaf' : 'text-heat')}>
              <span className={cn('h-2 w-2 rounded-full', online ? 'bg-leaf' : 'bg-heat')} />
            </span>
            <PwaInstallButton className="inline-flex h-9 items-center gap-1.5 rounded-full bg-chai px-2.5 text-xs font-bold text-cream shadow-sm active:scale-95" />
          </div>
        </div>
      </header>

      <div className="hidden md:block"><SiteNav /></div>

      {/* Hero banner */}
      <section className="paper-grain border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-3.5 sm:px-6 sm:py-14 lg:py-20">
          <div className="grid gap-3 sm:gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <span className="hidden items-center gap-1.5 rounded-full border border-terracotta/25 bg-terracotta/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-terracotta sm:inline-flex sm:text-xs">
                CivicChai · Your neighborhood
              </span>
              <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-charcoal sm:mt-5 sm:text-5xl sm:leading-normal lg:text-6xl">
                {t.citizenApp.title}
              </h1>
              <p className="mt-1 line-clamp-2 max-w-xl text-xs leading-relaxed text-charcoal/70 sm:mt-5 sm:text-lg">
                {t.citizenApp.subtitle}
              </p>
              <div className="mt-4 hidden flex-col gap-2.5 sm:mt-8 sm:flex sm:flex-row sm:flex-wrap sm:gap-3">
                <button
                  onClick={() => setComposerOpen(true)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-terracotta px-5 py-3 text-sm font-bold text-cream shadow-md shadow-terracotta/20 transition-transform active:scale-[0.98] sm:min-h-0 sm:rounded-xl sm:shadow-sm sm:hover:-translate-y-0.5"
                >
                  <Plus className="h-4 w-4" />
                  {t.citizenApp.primary}
                </button>
                <Link
                  href="/chai-tapri"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-chai/20 bg-card px-5 py-3 text-sm font-semibold text-chai transition-colors active:bg-chai/5 sm:min-h-0 sm:rounded-xl sm:bg-cream sm:hover:bg-chai/5"
                >
                  {t.citizenApp.secondary}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-card p-2.5 shadow-sm sm:p-6 sm:shadow-lg">
              <div className="rounded-2xl border border-white/10 bg-chai p-3 text-cream sm:p-5">
                <p className="text-xs uppercase tracking-widest text-cream/60">{t.citizenApp.yourChai}</p>
                <div className="mt-1 flex items-center justify-between gap-2 sm:mt-2">
                  <div>
                    <p className="font-display text-xl font-extrabold sm:text-3xl">{area.pin ? `PIN ${area.pin}` : 'Your local area'}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-cream/75 sm:text-sm">
                      <MapPin className="h-3.5 w-3.5" />
                      {area.locality || 'Choose your ward and PIN in Profile'}
                    </p>
                  </div>
                  <ChaiHeatMeter heat={localHeat ?? 0} size="md" showLabel={false} className="text-cream" />
                </div>
              </div>
              <p className="mt-3 hidden px-1 text-xs leading-relaxed text-charcoal/60 sm:mt-4 sm:block sm:text-sm">
                {area.pin ? t.citizenApp.feedText : 'The feed becomes locality-first after you choose your service area. Exact report locations are never used to infer where you live.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Desktop tab navigation */}
      <section className="sticky top-16 z-40 hidden border-b border-border bg-cream/90 backdrop-blur-md md:block">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            {NAV.map((n) => {
              const Icon = n.icon
              return (
                <button
                  key={n.key}
                  onClick={() => setTab(n.key)}
                  aria-current={tab === n.key ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                    tab === n.key
                      ? 'bg-chai text-cream shadow-sm'
                      : 'text-charcoal/60 hover:bg-chai/10 hover:text-chai',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </button>
              )
            })}

            <div className="ml-auto">
              <button
                onClick={() => setComposerOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-semibold text-cream shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" />
                {t.citizenApp.primary}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tab content */}
      <section className="py-4 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {tab === 'home' && <LocalChaiDesktopView />}
          {tab === 'tapri' && <ChaiTapriDesktopView />}
          {tab === 'charcha' && <MyCharchaDesktopView />}
          {tab === 'profile' && <ProfileDesktopView />}
        </div>
      </section>

      <div className="hidden md:block"><SiteFooter /></div>

      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-card/95 px-1 pt-2 shadow-[0_-8px_24px_rgba(37,33,30,0.08)] backdrop-blur-xl [padding-bottom:calc(env(safe-area-inset-bottom)+0.45rem)] md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end">
          {NAV.slice(0, 2).map((item) => {
            const Icon = item.icon
            const selected = tab === item.key
            return <button key={item.key} type="button" onClick={() => setTab(item.key)} aria-current={selected ? 'page' : undefined} className={cn('flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold active:scale-95', selected ? 'text-chai' : 'text-charcoal/50')}>
              <Icon className={cn('h-5 w-5', selected && 'fill-chai/10')} strokeWidth={selected ? 2.4 : 1.8} />
              <span>{item.label}</span>
            </button>
          })}
          <button type="button" onClick={() => setComposerOpen(true)} aria-label={t.citizenApp.primary} className="-mt-5 flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-bold text-terracotta active:scale-95">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta text-cream shadow-lg shadow-terracotta/30 ring-4 ring-card"><Plus className="h-6 w-6" strokeWidth={2.5} /></span>
            <span>Report</span>
          </button>
          {NAV.slice(2).map((item) => {
            const Icon = item.icon
            const selected = tab === item.key
            return <button key={item.key} type="button" onClick={() => setTab(item.key)} aria-current={selected ? 'page' : undefined} className={cn('flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold active:scale-95', selected ? 'text-chai' : 'text-charcoal/50')}>
              <Icon className={cn('h-5 w-5', selected && 'fill-chai/10')} strokeWidth={selected ? 2.4 : 1.8} />
              <span>{item.label}</span>
            </button>
          })}
        </div>
      </nav>

      {composerOpen && <Composer onClose={() => setComposerOpen(false)} />}
    </main>
  )
}

/* ---- Desktop wrapper views that use existing view components in full-width layouts ---- */

function LocalChaiDesktopView() {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          {t.citizenApp.feed}
        </span>
        <h2 className="mt-2 font-display text-2xl font-bold text-charcoal sm:text-3xl">
          {t.citizenApp.feedText}
        </h2>
        <p className="mt-1 text-sm text-charcoal/60">
          Browse public issues or save a service-area PIN in Profile to make this feed local.
        </p>
      </div>
      <LocalChaiView />
    </div>
  )
}

function ChaiTapriDesktopView() {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-heat">
          {t.citizenApp.trending}
        </span>
        <h2 className="mt-2 font-display text-2xl font-bold text-charcoal sm:text-3xl">
          {t.citizenApp.trendingText}
        </h2>
        <p className="mt-1 text-sm text-charcoal/60">
          Dekho kis mudde ki chai sabse garam hai.
        </p>
      </div>
      <ChaiTapriView />
    </div>
  )
}

function MyCharchaDesktopView() {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-chai">
          {t.citizenApp.discussions}
        </span>
        <h2 className="mt-2 font-display text-2xl font-bold text-charcoal sm:text-3xl">
          {t.citizenApp.tabs[2]}
        </h2>
        <p className="mt-1 text-sm text-charcoal/60">
          Track issues you've filed, are watching or have supported.
        </p>
      </div>
      <MyCharchaView />
    </div>
  )
}

function ProfileDesktopView() {
  const { t } = useLanguage()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Account
        </span>
        <h2 className="mt-2 font-display text-2xl font-bold text-charcoal sm:text-3xl">
          {t.citizenApp.profile}
        </h2>
        <p className="mt-1 text-sm text-charcoal/60">
          {t.citizenApp.profileText}
        </p>
      </div>
      <ProfileView />
    </div>
  )
}
