'use client'

import { getSupabaseClient } from '@/lib/supabase'
import type { CreateIssueInput, IssueRecord } from '@/lib/types'

export async function civicFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const supabase = getSupabaseClient()
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`)
  } else {
    try {
      const raw = localStorage.getItem('civicchai_demo_session')
      if (raw) {
        const user = JSON.parse(raw) as Record<string, string>
        if (user.role) headers.set('x-civicchai-demo-role', user.role)
        if (user.id) headers.set('x-civicchai-demo-id', user.id)
        if (user.email) headers.set('x-civicchai-demo-email', user.email)
        if (user.name) headers.set('x-civicchai-demo-name', user.name)
        if (user.pin) headers.set('x-civicchai-demo-pin', user.pin)
        if (user.department) headers.set('x-civicchai-demo-department', user.department)
      }
    } catch {
      // An invalid local demo session is ignored.
    }
  }
  return fetch(input, { ...init, headers })
}

export async function uploadEvidenceDataUrls(urls: string[]) {
  if (!urls.length) return []
  const supabase = getSupabaseClient()
  if (!supabase) return urls
  const paths: string[] = []
  for (const [index, dataUrl] of urls.entries()) {
    if (!dataUrl.startsWith('data:')) { paths.push(dataUrl); continue }
    const blob = await fetch(dataUrl).then((response) => response.blob())
    const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' } as Record<string, string>)[blob.type] ?? 'bin'
    const form = new FormData()
    form.set('file', new File([blob], `evidence-${index + 1}.${extension}`, { type: blob.type }))
    const response = await civicFetch('/api/evidence', { method: 'POST', body: form })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? 'Unable to upload private evidence.')
    paths.push(result.storage_path)
  }
  return paths
}

export async function submitIssuePayload(payload: CreateIssueInput): Promise<IssueRecord> {
  const urls = payload.image_urls ?? payload.evidence ?? (payload.image_url ? [payload.image_url] : [])
  const evidence = await uploadEvidenceDataUrls(urls)
  const prepared = { ...payload, image_url: evidence[0], image_urls: evidence, evidence }
  const response = await civicFetch('/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prepared),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Unable to submit complaint.')
  return result as IssueRecord
}
