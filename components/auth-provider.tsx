'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getSupabaseClient, isDemoModeEnabled, isLocalDemoModeEnabled } from '@/lib/supabase'
import { DEMO_ACCOUNTS, isAppRole, isDemoAccountEmail, type AppUser } from '@/lib/roles'

type Credentials = { email: string; password: string }
type Registration = Credentials & { name: string }
type AuthContextType = {
  user: AppUser | null
  mfaVerified: boolean
  refreshMfa: () => Promise<boolean>
  isAuthenticated: boolean
  isHydrated: boolean
  login: (credentials: Credentials) => Promise<AppUser>
  register: (credentials: Registration) => Promise<AppUser | null>
  logout: () => Promise<void>
}

const DEMO_SESSION_KEY = 'civicchai_demo_session'
const AuthContext = createContext<AuthContextType | undefined>(undefined)

function userFromProfile(authUser: User, profile?: Record<string, unknown> | null): AppUser | null {
  const role = profile?.role
  if (!isAppRole(role)) return null
  return {
    id: authUser.id,
    email: authUser.email ?? '',
    name: String(profile?.display_name ?? authUser.user_metadata?.display_name ?? authUser.email ?? 'CivicChai user'),
    role,
    pin: typeof profile?.pin === 'string' ? profile.pin : undefined,
    department: typeof profile?.department === 'string' ? profile.department : undefined,
  }
}

