export type FallbackDuplicateLink = {
  issue_a: string
  issue_b: string
  similarity: number
  decision: 'suggested' | 'joined' | 'distinct' | 'merged' | 'unmerged'
  previous_status?: string
  decided_by?: string
  decided_at: string
}

const KEY = '__civicchai_duplicate_links__'
export function getFallbackDuplicateLinks() {
  const root = globalThis as typeof globalThis & { [KEY]?: FallbackDuplicateLink[] }
  if (!root[KEY]) root[KEY] = []
  return root[KEY]!
}
