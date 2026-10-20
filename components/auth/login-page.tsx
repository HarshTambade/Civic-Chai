'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { useAuth } from '@/components/auth-provider'
import { DEMO_ACCOUNTS, ROLE_LABELS } from '@/lib/roles'
import { hasSupabaseConfig } from '@/lib/supabase'

export function LoginPage() {
  const router = useRouter()
  const { login, register } = useAuth()
  const [email, setEmail] = useState('operator@civicchai.local')
  const [password, setPassword] = useState('CivicChai!2026')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [notice, setNotice] = useState('')
  const supabaseConfigured = hasSupabaseConfig()
  const canRegister = supabaseConfigured

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(''); setNotice('')
    setIsLoading(true)
    try {
      if (creatingAccount) {
        const account = await register({ email, password, name })
        if (!account) { setNotice('Check your email to confirm the account, then sign in.'); return }
        router.replace('/citizen')
      } else {
        const account = await login({ email, password })
        router.replace(account.role === 'citizen' ? '/citizen' : '/control-room')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-sidebar px-4 py-8 text-cream">
      <div className="w-full max-w-2xl rounded-2xl border border-sidebar-border bg-sidebar-accent p-6 shadow-2xl sm:p-8">
        <div className="mb-7 flex items-center justify-center gap-3">
          <Logo showWordmark={false} />
          <div>
            <p className="font-display text-xl font-extrabold">CivicChai</p>
            <p className="text-xs text-gold">Citizen and Authority Portals</p>
          </div>
        </div>

        <div className="grid gap-7 md:grid-cols-[0.9fr_1.1fr]">
          <section>
            <h1 className="font-display text-2xl font-extrabold">{creatingAccount ? 'Create a citizen account' : 'Sign in'}</h1>
            <p className="mt-2 text-sm leading-relaxed text-cream/60">
              {creatingAccount
                ? 'New accounts are created as citizens. Administrative roles are provisioned by an authorized administrator.'
                : supabaseConfigured
                  ? 'Sign-in uses the connected Supabase project. Demo accounts must be provisioned in that same project.'
                  : 'Local preview mode is active. Choose a demo role to sign in on this device.'}
            </p>
            <form onSubmit={submit} className="mt-5 space-y-3">
              {creatingAccount && <><label className="block text-xs font-semibold text-cream/70" htmlFor="display-name">Name</label><input id="display-name" autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-sidebar-border bg-sidebar px-3 py-2.5 text-sm text-cream outline-none focus:border-gold" /></>}
              <label className="block text-xs font-semibold text-cream/70" htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-sidebar-border bg-sidebar px-3 py-2.5 text-sm text-cream outline-none focus:border-gold" />
              <label className="block pt-1 text-xs font-semibold text-cream/70" htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete={creatingAccount ? 'new-password' : 'current-password'} minLength={creatingAccount ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-sidebar-border bg-sidebar px-3 py-2.5 text-sm text-cream outline-none focus:border-gold" />
              {error && <p role="alert" className="rounded-lg bg-heat/15 p-3 text-sm text-heat">{error}</p>}
              {notice && <p role="status" className="rounded-lg bg-leaf/10 p-3 text-sm text-leaf">{notice}</p>}
              <button disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-charcoal disabled:opacity-60">
                {isLoading ? creatingAccount ? 'Creating account…' : 'Signing in…' : creatingAccount ? 'Create account' : 'Continue'} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            {canRegister && <button type="button" onClick={() => { setCreatingAccount((current) => !current); setError(''); setNotice('') }} className="mt-3 text-xs font-semibold text-gold underline">{creatingAccount ? 'Already have an account? Sign in' : 'Create a citizen account'}</button>}
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-cream/50">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" />
              {supabaseConfigured
                ? 'Role access is read from each account’s Supabase profile. Local demo sessions are disabled while Supabase is connected.'
                : 'Local demo sessions are for preview only. Configure Supabase Auth and seeded profiles for protected deployment.'}
            </p>
          </section>

          <section className="rounded-xl border border-sidebar-border bg-sidebar/70 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gold">Demo accounts · password: CivicChai!2026</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-cream/45">
              {supabaseConfigured
                ? <>Connected mode: if a demo is missing, run <code className="text-cream/65">pnpm run seed:demo-users</code> with this project’s server credentials.</>
                : 'Preview sessions are stored only in this browser.'}
            </p>
            <div className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => { setCreatingAccount(false); setEmail(account.email); setPassword(account.password); setError(''); setNotice('') }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-sidebar-border px-3 py-2 text-left transition hover:border-gold/70 hover:bg-sidebar-accent"
                >
                  <span>
                    <span className="block text-xs font-semibold text-cream">{ROLE_LABELS[account.role]}</span>
                    <span className="mt-0.5 block text-[11px] text-cream/50">{account.email}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-cream/40" />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
