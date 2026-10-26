// Postgres / PostgREST codes that mean the database schema is behind this release.
const SCHEMA_ERROR_CODES = new Set(['42703', '42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

export const MIGRATION_HELP = 'The CivicChai database is missing required migrations. An administrator must apply supabase/migrations/001 to 009 in order; /api/health shows the current state.'

export function isSchemaError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
  return SCHEMA_ERROR_CODES.has(code)
}

/**
 * A user-facing message for a failed request. Database details are logged on the
 * server and never returned; validation errors thrown as Error keep their message.
 */
export function publicErrorMessage(error: unknown, fallback: string) {
  if (isSchemaError(error)) {
    console.error(`${fallback} (schema)`, error)
    return MIGRATION_HELP
  }
  const isDatabaseError = typeof error === 'object' && error !== null && 'code' in error && 'details' in error
  if (error instanceof Error && !isDatabaseError) return error.message
  console.error(fallback, error)
  return fallback
}
