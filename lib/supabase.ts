import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.NEXT_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return null
  }

  return createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
    },
  })
}

export function getSupabaseClientForToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.NEXT_SUPABASE_ANON_KEY
  if (!url || !anonKey || !token) return null
  return createSupabaseClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export function hasSupabaseConfig() {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_SUPABASE_URL) &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ?? process.env.NEXT_SUPABASE_ANON_KEY),
  )
}

export function getSupabaseServiceClient() {
  if (typeof window !== 'undefined') return null
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createSupabaseClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

export const supabase = getSupabaseClient()
