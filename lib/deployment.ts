/** Public intake stays closed in production until the pilot owner enables it. */
export function isPublicIntakeEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.CIVICCHAI_PUBLIC_INTAKE_ENABLED === 'true'
}

/** Evidence upload stays closed in production until an approved file-handling workflow exists. */
export function areEvidenceUploadsEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.CIVICCHAI_EVIDENCE_UPLOADS_ENABLED === 'true'
}
