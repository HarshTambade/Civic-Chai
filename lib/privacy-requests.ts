export type PrivacyRequestType = 'access' | 'correction' | 'erasure' | 'grievance'
export type PrivacyRequestStatus = 'received' | 'in_review' | 'fulfilled' | 'declined'
export type LocalPrivacyRequest = {
  id: string
  user_id: string
  request_type: PrivacyRequestType
  details: string | null
  status: PrivacyRequestStatus
  response_note: string | null
  created_at: string
  reviewed_at: string | null
}

const STORE_KEY = '__civicchai_privacy_requests__'

/** In-process store used only by the unconfigured local preview. */
export function getLocalPrivacyRequests(): LocalPrivacyRequest[] {
  const root = globalThis as typeof globalThis & { [STORE_KEY]?: LocalPrivacyRequest[] }
  if (!root[STORE_KEY]) root[STORE_KEY] = []
  return root[STORE_KEY]!
}
