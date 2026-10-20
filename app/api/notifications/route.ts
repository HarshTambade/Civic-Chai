import { NextResponse } from 'next/server'
import { getRequestContext } from '@/lib/api-auth'
import { listFallbackNotifications, markFallbackNotificationsRead } from '@/lib/notifications'

export async function GET(request: Request) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to view notifications.' }, { status: 401 })
  if (!client) return NextResponse.json({ notifications: listFallbackNotifications(actor.id) })
  const { data, error } = await client.from('notifications').select('id,user_id,issue_id,kind,title,body,read_at,created_at').eq('user_id', actor.id).order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Unable to load notifications.' }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [] })
}

export async function PATCH(request: Request) {
  const { actor, client, authenticated } = await getRequestContext(request)
  if (!authenticated || !actor?.id) return NextResponse.json({ error: 'Sign in to update notifications.' }, { status: 401 })
  try {
    const body = await request.json()
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string').slice(0, 100) : undefined
    if (body.mark_all !== true && !ids?.length) return NextResponse.json({ error: 'Choose notifications to mark as read.' }, { status: 400 })
    if (!client) return NextResponse.json({ notifications: markFallbackNotificationsRead(actor.id, body.mark_all === true ? undefined : ids) })
    let query = client.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', actor.id).is('read_at', null)
    if (body.mark_all !== true && ids) query = query.in('id', ids)
    const { error } = await query
    if (error) return NextResponse.json({ error: 'Unable to update notifications.' }, { status: 500 })
    const refreshed = await client.from('notifications').select('id,user_id,issue_id,kind,title,body,read_at,created_at').eq('user_id', actor.id).order('created_at', { ascending: false }).limit(100)
    return NextResponse.json({ notifications: refreshed.data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update notifications.' }, { status: 400 })
  }
}
