import { getSupabaseClient, getSupabaseClientForToken, hasSupabaseConfig } from '@/lib/supabase'
import { isAppRole, type AppRole } from '@/lib/roles'

export type RequestActor = { id?: string; email?: string; name?: string; role?: AppRole; pin?: string; department?: string; demo?: boolean }

export async function getRequestContext(request: Request) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (token) {
    const client = getSupabaseClientForToken(token)
    if (!client) return { actor: null as RequestActor | null, client: null, authenticated: false }
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user) return { actor: null as RequestActor | null, client, authenticated: false }
    const { data: profile } = await client.from('profiles').select('role, display_name, pin, department').eq('id', data.user.id).maybeSingle()
    // Authorization comes from the protected profile row, never editable auth metadata.
    const role = profile?.role
    return {
      actor: {
        id: data.user.id,
        email: data.user.email,
        name: profile?.display_name ?? data.user.email,
        role: isAppRole(role) ? role : undefined,
        pin: profile?.pin ?? undefined,
        department: profile?.department ?? undefined,
      } satisfies RequestActor,
      client,
      authenticated: true,
    }
  }

  // The header-based identity is available only in the unconfigured local demo.
  if (!hasSupabaseConfig()) {
    const role = request.headers.get('x-civicchai-demo-role')
    const actor: RequestActor | null = isAppRole(role) ? {
      id: request.headers.get('x-civicchai-demo-id') ?? undefined,
      email: request.headers.get('x-civicchai-demo-email') ?? undefined,
      name: request.headers.get('x-civicchai-demo-name') ?? undefined,
      role,
      pin: request.headers.get('x-civicchai-demo-pin') ?? undefined,
      department: request.headers.get('x-civicchai-demo-department') ?? undefined,
      demo: true,
    } : null
    return { actor, client: null, authenticated: Boolean(actor) }
  }

  return { actor: null as RequestActor | null, client: getSupabaseClient(), authenticated: false }
}

export async function authorizeRoles(request: Request, allowed: AppRole[]) {
  const context = await getRequestContext(request)
  if (!context.authenticated || !context.actor?.role || !allowed.includes(context.actor.role)) {
    return { ...context, response: Response.json({ error: 'You do not have access to this action.' }, { status: 403 }) }
  }
  return { ...context, response: null }
}
