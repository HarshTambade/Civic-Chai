'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { useAuth } from '@/components/auth-provider'
import { civicFetch } from '@/lib/client-api'
import { ROLE_LABELS, canAudit, canManageIssues, canManageRegistry, canModerate } from '@/lib/roles'
import {
  OverviewView,
  ComplaintsView,
  GISView,
  AnalyticsView,
  RegistryView,
  AuditView,
  ModerationView,
  PrivacyRequestsView,
} from '@/components/gov/control-room-views'
import {
  LayoutDashboard,
  ListChecks,
  Map,
  ChartColumn,
  ShieldCheck,
  Bell,
  Check,
  ArrowLeft,
  LogOut,
} from 'lucide-react'

type Tab = 'overview' | 'complaints' | 'gis' | 'analytics' | 'registry' | 'audit' | 'moderation' | 'privacy'

const ALL_NAV: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'complaints', label: 'Complaints', icon: ListChecks },
  { id: 'gis', label: 'Chai Heat Map', icon: Map },
  { id: 'analytics', label: 'Analytics', icon: ChartColumn },
  { id: 'registry', label: 'Registry', icon: ShieldCheck },
  { id: 'audit', label: 'Audit', icon: Bell },
  { id: 'moderation', label: 'Moderation', icon: Bell },
  { id: 'privacy', label: 'Privacy requests', icon: ShieldCheck },
]

const TITLES: Record<Tab, { title: string; sub: string }> = {
  overview: { title: 'Control Room', sub: 'Live civic operations across the ward' },
  complaints: { title: 'Complaints', sub: 'Normalized, prioritized, de-duplicated' },
  gis: { title: 'Chai Heat Map', sub: 'Privacy-preserving geographic hotspots' },
  analytics: { title: 'Analytics', sub: 'Resolution performance & SLA trends' },
  registry: { title: 'Officer Registry', sub: 'Authority, hub and contact routing' },
  audit: { title: 'Audit & Compliance', sub: 'Status history, access logs and governance trail' },
  moderation: { title: 'Moderation', sub: 'User reports, content review and appeals' },
  privacy: { title: 'Privacy requests', sub: 'Data-rights and privacy grievance handling' },
}

export function ControlRoom() {
  const [tab, setTab] = useState<Tab>('overview')
  const { logout, user } = useAuth()
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; issue_id: string | null; read_at: string | null; created_at: string }>>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const head = TITLES[tab]
  useEffect(() => {
    let cancelled = false
    civicFetch('/api/notifications').then((response) => response.ok ? response.json() : null).then((payload) => {
      if (!cancelled) setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : [])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [user?.id])

  async function markAllNotificationsRead() {
    const response = await civicFetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mark_all: true }) })
    const payload = await response.json()
    if (response.ok) setNotifications(Array.isArray(payload.notifications) ? payload.notifications : [])
  }
  const visibleNav = ALL_NAV.filter((item) => {
    const role = user?.role
    if (!role) return false
    if (item.id === 'registry') return canManageRegistry(role)
    if (item.id === 'audit') return canAudit(role)
    if (item.id === 'moderation') return canModerate(role)
    if (item.id === 'privacy') return role === 'system_admin'
    if (item.id === 'overview') return role === 'system_admin' || canManageIssues(role) || canAudit(role) || canModerate(role)
    if (item.id === 'complaints') return role !== 'citizen'
    if (item.id === 'gis' || item.id === 'analytics') return canManageIssues(role) || canAudit(role)
    return canManageIssues(role) || canAudit(role) || canModerate(role)
  })
  const safeTab = visibleNav.some((item) => item.id === tab) ? tab : visibleNav[0]?.id ?? 'overview'

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="flex min-h-screen bg-sidebar font-sans text-cream">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-charcoal p-4 lg:flex">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Logo showWordmark={false} className="shrink-0" />
          <div>
            <p className="font-display text-sm font-extrabold leading-tight text-cream">
              CivicChai
            </p>
            <p className="text-[11px] text-gold">Control Room</p>
          </div>
        </div>

        <nav className="mt-6 flex flex-col gap-1">
              {visibleNav.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                tab === n.id
                  ? 'bg-gold text-charcoal'
                  : 'text-cream/70 hover:bg-sidebar-accent hover:text-cream',
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-cream">
              <ShieldCheck className="h-4 w-4 text-leaf" /> RBAC active
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-cream/50">
              {user ? `${ROLE_LABELS[user.role]} · ${user.pin ? `PIN ${user.pin}` : 'jurisdiction scoped'}. Actions are recorded.` : 'Sign in required.'}
            </p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-cream/60 hover:text-cream"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-cream/60 hover:text-cream hover:bg-sidebar-accent/50 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-charcoal/90 px-5 py-3.5 backdrop-blur">
          <div>
            <h1 className="font-display text-lg font-extrabold text-cream">
              {head.title}
            </h1>
            <p className="text-xs text-cream/50">{head.sub}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
            <button
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative rounded-md border border-sidebar-border p-2 text-cream/70 hover:text-cream"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
            >
              <Bell className="h-4 w-4" />
              {notifications.some((item) => !item.read_at) && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-heat text-[10px] font-bold text-cream">{notifications.filter((item) => !item.read_at).length}</span>}
            </button>
            {notificationsOpen && <div className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-sidebar-border bg-sidebar p-3 shadow-2xl"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-cream">Notifications</p>{notifications.some((item) => !item.read_at) && <button onClick={() => void markAllNotificationsRead()} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold"><Check className="h-3.5 w-3.5" />Mark read</button>}</div><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{notifications.length ? notifications.map((item) => <article key={item.id} className={'rounded-lg p-3 ' + (item.read_at ? 'bg-sidebar-accent' : 'bg-gold/10')}><p className="text-xs font-semibold text-cream">{item.title}</p><p className="mt-1 text-[11px] leading-relaxed text-cream/60">{item.body}</p>{item.issue_id && <button onClick={() => { setTab('complaints'); setNotificationsOpen(false) }} className="mt-1 text-[10px] font-semibold text-gold underline">Open issue queue</button>}<p className="mt-1 text-[10px] text-cream/40">{new Date(item.created_at).toLocaleString()}</p></article>) : <p className="py-3 text-xs text-cream/50">No notifications yet.</p>}</div></div>}
            </div>
            <div className="flex items-center gap-2 rounded-md border border-sidebar-border px-3 py-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-xs font-bold text-charcoal">
                {(user?.name ?? 'CC').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-cream">{user?.name}</p>
                <p className="text-[10px] text-cream/50">{user ? ROLE_LABELS[user.role] : ''}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-sidebar-border bg-charcoal px-3 py-2 lg:hidden">
          {visibleNav.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
                tab === n.id
                  ? 'bg-gold text-charcoal'
                  : 'text-cream/70',
              )}
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-x-hidden p-5">
          {safeTab === 'overview' && <OverviewView />}
          {safeTab === 'complaints' && <ComplaintsView />}
          {safeTab === 'gis' && <GISView />}
          {safeTab === 'analytics' && <AnalyticsView />}
          {safeTab === 'registry' && <RegistryView />}
          {safeTab === 'audit' && <AuditView />}
          {safeTab === 'moderation' && <ModerationView />}
          {safeTab === 'privacy' && <PrivacyRequestsView />}
        </main>
      </div>
    </div>
  )
}
