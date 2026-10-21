import { NextResponse } from 'next/server'
import { getRequestContext } from '@/lib/api-auth'
import { hasSupabaseConfig, isLocalDemoModeEnabled } from '@/lib/supabase'
import { consumeRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit(request, 'evidence-upload', 20, 3600)
  if (rateLimit === null) return NextResponse.json({ error: 'Request protection is temporarily unavailable. Please try again shortly.' }, { status: 503 })
  if (!rateLimit) return NextResponse.json({ error: 'Too many evidence uploads from this connection. Try again later.' }, { status: 429 })
  const { actor, client, authenticated } = await getRequestContext(request)
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image file.' }, { status: 400 })
  // Keep the multipart request below serverless request body ceilings; a future
  // direct-to-storage signed upload can safely raise the video cap.
  const limits: Record<string, number> = { 'image/jpeg': 4 * 1024 * 1024, 'image/png': 4 * 1024 * 1024, 'image/webp': 4 * 1024 * 1024, 'video/mp4': 4 * 1024 * 1024, 'video/webm': 4 * 1024 * 1024 }
  if (!limits[file.type] || file.size < 1 || file.size > limits[file.type]) {
    return NextResponse.json({ error: 'Use a JPG, PNG, WebP, MP4 or WebM file up to 4 MB.' }, { status: 400 })
  }

  const rawBytes = await file.arrayBuffer()
  const bytes = new Uint8Array(rawBytes)
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value)
  const matchesType = file.type === 'image/jpeg' ? starts(0xff, 0xd8, 0xff)
    : file.type === 'image/png' ? starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
      : file.type === 'image/webp' ? starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
        : file.type === 'video/mp4' ? String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp'
          : file.type === 'video/webm' ? starts(0x1a, 0x45, 0xdf, 0xa3)
            : false
  if (!matchesType) return NextResponse.json({ error: 'The uploaded file content does not match its declared media type.' }, { status: 400 })

  if (isLocalDemoModeEnabled()) {
    const encoded = Buffer.from(rawBytes)
    return NextResponse.json({ storage_path: `data:${file.type};base64,${encoded.toString('base64')}`, demo: true })
  }
  if (process.env.NODE_ENV === 'production' && !hasSupabaseConfig()) return NextResponse.json({ error: 'Evidence storage is not configured.' }, { status: 503 })
  if (!authenticated || !actor?.id || !client) return NextResponse.json({ error: 'Sign in before uploading private evidence.' }, { status: 401 })

  const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' } as Record<string, string>)[file.type]
  const path = `${actor.id}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from('issue-evidence').upload(path, rawBytes, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) return NextResponse.json({ error: 'Private evidence upload failed.' }, { status: 400 })
  return NextResponse.json({ storage_path: path })
}
