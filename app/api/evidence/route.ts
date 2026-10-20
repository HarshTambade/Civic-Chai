import { NextResponse } from 'next/server'
import { getRequestContext } from '@/lib/api-auth'
import { hasSupabaseConfig } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { actor, client, authenticated } = await getRequestContext(request)
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image file.' }, { status: 400 })
  const limits: Record<string, number> = { 'image/jpeg': 4 * 1024 * 1024, 'image/png': 4 * 1024 * 1024, 'image/webp': 4 * 1024 * 1024, 'video/mp4': 15 * 1024 * 1024, 'video/webm': 15 * 1024 * 1024 }
  if (!limits[file.type] || file.size < 1 || file.size > limits[file.type]) {
    return NextResponse.json({ error: 'Use a JPG, PNG or WebP image up to 4 MB, or MP4/WebM video up to 15 MB.' }, { status: 400 })
  }

  if (!hasSupabaseConfig()) {
    const bytes = Buffer.from(await file.arrayBuffer())
    return NextResponse.json({ storage_path: `data:${file.type};base64,${bytes.toString('base64')}`, demo: true })
  }
  if (!authenticated || !actor?.id || !client) return NextResponse.json({ error: 'Sign in before uploading private evidence.' }, { status: 401 })

  const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' } as Record<string, string>)[file.type]
  const path = `${actor.id}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from('issue-evidence').upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) return NextResponse.json({ error: 'Private evidence upload failed.' }, { status: 400 })
  return NextResponse.json({ storage_path: path })
}
