import type { CreateIssueInput, IssueRecord } from '@/lib/types'

export type OfflineIssueDraft = {
  id: string
  payload: CreateIssueInput
  saved_at: string
  state: 'pending'
}

const DB_NAME = 'civicchai-offline'
const STORE_NAME = 'issue-drafts'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local draft storage is unavailable.'))
  })
}

export async function listOfflineDrafts(): Promise<OfflineIssueDraft[]> {
  if (typeof indexedDB === 'undefined') return []
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve((request.result as OfflineIssueDraft[]).sort((a, b) => a.saved_at.localeCompare(b.saved_at)))
    request.onerror = () => reject(request.error)
  })
}

export async function saveOfflineDraft(payload: CreateIssueInput): Promise<OfflineIssueDraft> {
  if (typeof indexedDB === 'undefined') throw new Error('This browser cannot store offline drafts.')
  const draft: OfflineIssueDraft = { id: `draft-${crypto.randomUUID()}`, payload, saved_at: new Date().toISOString(), state: 'pending' }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(draft)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  return draft
}

export async function removeOfflineDraft(id: string) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function syncOfflineDrafts(
  submit: (payload: CreateIssueInput) => Promise<IssueRecord>,
): Promise<{ synced: number; remaining: number }> {
  const drafts = await listOfflineDrafts()
  let synced = 0
  for (const draft of drafts) {
    try {
      await submit(draft.payload)
      await removeOfflineDraft(draft.id)
      synced += 1
    } catch {
      break
    }
  }
  return { synced, remaining: drafts.length - synced }
}
