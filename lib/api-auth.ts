import { getSupabaseClient, getSupabaseClientForToken, isDemoModeEnabled, isLocalDemoModeEnabled } from '@/lib/supabase'
import { isAppRole, isDemoAccountEmail, requiresMfa, type AppRole } from '@/lib/roles'
import { anonymousHandle } from '@/lib/anonymity'

export type RequestActor = { id?: string; email?: string; name?: string; handle?: string; role?: AppRole; pin?: string; servicePins?: string[]; department?: string; demo?: boolean }

function servicePinsOf(profile: unknown): string[] {
  const value = (profile as { service_pins?: unknown } | null)?.service_pins
  return Array.isArray(value) ? value.filter((pin): pin is string => typeof pin === 'string') : []
}

export async function getRequestContext(request: Request) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (token) {
    const client = getSupabaseClientForToken(token)
    if (!client) return { actor: null as RequestActor | null, client: null, authenticated: false, mfaRequired: false }
    const [{ data, error }, verifiedToken] = await Promise.all([
      client.auth.getUser(token),
      client.auth.getClaims(token),
    ])
    if (error || !data.user || verifiedToken.error || !verifiedToken.data?.claims) return { actor: null as RequestActor | null, client, authenticated: false, mfaRequired: false }
    // service_pins arrives with migration 007; older databases fall back to the single PIN.
    const scoped = await client.from('profiles').select('role, display_name, pin, department, service_pins').eq('id', data.user.id).maybeSingle()
    const { data: profile } = scoped.error
      ? await client.from('profiles').select('role, display_name, pin, department').eq('id', data.user.id).maybeSingle()
      : scoped
    // Authorization comes from the protected profile row, never editable auth metadata.
    const role = profile?.role
    const validRole = isAppRole(role) ? role : undefined
    // Seeded demo staff skip MFA only while demo mode is on; real staff accounts always need AAL2.
    const demoExempt = isDemoModeEnabled() && isDemoAccountEmail(data.user.email)
    const mfaRequired = Boolean(validRole && requiresMfa(validRole) && verifiedToken.data.claims.aal !== 'aal2' && !demoExempt)
    return {
      actor: {
        id: data.user.id,
        email: data.user.email,
        name: profile?.display_name ?? data.user.email,
        handle: anonymousHandle(data.user.id),
        role: mfaRequired ? undefined : validRole,
        pin: profile?.pin ?? undefined,
        servicePins: servicePinsOf(profile),
        department: profile?.department ?? undefined,
      } satisfies RequestActor,
      client,
      authenticated: true,
      mfaRequired,
    }
  }

  // The header-based identity is available only in the unconfigured local demo.
  if (isLocalDemoModeEnabled()) {
    const role = request.headers.get('x-civicchai-demo-role')
    const actor: RequestActor | null = isAppRole(role) ? {
      id: request.headers.get('x-civicchai-demo-id') ?? undefined,
      email: request.headers.get('x-civicchai-demo-email') ?? undefined,
      name: request.headers.get('x-civicchai-demo-name') ?? undefined,
      handle: anonymousHandle(request.headers.get('x-civicchai-demo-id') ?? role),
      role,
      pin: request.headers.get('x-civicchai-demo-pin') ?? undefined,
      servicePins: (request.headers.get('x-civicchai-demo-service-pins') ?? '').split(',').filter(Boolean),
      department: request.headers.get('x-civicchai-demo-department') ?? undefined,
      demo: true,
    } : null
    return { actor, client: null, authenticated: Boolean(actor), mfaRequired: false }
  }

  return { actor: null as RequestActor | null, client: getSupabaseClient(), authenticated: false, mfaRequired: false }
}

export async function authorizeRoles(request: Request, allowed: AppRole[]) {
  const context = await getRequestContext(request)
  if (context.mfaRequired) {
    return { ...context, response: Response.json({ error: 'Set up or verify your staff multi-factor authentication to continue.', code: 'mfa_required' }, { status: 403 }) }
  }
  if (!context.authenticated || !context.actor?.role || !allowed.includes(context.actor.role)) {
    return { ...context, response: Response.json({ error: 'You do not have access to this action.' }, { status: 403 }) }
  }
  return { ...context, response: null }
}
