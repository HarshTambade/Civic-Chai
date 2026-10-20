import { createHash } from 'node:crypto'
import { getSupabaseServiceClient } from '@/lib/supabase'

type Bucket = { startedAt: number; count: number }
const KEY = '__civicchai_rate_limit__'

function localBuckets() {
  const globalScope = globalThis as typeof globalThis & { [KEY]?: Map<string, Bucket> }
  if (!globalScope[KEY]) globalScope[KEY] = new Map()
  return globalScope[KEY]!
}

function requestIdentity(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'local-preview'
}

export async function consumeRateLimit(request: Request, bucket: string, limit: number, windowSeconds: number) {
  const identity = createHash('sha256').update(`${bucket}:${requestIdentity(request)}`).digest('hex')
  const service = getSupabaseServiceClient()
  if (service) {
    const { data, error } = await service.rpc('consume_api_rate_limit', {
      p_key_hash: identity,
      p_window_seconds: windowSeconds,
      p_limit: limit,
    })
    if (!error && typeof data === 'boolean') return data
  }

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
