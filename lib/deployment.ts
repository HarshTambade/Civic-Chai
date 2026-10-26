/** Migration level this release requires (see supabase/migrations/007_service_area_pins.sql). */
export const REQUIRED_SCHEMA_VERSION = 7

/** Reads an on/off deployment flag, tolerating "TRUE", "1", "yes" and surrounding spaces. */
function flag(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return undefined
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false
  return undefined
}

/**
 * Signed-in, rate-limited issue intake is on unless the pilot owner switches it off
 * with CIVICCHAI_PUBLIC_INTAKE_ENABLED=false (for example during maintenance).
 */
export function isPublicIntakeEnabled() {
  return flag(process.env.CIVICCHAI_PUBLIC_INTAKE_ENABLED) ?? true
}

/** Evidence upload stays closed in production until an approved file-handling workflow exists. */
export function areEvidenceUploadsEnabled() {
  return process.env.NODE_ENV !== 'production' || flag(process.env.CIVICCHAI_EVIDENCE_UPLOADS_ENABLED) === true
}
