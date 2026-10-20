'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { DEMO_ACCOUNTS, isAppRole, type AppRole, type AppUser } from '@/lib/roles'

type Credentials = { email: string; password: string }
type Registration = Credentials & { name: string }
type AuthContextType = {
  user: AppUser | null
  isAuthenticated: boolean
  isHydrated: boolean
  login: (credentials: Credentials) => Promise<AppUser>
  register: (credentials: Registration) => Promise<AppUser | null>
  logout: () => Promise<void>
}

const DEMO_SESSION_KEY = 'civicchai_demo_session'
const AuthContext = createContext<AuthContextType | undefined>(undefined)

function userFromProfile(
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  profile?: Record<string, unknown> | null,
): AppUser | null {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const supabase = useMemo(() => getSupabaseClient(), [])

  useEffect(() => {
    let mounted = true
    let authSubscription: { unsubscribe: () => void } | undefined

    async function loadSession() {
      if (supabase) {
        const { data } = await supabase.auth.getSession()
        const session = data.session
        if (session) {
          const { data: profile } = await supabase.from('profiles').select('role, display_name, pin, department').eq('id', session.user.id).maybeSingle()
          const nextUser = userFromProfile(session.user, profile)
          if (mounted) setUser(nextUser)
        }
        const { data: authState } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted || !session) {
            if (mounted) setUser(null)
            return
          }
          const nextUser = userFromProfile(session.user)
          if (nextUser) setUser(nextUser)
          void supabase.from('profiles').select('role, display_name, pin, department').eq('id', session.user.id).maybeSingle().then(({ data: profile }) => {
            if (mounted) setUser(userFromProfile(session.user, profile))
          })
        })
        authSubscription = authState.subscription
      } else {
        try {
        const saved = localStorage.getItem(DEMO_SESSION_KEY)
          if (saved) {
            const parsed = JSON.parse(saved) as AppUser
            if (isAppRole(parsed.role)) setUser({ ...parsed, demo: true })
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

  const login = async ({ email, password }: Credentials): Promise<AppUser> => {
    const normalizedEmail = email.trim().toLowerCase()
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (error) {
        const invalidCredentials = error.code === 'invalid_credentials' ||
          (error.status === 400 && /invalid (login )?credentials/i.test(error.message))
        if (invalidCredentials && DEMO_ACCOUNTS.some((account) => account.email === normalizedEmail)) {
          throw new Error('These demo credentials were rejected by the connected Supabase project. Run pnpm run seed:demo-users with this project’s server credentials, then try again.')
        }
        if (invalidCredentials) throw new Error('Invalid email or password.')
        throw new Error(error.message || 'Unable to reach Supabase Auth.')
      }
      if (!data.user) throw new Error('Supabase Auth did not return a user for this sign-in.')
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, display_name, pin, department')
        .eq('id', data.user.id)
        .single()
      const nextUser = userFromProfile(data.user, profile)
      if (profileError || !nextUser) {
        await supabase.auth.signOut()
        if (profileError) throw new Error('Supabase accepted the sign-in, but CivicChai could not read this account’s role profile. Check the database migrations and profile access policies.')
        throw new Error('Supabase accepted the sign-in, but this account has no valid CivicChai role. Rerun the demo-user seed for demo accounts.')
      }
      setUser(nextUser)
      return nextUser
    }

    const account = DEMO_ACCOUNTS.find((item) => item.email === normalizedEmail && item.password === password)
    if (!account) throw new Error('Invalid email or password')
    const { password: _password, ...demoUser } = account
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(demoUser))
    setUser(demoUser)
    return demoUser
  }

  const register = async ({ email, password, name }: Registration): Promise<AppUser | null> => {
    if (!supabase) throw new Error('Connect Supabase to create a durable account. The local preview includes demo accounts for every role.')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: name.trim().slice(0, 80), preferred_language: 'en' } },
    })
    if (error) throw new Error(error.message)
    if (!data.session || !data.user) return null
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role, display_name, pin, department').eq('id', data.user.id).maybeSingle()
    const nextUser = userFromProfile(data.user, profile)
    if (profileError || !nextUser || nextUser.role !== 'citizen') {
      await supabase.auth.signOut()
      throw new Error('The account was created but its citizen profile is not ready yet. Check your email or sign in again shortly.')
    }
    setUser(nextUser)
    return nextUser
  }

  const logout = async () => {
    if (supabase) await supabase.auth.signOut()
    localStorage.removeItem(DEMO_SESSION_KEY)
    setUser(null)
  }

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated: Boolean(user),
    isHydrated,
    login,
    register,
    logout,
  }), [user, isHydrated])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    return {
      user: null,
      isAuthenticated: false,
      isHydrated: false,
      login: async () => { throw new Error('AuthProvider is not available') },
      register: async () => { throw new Error('AuthProvider is not available') },
      logout: async () => {},
    }
  }
  return context
}
