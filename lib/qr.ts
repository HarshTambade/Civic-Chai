import { createHmac, timingSafeEqual } from 'node:crypto'

// Signed locality QR codes (SOP §3.1, §15 "QR spoofing"). A code maps a physical
// place to a PIN/locality; it is a convenience, never proof of residence.

export type QrArea = { pin: string; locality: string; ward?: string; issuedAt: string }

function signingKey() {
  const explicit = process.env.QR_SIGNING_SECRET
  if (explicit) return explicit
  // Derive a stable server-only key so QR codes work without extra configuration.
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (service) return createHmac('sha256', service).update('civicchai-qr-v1').digest('hex')
  if (process.env.NODE_ENV !== 'production') return 'civicchai-local-preview-qr-key'
  return null
}

const encode = (value: Buffer | string) => Buffer.from(value).toString('base64url')

function signature(body: string, key: string) {
  return createHmac('sha256', key).update(body).digest().subarray(0, 18)
}

export function canSignQr() {
  return Boolean(signingKey())
}

export function signQrArea(area: Omit<QrArea, 'issuedAt'>) {
  const key = signingKey()
  if (!key) throw new Error('QR signing is not configured. Set QR_SIGNING_SECRET or the server Supabase key.')
  const body = encode(JSON.stringify({ v: 1, p: area.pin, l: area.locality, w: area.ward || undefined, t: new Date().toISOString() }))
  return `${body}.${encode(signature(body, key))}`
}

/** Returns the area for an authentic token, or null when it was forged or altered. */
export function verifyQrToken(token: string): QrArea | null {
  const key = signingKey()
  const [body, sig] = token.split('.')
  if (!key || !body || !sig || token.length > 600) return null
  const expected = signature(body, key)
  const actual = Buffer.from(sig, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>
    if (payload.v !== 1 || typeof payload.p !== 'string' || !/^\d{6}$/.test(payload.p) || typeof payload.l !== 'string') return null
    return { pin: payload.p, locality: payload.l.slice(0, 120), ward: typeof payload.w === 'string' ? payload.w.slice(0, 100) : undefined, issuedAt: String(payload.t ?? '') }
  } catch {
    return null
  }
}
