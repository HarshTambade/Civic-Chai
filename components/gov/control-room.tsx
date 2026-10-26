'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { useAuth } from '@/components/auth-provider'
import { civicFetch } from '@/lib/client-api'
import { ROLE_LABELS, canManageIssues, canManageRegistry, canModerate, type AppRole } from '@/lib/roles'
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
import { RoleDashboard, SystemHealthView, type DashboardDestination } from '@/components/gov/role-dashboard'
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

type Tab = 'home' | 'overview' | 'complaints' | 'gis' | 'analytics' | 'registry' | 'audit' | 'moderation' | 'privacy' | 'system'

const ALL_NAV: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'home', label: 'My dashboard', icon: LayoutDashboard },
  { id: 'overview', label: 'Executive overview', icon: LayoutDashboard },
  { id: 'complaints', label: 'Complaints', icon: ListChecks },
  { id: 'gis', label: 'Chai Heat Map', icon: Map },
  { id: 'analytics', label: 'Analytics', icon: ChartColumn },
  { id: 'registry', label: 'Registry', icon: ShieldCheck },
  { id: 'audit', label: 'Audit', icon: Bell },
  { id: 'moderation', label: 'Moderation', icon: Bell },
  { id: 'privacy', label: 'Privacy requests', icon: ShieldCheck },
  { id: 'system', label: 'Platform status', icon: ShieldCheck },
]

const TITLES: Record<Tab, { title: string; sub: string }> = {
  home: { title: 'My dashboard', sub: 'A workspace tailored to your CivicChai role' },
  overview: { title: 'Control Room', sub: 'Live civic operations across the ward' },
  complaints: { title: 'Complaints', sub: 'Normalized, prioritized, de-duplicated' },
  gis: { title: 'Chai Heat Map', sub: 'Privacy-preserving geographic hotspots' },
  analytics: { title: 'Analytics', sub: 'Resolution performance & SLA trends' },
  registry: { title: 'Officer Registry', sub: 'Authority, hub and contact routing' },
  audit: { title: 'Audit & Compliance', sub: 'Status history, access logs and governance trail' },
  moderation: { title: 'Moderation', sub: 'User reports, content review and appeals' },
  privacy: { title: 'Privacy requests', sub: 'Data-rights and privacy grievance handling' },
  system: { title: 'Platform status', sub: 'Safe infrastructure checks and operational readiness' },
}

const ROLE_HOME: Record<AppRole, Tab> = {
  citizen: 'home',
  moderator: 'home',
  department_operator: 'home',
  department_supervisor: 'home',
  authority_admin: 'home',
  system_admin: 'home',
  auditor: 'home',
}

const ROLE_HEADER: Partial<Record<AppRole, { title: string; sub: string }>> = {
  moderator: { title: 'Community safety', sub: 'Moderation, review and appeals' },
  department_operator: { title: 'Department operations', sub: 'Your assigned cases and service actions' },
  department_supervisor: { title: 'Department performance', sub: 'Workload, service targets and escalations' },
  authority_admin: { title: 'Jurisdiction operations', sub: 'Cross-department ward coordination' },
  system_admin: { title: 'Platform operations', sub: 'Infrastructure status and data-rights workflow' },
  auditor: { title: 'Independent oversight', sub: 'Read-only audit and compliance records' },
}

