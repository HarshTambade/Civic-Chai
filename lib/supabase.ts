import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

const BROWSER_CLIENT_KEY = '__civicchai_supabase_browser_client__'

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.NEXT_SUPABASE_ANON_KEY
  return url && anonKey ? { url, anonKey } : null
}

/**
 * In the browser this always returns the same client. Several auth clients sharing one
 * stored session race to refresh the token, and Supabase revokes a session whose refresh
 * token is reused, which signs people out at random.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const config = publicSupabaseConfig()
  if (!config) return null

  if (typeof window === 'undefined') {
    return createSupabaseClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  }

  const root = window as typeof window & { [BROWSER_CLIENT_KEY]?: SupabaseClient }
  root[BROWSER_CLIENT_KEY] ??= createSupabaseClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  return root[BROWSER_CLIENT_KEY]
}

export function getSupabaseClientForToken(token: string) {
  const config = publicSupabaseConfig()
  if (!config || !token) return null
  return createSupabaseClient(config.url, config.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export function hasSupabaseConfig() {
  return Boolean(publicSupabaseConfig())
}

/** Browser-only role simulation is strictly a local preview feature. */
export function isLocalDemoModeEnabled() {
  return process.env.NODE_ENV !== 'production' && !hasSupabaseConfig()
}

/**
 * Demo mode is for testing with the seeded @civicchai.local accounts: it lists them on
 * /login and lets those demo staff accounts skip authenticator setup. Real staff accounts
 * always need MFA. It is on by default; set NEXT_PUBLIC_CIVICCHAI_DEMO_MODE=false to turn
 * it off before a pilot accepts real reports.
 */
export function isDemoModeEnabled() {
  if (isLocalDemoModeEnabled()) return true
  const setting = process.env.NEXT_PUBLIC_CIVICCHAI_DEMO_MODE?.trim().toLowerCase()
  return !['false', '0', 'no', 'off'].includes(setting ?? '')
}

export function getSupabaseServiceClient() {
  if (typeof window !== 'undefined') return null
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createSupabaseClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}
