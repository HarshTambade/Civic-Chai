const ADJECTIVES = ['Kadak', 'Masala', 'Adrak', 'Elaichi', 'Tulsi', 'Cutting', 'Kesar', 'Pudina']
const NOUNS = ['Chai', 'Kulhad', 'Tapri', 'Biscuit', 'Samosa', 'Rusk', 'Kettle', 'Patti']

function hexFor(id: string) {
  const hex = id.toLowerCase().replace(/-/g, '')
  if (/^[0-9a-f]{8,}$/.test(hex)) return hex
  // Local preview ids are not UUIDs; derive stable hex with FNV-1a.
  let hash = 0x811c9dc5
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0
  return hash.toString(16).padStart(8, '0')
}

/**
 * Public pseudonym for an account, e.g. "KadakKulhad-3F9A". It mirrors
 * public.civicchai_handle() in supabase/migrations/006_anonymous_handles.sql.
 */
export function anonymousHandle(id: string) {
  const hex = hexFor(id)
  const adjective = ADJECTIVES[parseInt(hex.slice(0, 2), 16) % ADJECTIVES.length]
  const noun = NOUNS[parseInt(hex.slice(2, 4), 16) % NOUNS.length]
  return `${adjective}${noun}-${hex.slice(4, 8).toUpperCase()}`
}