export function ControlRoom() {
  const { logout, user, mfaVerified, isHydrated } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(() => ROLE_HOME[user?.role ?? 'authority_admin'])
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; issue_id: string | null; read_at: string | null; created_at: string }>>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const roleHeader = user?.role ? ROLE_HEADER[user.role] : undefined
  const head = roleHeader && tab === ROLE_HOME[user?.role ?? 'authority_admin']
    ? roleHeader
    : TITLES[tab]
  const needsMfa = Boolean(isHydrated && user && user.role !== 'citizen' && !user.demo && !mfaVerified)
  useEffect(() => {
    if (needsMfa) router.replace('/mfa')
  }, [needsMfa, router])

  useEffect(() => {
    if (needsMfa) return
    let cancelled = false
    civicFetch('/api/notifications').then((response) => response.ok ? response.json() : null).then((payload) => {
      if (!cancelled) setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : [])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [user?.id, needsMfa])

  async function markAllNotificationsRead() {
    const response = await civicFetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mark_all: true }) })
    const payload = await response.json()
    if (response.ok) setNotifications(Array.isArray(payload.notifications) ? payload.notifications : [])
  }
  const visibleNav = ALL_NAV.filter((item) => {
    const role = user?.role
    if (!role) return false
    if (role === 'moderator') return item.id === 'home' || item.id === 'moderation'
    if (role === 'department_operator') return item.id === 'home' || item.id === 'complaints'
    if (role === 'department_supervisor') return item.id === 'home' || item.id === 'complaints' || item.id === 'analytics'
    if (role === 'system_admin') return item.id === 'home' || item.id === 'system' || item.id === 'privacy'
    if (role === 'auditor') return item.id === 'home' || item.id === 'audit' || item.id === 'analytics'
    if (item.id === 'registry') return canManageRegistry(role)
    if (item.id === 'audit') return role === 'authority_admin'
    if (item.id === 'moderation') return canModerate(role)
    if (item.id === 'home') return true
    if (item.id === 'overview' || item.id === 'complaints' || item.id === 'gis' || item.id === 'analytics') return canManageIssues(role)
    return false
  })
  useEffect(() => {
    if (user?.role) setTab(ROLE_HOME[user.role])
  }, [user?.role])
  const safeTab = visibleNav.some((item) => item.id === tab) ? tab : visibleNav[0]?.id ?? 'home'

  const handleLogout = () => {
    void logout()
  }

  // Staff views stay unmounted until the session reaches AAL2, so no protected request is attempted.
  if (needsMfa) return <main className="flex min-h-screen items-center justify-center bg-sidebar text-sm text-sidebar-foreground/60" role="status">Redirecting to multi-factor verification…</main>

  return (
    <div className="flex min-h-screen bg-sidebar font-sans text-sidebar-foreground">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-card p-4 lg:flex">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Logo showWordmark={false} className="shrink-0" />
          <div>
            <p className="font-display text-sm font-extrabold leading-tight text-sidebar-foreground">
              CivicChai
            </p>
            <p className="text-[11px] text-chai">Control Room</p>
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
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-sidebar-foreground">
              <ShieldCheck className="h-4 w-4 text-leaf" /> RBAC active
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/50">
              {user ? `${ROLE_LABELS[user.role]} · ${user.pin ? `PIN ${user.pin}` : 'jurisdiction scoped'}. Actions are recorded.` : 'Sign in required.'}
            </p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-card/90 px-5 py-3.5 backdrop-blur">
          <div>
            <h1 className="font-display text-lg font-extrabold text-sidebar-foreground">
              {head.title}
            </h1>
            <p className="text-xs text-sidebar-foreground/50">{head.sub}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
            <button
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative rounded-md border border-sidebar-border p-2 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
            >
              <Bell className="h-4 w-4" />
              {notifications.some((item) => !item.read_at) && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-heat text-[10px] font-bold text-cream">{notifications.filter((item) => !item.read_at).length}</span>}
            </button>
            {notificationsOpen && <div className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-sidebar-border bg-sidebar p-3 shadow-2xl"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-sidebar-foreground">Notifications</p>{notifications.some((item) => !item.read_at) && <button onClick={() => void markAllNotificationsRead()} className="inline-flex items-center gap-1 text-[11px] font-semibold text-chai"><Check className="h-3.5 w-3.5" />Mark read</button>}</div><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{notifications.length ? notifications.map((item) => <article key={item.id} className={'rounded-lg p-3 ' + (item.read_at ? 'bg-sidebar-accent' : 'bg-gold/10')}><p className="text-xs font-semibold text-sidebar-foreground">{item.title}</p><p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/60">{item.body}</p>{item.issue_id && <button onClick={() => { setTab('complaints'); setNotificationsOpen(false) }} className="mt-1 text-[10px] font-semibold text-chai underline">Open issue queue</button>}<p className="mt-1 text-[10px] text-sidebar-foreground/40">{new Date(item.created_at).toLocaleString()}</p></article>) : <p className="py-3 text-xs text-sidebar-foreground/50">No notifications yet.</p>}</div></div>}
            </div>
            <div className="flex items-center gap-2 rounded-md border border-sidebar-border px-3 py-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-xs font-bold text-charcoal">
                {(user?.name ?? 'CC').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-sidebar-foreground">{user?.name}</p>
                <p className="text-[10px] text-sidebar-foreground/50">{user ? ROLE_LABELS[user.role] : ''}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-sidebar-border bg-card px-3 py-2 lg:hidden">
          {visibleNav.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
                tab === n.id
                  ? 'bg-gold text-charcoal'
                  : 'text-sidebar-foreground/70',
              )}
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-x-hidden p-5">
          {safeTab === 'home' && user && user.role !== 'citizen' && <RoleDashboard role={user.role} onNavigate={(destination: DashboardDestination) => setTab(destination)} />}
          {safeTab === 'overview' && <OverviewView />}
          {safeTab === 'complaints' && <ComplaintsView />}
          {safeTab === 'gis' && <GISView />}
          {safeTab === 'analytics' && <AnalyticsView />}
          {safeTab === 'registry' && <RegistryView />}
          {safeTab === 'audit' && <AuditView />}
          {safeTab === 'moderation' && <ModerationView />}
          {safeTab === 'privacy' && <PrivacyRequestsView />}
          {safeTab === 'system' && <SystemHealthView />}
        </main>
      </div>
    </div>
  )
}
