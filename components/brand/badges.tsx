import { cn } from '@/lib/utils'
import type { IssuePriority, IssueStatus } from '@/lib/types'

type Priority = IssuePriority

export function StatusBadge({ status }: { status: IssueStatus }) {
  const map: Record<IssueStatus, string> = {
    Filed: 'bg-muted text-muted-foreground',
    'AI Classified': 'bg-muted text-muted-foreground',
    Assigned: 'bg-gold/20 text-chai',
    Acknowledged: 'bg-gold/25 text-chai',
    'In Progress': 'bg-terracotta/15 text-terracotta',
    Resolved: 'bg-leaf/15 text-leaf',
    'Community Verified': 'bg-leaf/20 text-leaf',
    Closed: 'bg-leaf/15 text-leaf',
    Duplicate: 'bg-gold/20 text-chai',
    'Under Review': 'bg-terracotta/15 text-terracotta',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        map[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {status}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const map: Record<Priority, string> = {
    Critical: 'border-heat/40 bg-heat/10 text-heat',
    High: 'border-terracotta/40 bg-terracotta/10 text-terracotta',
    Moderate: 'border-gold/50 bg-gold/10 text-chai',
    Low: 'border-leaf/40 bg-leaf/10 text-leaf',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
        map[priority],
      )}
    >
      {priority}
    </span>
  )
}

export function TrustBadge({ trust }: { trust: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground"
      title="Report / evidence confidence"
    >
      <span className="font-semibold text-foreground">{trust}%</span> confidence
    </span>
  )
}

export function DepartmentBadge({ department }: { department: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-chai/8 px-2 py-0.5 text-xs font-medium text-chai">
      {department}
    </span>
  )
}
