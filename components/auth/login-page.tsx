'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, LogOut, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { useAuth } from '@/components/auth-provider'
import { DEMO_ACCOUNTS, ROLE_LABELS, isDemoAccountEmail, type AppUser } from '@/lib/roles'
import { hasSupabaseConfig, isDemoModeEnabled, isLocalDemoModeEnabled } from '@/lib/supabase'

/** Only same-site citizen paths are accepted as a post-sign-in destination. */
function citizenReturnPath() {
  const next = new URLSearchParams(window.location.search).get('next') ?? ''
  return /^\/(citizen|issues\/|voice-agent)/.test(next) && !next.startsWith('//') ? next : '/citizen'
}

function destinationFor(account: AppUser) {
  if (account.role === 'citizen') return citizenReturnPath()
  // Local preview and demo-mode staff accounts skip authenticator setup.
  return account.demo || (isDemoModeEnabled() && isDemoAccountEmail(account.email)) ? '/control-room' : '/mfa'
}

const inputClass = 'w-full rounded-lg border border-sidebar-border bg-sidebar px-3 py-2.5 text-sm text-sidebar-foreground outline-none focus:border-gold'

export function LoginPage() {
  const router = useRouter()
  const { login, register, logout, user, isHydrated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [notice, setNotice] = useState('')
  const supabaseConfigured = hasSupabaseConfig()
  const localDemoEnabled = isLocalDemoModeEnabled()
  const canRegister = supabaseConfigured
  const showDemoAccounts = isDemoModeEnabled()

  async function signIn(credentials: { email: string; password: string }) {
    setError(''); setNotice('')
    setIsLoading(true)
    try {
      const account = await login(credentials)
      router.replace(destinationFor(account))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in')
    } finally {
      setIsLoading(false)
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!creatingAccount) { await signIn({ email, password }); return }
    setError(''); setNotice('')
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return }
    setIsLoading(true)
    try {
      const account = await register({ email, password })
      if (!account) { setNotice('Check your email to confirm the account, then sign in.'); setCreatingAccount(false); return }
      router.replace(citizenReturnPath())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the account')
    } finally {
      setIsLoading(false)
    }
  }

  if (isHydrated && user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-sidebar px-4 py-8 text-sidebar-foreground">
        <div className="w-full max-w-md rounded-2xl border border-sidebar-border bg-sidebar-accent p-6 text-center shadow-2xl sm:p-8">
          <div className="mb-5 flex justify-center"><Logo showWordmark={false} /></div>
          <h1 className="font-display text-2xl font-extrabold">You are signed in</h1>
          <p className="mt-2 text-sm text-sidebar-foreground/65">{user.role === 'citizen' ? user.handle : user.name} · {ROLE_LABELS[user.role]}</p>
          <p className="text-xs text-sidebar-foreground/45">{user.email}</p>
          <button type="button" onClick={() => router.replace(destinationFor(user))} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-charcoal">
            {user.role === 'citizen' ? 'Open Citizen Portal' : 'Open Control Room'} <ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => void logout()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-sidebar-border px-4 py-2.5 text-sm font-semibold text-sidebar-foreground/75">
            <LogOut className="h-4 w-4" /> Sign out to use another account
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-sidebar px-4 py-8 text-sidebar-foreground">
      <div className={`w-full ${showDemoAccounts ? 'max-w-3xl' : 'max-w-md'} rounded-2xl border border-sidebar-border bg-sidebar-accent p-6 shadow-2xl sm:p-8`}>
        <div className="mb-7 flex items-center justify-center gap-3">
          <Link href="/" aria-label="CivicChai home"><Logo showWordmark={false} /></Link>
          <div>
            <p className="font-display text-xl font-extrabold">CivicChai</p>
            <p className="text-xs text-chai">Citizen and Authority Portals</p>
          </div>
        </div>

        <div className={`grid gap-7 ${showDemoAccounts ? 'md:grid-cols-[1fr_1fr]' : ''}`}>
          <section>
            <h1 className="font-display text-2xl font-extrabold">{creatingAccount ? 'Create a citizen account' : 'Sign in'}</h1>
            <p className="mt-2 text-sm leading-relaxed text-sidebar-foreground/60">
              {creatingAccount
                ? 'No real name needed. You get an anonymous public name (like KadakKulhad-3F9A); your email is never shown to other people.'
                : supabaseConfigured
                  ? 'Citizens sign in with email and password. Authority staff use the account provisioned for them; the first sign-in asks you to scan a QR code with an authenticator app (Google Authenticator, Microsoft Authenticator or similar).'
                  : localDemoEnabled ? 'Local preview mode is active. Choose a demo role to sign in on this device.' : 'Authentication is unavailable. The production Supabase configuration is missing.'}
            </p>
            <form onSubmit={submit} className="mt-5 space-y-3">
              <label className="block text-xs font-semibold text-sidebar-foreground/70" htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
              <label className="block pt-1 text-xs font-semibold text-sidebar-foreground/70" htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete={creatingAccount ? 'new-password' : 'current-password'} minLength={creatingAccount ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
              {creatingAccount && <p className="text-[11px] leading-relaxed text-sidebar-foreground/50">At least 8 characters. By creating an account you agree to the <Link href="/community-guidelines" className="underline">community guidelines</Link> and confirm you have read the <Link href="/privacy" className="underline">privacy notice</Link>.</p>}
              {error && <p role="alert" className="rounded-lg bg-heat/15 p-3 text-sm text-heat">{error}</p>}
              {notice && <p role="status" className="rounded-lg bg-leaf/10 p-3 text-sm text-leaf">{notice}</p>}
              <button disabled={isLoading || (!supabaseConfigured && !localDemoEnabled)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-charcoal disabled:opacity-60">
                {isLoading ? creatingAccount ? 'Creating account…' : 'Signing in…' : creatingAccount ? 'Create account' : 'Continue'} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            {canRegister && <button type="button" onClick={() => { setCreatingAccount((current) => !current); setError(''); setNotice('') }} className="mt-4 w-full rounded-lg border border-sidebar-border px-4 py-2.5 text-sm font-semibold text-chai">{creatingAccount ? 'Already have an account? Sign in' : 'New here? Create a citizen account'}</button>}
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-sidebar-foreground/50">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" />
              {supabaseConfigured
                ? 'Role access is read from each account’s protected profile. Staff accounts are provisioned by an administrator.'
                : localDemoEnabled ? 'Local demo sessions are for preview only. Configure Supabase Auth and seeded profiles for protected deployment.' : 'Production login is disabled until Supabase is configured.'}
            </p>
          </section>

          {showDemoAccounts ? <section className="rounded-xl border border-sidebar-border bg-sidebar/70 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-chai">Demo accounts for testing</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/50">
              One tap signs in. Password for all: <code className="text-sidebar-foreground/75">CivicChai!2026</code>.
              {supabaseConfigured ? ' Demo staff accounts skip the authenticator step while demo mode is on.' : ' Preview sessions are stored only in this browser.'}
            </p>
            <div className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  disabled={isLoading}
                  onClick={() => { setCreatingAccount(false); setEmail(account.email); setPassword(account.password); void signIn({ email: account.email, password: account.password }) }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-sidebar-border px-3 py-2 text-left transition hover:border-gold/70 hover:bg-sidebar-accent disabled:opacity-60"
                >
                  <span>
                    <span className="block text-xs font-semibold text-sidebar-foreground">{ROLE_LABELS[account.role]}</span>
                    <span className="mt-0.5 block text-[11px] text-sidebar-foreground/50">{account.email}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-chai">Sign in <ArrowRight className="h-3.5 w-3.5" /></span>
                </button>
              ))}
            </div>
            {supabaseConfigured && <p className="mt-3 text-[10px] leading-relaxed text-sidebar-foreground/40">If a demo account is rejected, run <code>pnpm run seed:demo-users</code>. Turn demo mode off before real pilot reports.</p>}
          </section> : null}
        </div>
      </div>
    </main>
  )
}
