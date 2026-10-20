export type ModerationReason = 'abuse' | 'personal_data' | 'spam' | 'misinformation' | 'other'
export type ModerationStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed' | 'appealed'
export type LocalModerationReport = {
  id: string
  reporter_id?: string
  issue_id: string | null
  comment_id?: string | null
  reason: ModerationReason
  details: string
  status: ModerationStatus
  moderator_note?: string
  appeal_details?: string | null
  appealed_at?: string | null
  created_at: string
  reviewed_at?: string
}

const STORE_KEY = '__civicchai_moderation_reports__'

export function getLocalModerationReports(): LocalModerationReport[] {
  const root = globalThis as typeof globalThis & { [STORE_KEY]?: LocalModerationReport[] }
  if (!root[STORE_KEY]) root[STORE_KEY] = []
  return root[STORE_KEY]!
}