/** Reads the protected profile role and whether this session may open staff tools. */
async function resolveUser(supabase: SupabaseClient, authUser: User, accessToken?: string) {
  const { data: profile, error } = await supabase.from('profiles').select('role, display_name, pin, department').eq('id', authUser.id).maybeSingle()
  const user = userFromProfile(authUser, profile)
  if (!user) return { user: null, mfaVerified: false, profileError: error }
  // Citizens never need MFA; seeded demo staff skip it only while demo mode is on.
  if (user.role === 'citizen' || (isDemoModeEnabled() && isDemoAccountEmail(user.email))) return { user, mfaVerified: true, profileError: null }
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(accessToken)
  return { user, mfaVerified: assurance?.currentLevel === 'aal2', profileError: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [mfaVerified, setMfaVerified] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const supabase = useMemo(() => getSupabaseClient(), [])

  useEffect(() => {
    let mounted = true
    let authSubscription: { unsubscribe: () => void } | undefined

    async function loadSession() {
      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession()
          if (data.session) {
            const resolved = await resolveUser(supabase, data.session.user, data.session.access_token)
            if (mounted) { setUser(resolved.user); setMfaVerified(resolved.mfaVerified) }
          }
        } catch {
          // An expired or revoked stored session leaves the visitor signed out.
        }
        const { data: authState } = supabase.auth.onAuthStateChange((event, session) => {
          if (!mounted || event === 'INITIAL_SESSION') return
          if (!session) {
            setUser(null)
            setMfaVerified(false)
            return
          }
          // Supabase holds an auth lock during this callback; defer further client calls so they cannot deadlock it.
          setTimeout(() => {
            void resolveUser(supabase, session.user, session.access_token).then((resolved) => {
              if (mounted) { setUser(resolved.user); setMfaVerified(resolved.mfaVerified) }
            }).catch(() => {})
          }, 0)
        })
        authSubscription = authState.subscription
      } else if (isLocalDemoModeEnabled()) {
        try {
          const saved = localStorage.getItem(DEMO_SESSION_KEY)
          if (saved) {
            const parsed = JSON.parse(saved) as AppUser
            if (isAppRole(parsed.role)) { setUser({ ...parsed, demo: true }); setMfaVerified(true) }
          }
        } catch {
          localStorage.removeItem(DEMO_SESSION_KEY)
        }
      }
      if (mounted) setIsHydrated(true)
    }

    void loadSession()
    return () => { mounted = false; authSubscription?.unsubscribe() }
  }, [supabase])

  const login = useCallback(async ({ email, password }: Credentials): Promise<AppUser> => {
    const normalizedEmail = email.trim().toLowerCase()
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (error) {
        const invalidCredentials = error.code === 'invalid_credentials' ||
          (error.status === 400 && /invalid (login )?credentials/i.test(error.message))
        if (invalidCredentials && isDemoAccountEmail(normalizedEmail)) {
          throw new Error('These demo credentials were rejected by the connected Supabase project. Run pnpm run seed:demo-users with this project’s server credentials, then try again.')
        }
        if (invalidCredentials) throw new Error('Invalid email or password.')
        if (error.code === 'email_not_confirmed') throw new Error('Confirm your email address using the link we sent, then sign in.')
        throw new Error(error.message || 'Unable to reach Supabase Auth.')
      }
      if (!data.user || !data.session) throw new Error('Supabase Auth did not return a session for this sign-in.')
      const resolved = await resolveUser(supabase, data.user, data.session.access_token)
      if (!resolved.user) {
        await supabase.auth.signOut()
        if (resolved.profileError) throw new Error('Supabase accepted the sign-in, but CivicChai could not read this account’s role profile. Check the database migrations and profile access policies.')
        throw new Error('Supabase accepted the sign-in, but this account has no CivicChai profile yet. Try again in a moment, or rerun the demo-user seed for demo accounts.')
      }
      setUser(resolved.user)
      setMfaVerified(resolved.mfaVerified)
      return resolved.user
    }

    if (!isLocalDemoModeEnabled()) throw new Error('Authentication is unavailable. Configure the production Supabase URL and publishable key.')
    const account = DEMO_ACCOUNTS.find((item) => item.email === normalizedEmail && item.password === password)
    if (!account) throw new Error('Invalid email or password')
    const { password: _password, ...demoUser } = account
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(demoUser))
    setUser(demoUser)
    setMfaVerified(true)
    return demoUser
  }, [supabase])

  const register = useCallback(async ({ email, password, name }: Registration): Promise<AppUser | null> => {
    if (!supabase) throw new Error('Connect Supabase to create a durable account. The local preview includes demo accounts for every role.')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: name.trim().slice(0, 80), preferred_language: 'en' } },
    })
    if (error) {
      if (error.code === 'user_already_exists') throw new Error('An account with this email already exists. Sign in instead.')
      if (error.code === 'weak_password') throw new Error('Choose a stronger password (at least 8 characters, mixing letters and numbers).')
      throw new Error(error.message)
    }
    if (!data.session || !data.user) return null
    const resolved = await resolveUser(supabase, data.user, data.session.access_token)
    if (!resolved.user || resolved.user.role !== 'citizen') {
      await supabase.auth.signOut()
      throw new Error('The account was created but its citizen profile is not ready yet. Sign in again in a moment.')
    }
    setUser(resolved.user)
    setMfaVerified(true)
    return resolved.user
  }, [supabase])

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut().catch(() => {})
    localStorage.removeItem(DEMO_SESSION_KEY)
    setUser(null)
    setMfaVerified(false)
  }, [supabase])

  const refreshMfa = useCallback(async () => {
    if (!supabase) return isLocalDemoModeEnabled()
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) { setMfaVerified(false); return false }
    const resolved = await resolveUser(supabase, sessionData.session.user, sessionData.session.access_token)
    setMfaVerified(resolved.mfaVerified)
    return resolved.mfaVerified
  }, [supabase])

  const value = useMemo<AuthContextType>(() => ({
    user,
    mfaVerified,
    refreshMfa,
    isAuthenticated: Boolean(user),
    isHydrated,
    login,
    register,
    logout,
  }), [user, mfaVerified, isHydrated, refreshMfa, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    return {
      user: null,
      mfaVerified: false,
      refreshMfa: async () => false,
      isAuthenticated: false,
      isHydrated: false,
      login: async () => { throw new Error('AuthProvider is not available') },
      register: async () => { throw new Error('AuthProvider is not available') },
      logout: async () => {},
    }
  }
  return context
}
