/** Version recorded on a profile when the citizen saves preferences (see /api/profile). */
export const PRIVACY_NOTICE_VERSION = 'civicchai-privacy-2026-10'

const PENDING = 'To be published by the deploying authority before the pilot accepts real reports'

/** Operator and grievance contacts come from deployment settings; nothing is invented. */
export function legalContacts() {
  return {
    operator: process.env.NEXT_PUBLIC_CIVICCHAI_OPERATOR_NAME || PENDING,
    grievanceOfficer: process.env.NEXT_PUBLIC_CIVICCHAI_GRIEVANCE_OFFICER || PENDING,
    grievanceEmail: process.env.NEXT_PUBLIC_CIVICCHAI_GRIEVANCE_EMAIL || '',
    configured: Boolean(process.env.NEXT_PUBLIC_CIVICCHAI_OPERATOR_NAME && process.env.NEXT_PUBLIC_CIVICCHAI_GRIEVANCE_OFFICER && process.env.NEXT_PUBLIC_CIVICCHAI_GRIEVANCE_EMAIL),
  }
}
