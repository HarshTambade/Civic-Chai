import { createHash } from 'node:crypto'
import { getSupabaseServiceClient, hasSupabaseConfig } from '@/lib/supabase'

type Bucket = { startedAt: number; count: number }
const KEY = '__civicchai_rate_limit__'

function localBuckets() {
  const globalScope = globalThis as typeof globalThis & { [KEY]?: Map<string, Bucket> }
  if (!globalScope[KEY]) globalScope[KEY] = new Map()
  return globalScope[KEY]!
}

function requestIdentity(request: Request) {
  const platformIp = request.headers.get('x-real-ip')?.trim()
  const forwardedChain = request.headers.get('x-forwarded-for')?.split(',').map((part) => part.trim()).filter(Boolean)
  return platformIp || forwardedChain?.at(-1) || 'local-preview'
}

/** Returns null when the shared production limiter is unavailable; callers must respond 503. */
export async function consumeRateLimit(request: Request, bucket: string, limit: number, windowSeconds: number): Promise<boolean | null> {
  const identity = createHash('sha256').update(`${bucket}:${requestIdentity(request)}`).digest('hex')
  const service = getSupabaseServiceClient()
  if (service) {
    const { data, error } = await service.rpc('consume_api_rate_limit', {
      p_key_hash: identity,
      p_window_seconds: windowSeconds,
      p_limit: limit,
    })
    if (!error && typeof data === 'boolean') return data
    console.error('Shared API rate limiter failed:', error?.message ?? 'Invalid RPC response')
  }

  if (process.env.NODE_ENV === 'production' || hasSupabaseConfig()) return null

  const store = localBuckets()
  const now = Date.now()
  const current = store.get(identity)
  if (!current || now - current.startedAt >= windowSeconds * 1000) {
    store.set(identity, { startedAt: now, count: 1 })
    return true
  }
  current.count += 1
  return current.count <= limit
}
