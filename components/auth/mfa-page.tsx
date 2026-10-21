'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { useAuth } from '@/components/auth-provider'
import { getSupabaseClient } from '@/lib/supabase'

export function MfaPage() {
  const router = useRouter()
  const { user, isHydrated, mfaVerified, refreshMfa, logout } = useAuth()
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isHydrated) return
    if (!user) { router.replace('/login'); return }
    if (user.role === 'citizen' || user.demo) { router.replace(user.role === 'citizen' ? '/citizen' : '/control-room'); return }
    if (mfaVerified) { router.replace('/control-room'); return }
    if (!supabase) { setError('Staff MFA requires the connected Supabase Auth service.'); setLoading(false); return }

    const client = supabase
    const signedInUser = user
    let cancelled = false
    async function prepare() {
      try {
        const { data: sessionData } = await client.auth.getSession()
        const session = sessionData.session
        if (!session) { router.replace('/login'); return }
        const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token)
        if (assuranceError) throw assuranceError
        if (assurance?.currentLevel === 'aal2') { await refreshMfa(); router.replace('/control-room'); return }

        const { data: factors, error: factorError } = await client.auth.mfa.listFactors()
        if (factorError) throw factorError
        const verified = factors.totp.find((factor) => factor.status === 'verified')
        if (verified) {
          const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: verified.id })
          if (challengeError) throw challengeError
          if (!cancelled) { setFactorId(verified.id); setChallengeId(challenge.id) }
          return
        }

        // A pending factor has no recoverable secret after leaving setup, so replace it with a fresh QR.
        for (const factor of factors.all.filter((item) => item.factor_type === 'totp' && item.status === 'unverified')) {
          const { error: removeError } = await client.auth.mfa.unenroll({ factorId: factor.id })
          if (removeError) throw removeError
        }
        const { data: enrollment, error: enrollmentError } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `CivicChai staff · ${signedInUser.email}` })
        if (enrollmentError) throw enrollmentError
        const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: enrollment.id })
        if (challengeError) throw challengeError
        if (!cancelled) {
          setFactorId(enrollment.id)
          setChallengeId(challenge.id)
          setQrCode(enrollment.totp.qr_code)
          setSecret(enrollment.totp.secret)
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to prepare staff multi-factor authentication.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void prepare()
    return () => { cancelled = true }
  }, [isHydrated, user, mfaVerified, supabase, router, refreshMfa])

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (!supabase || !factorId || !challengeId) throw new Error('The MFA challenge is not ready. Reload this page to try again.')
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId, code: code.replace(/\s/g, '') })
      if (verifyError) throw verifyError
      if (!await refreshMfa()) throw new Error('Supabase did not confirm an AAL2 session. Verify the current code and try again.')
      router.replace('/control-room')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That authentication code could not be verified.')
    } finally {
      setSubmitting(false)
    }
  }

  const qrSource = qrCode.startsWith('data:') ? qrCode : `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`

  return (
    <main className="flex min-h-dvh items-center justify-center bg-sidebar px-4 py-8 text-sidebar-foreground">
      <section className="w-full max-w-md rounded-2xl border border-sidebar-border bg-sidebar-accent p-6 shadow-2xl sm:p-8">
        <div className="mb-5 flex items-center gap-3"><Logo showWordmark={false} /><div><p className="font-display text-xl font-extrabold">Staff account protection</p><p className="text-xs text-chai">Multi-factor authentication</p></div></div>
        <p className="text-sm leading-relaxed text-sidebar-foreground/65">Administrative access requires a time-based one-time code from an authenticator app. CivicChai checks this requirement on protected API requests as well as in the dashboard.</p>
        {loading ? <p role="status" className="mt-5 text-sm text-sidebar-foreground/60">Preparing your secure sign-in…</p> : <>
          {qrCode && <div className="mt-5 rounded-xl bg-white p-4 text-center"><img src={qrSource} alt="Scan this one-time code with your authenticator app" className="mx-auto h-48 w-48" /><p className="mt-2 text-xs text-charcoal/65">Scan this QR code in your authenticator app.</p><p className="mt-2 break-all font-mono text-xs text-charcoal">{secret}</p></div>}
          {error && <p role="alert" className="mt-4 rounded-lg bg-heat/15 p-3 text-sm text-heat">{error}</p>}
          {factorId && challengeId && <form onSubmit={verify} className="mt-5 space-y-3">
            <label htmlFor="mfa-code" className="block text-xs font-semibold text-sidebar-foreground/75">Authenticator code</label>
            <input id="mfa-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required className="w-full rounded-lg border border-sidebar-border bg-sidebar px-3 py-3 text-center font-mono text-xl tracking-[0.4em] text-sidebar-foreground outline-none focus:border-gold" />
            <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-charcoal disabled:opacity-60"><ShieldCheck className="h-4 w-4" />{submitting ? 'Verifying…' : qrCode ? 'Verify and enable MFA' : 'Verify and continue'}</button>
          </form>}
        </>}
        <button type="button" onClick={() => void logout().then(() => router.replace('/login'))} className="mt-5 w-full rounded-lg border border-sidebar-border px-4 py-2.5 text-xs font-semibold text-sidebar-foreground/60">Sign out</button>
      </section>
    </main>
  )
}
