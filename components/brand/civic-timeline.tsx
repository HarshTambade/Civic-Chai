'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { civicFetch } from '@/lib/client-api'
import type { IssueStatus } from '@/lib/types'
import { TIMELINE_STEPS, timelineIndex } from '@/lib/issue-helpers'
import { Check } from 'lucide-react'

export function CivicTimeline({
  status,
  issueId,
  className,
}: {
  status: IssueStatus
  issueId?: string
  className?: string
}) {
  const [events, setEvents] = useState<Array<{ id: string; old_status?: string | null; new_status: string; note?: string | null; evidence_url?: string; created_at: string }>>([])
  useEffect(() => {
    if (!issueId) return
    let cancelled = false
    civicFetch(`/api/issues/${issueId}/timeline`).then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load status history.'))).then((payload) => {
      if (!cancelled) setEvents(Array.isArray(payload.events) ? payload.events : [])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [issueId])
  const currentIndex = timelineIndex(status)
  const closed = status === 'Closed'
  return (
    <div className={className}>
    {status === 'Under Review' && <p className="mb-3 rounded-lg bg-terracotta/10 px-3 py-2 text-xs text-terracotta">Under review by the responsible office before assignment.</p>}
    {status === 'Duplicate' && <p className="mb-3 rounded-lg bg-gold/15 px-3 py-2 text-xs text-chai">Linked to an existing issue as a duplicate. Progress is tracked on that issue.</p>}
    <ol className="space-y-0">
      {TIMELINE_STEPS.map((step, i) => {
        const done = i < currentIndex || (closed && i === currentIndex)
        const current = i === currentIndex && !closed
        const last = i === TIMELINE_STEPS.length - 1
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                  done && 'border-leaf bg-leaf text-leaf-foreground',
                  current && 'border-terracotta bg-terracotta text-cream animate-heat',
                  !done && !current && 'border-border bg-card text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : current ? '' : ''}
              </span>
              {!last && (
                <span
                  className={cn(
                    'w-px flex-1 min-h-6',
                    done ? 'bg-leaf' : 'bg-border',
                  )}
                  aria-hidden
                />
              )}
            </div>
            <div className={cn('pb-4 pt-0.5', last && 'pb-0')}>
              <p
                className={cn(
                  'text-sm font-medium',
                  done && 'text-foreground',
                  current && 'text-terracotta font-semibold',
                  !done && !current && 'text-muted-foreground',
                )}
              >
                {step.label}
              </p>
              {current && (
                <p className="text-xs text-muted-foreground">Current stage</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
    {events.length > 0 && <ol aria-label="Recorded status events" className="mt-4 space-y-2 border-t border-border pt-3">{events.map((event) => <li key={event.id} className="border-l-2 border-terracotta/50 pl-3"><p className="text-xs font-semibold text-foreground">{event.old_status ? `${event.old_status} → ` : ''}{event.new_status}</p><p className="text-[10px] text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>{event.note && <p className="mt-1 text-xs text-muted-foreground">{event.note}</p>}{event.evidence_url && <a href={event.evidence_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium text-primary underline">Open official resolution record</a>}</li>)}</ol>}
    </div>
  )
}
