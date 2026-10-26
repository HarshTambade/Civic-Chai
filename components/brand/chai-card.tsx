'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { civicFetch } from '@/lib/client-api'
import { useAuth } from '@/components/auth-provider'
import { haptic } from '@/components/haptics'
import type { IssueRecord } from '@/lib/types'
import type { IssueComment } from '@/lib/issues'
import { ChaiHeatMeter } from './chai-heat-meter'
import { StatusBadge, DepartmentBadge } from './badges'
import { MapPin, MessageCircle, Users, Flame, X, Send, ShieldAlert, Bookmark } from 'lucide-react'

export function ChaiCard({ issue }: { issue: IssueRecord }) {
  const { user } = useAuth()
  const [supported, setSupported] = useState(false)
  const [following, setFollowing] = useState(false)
  const [supporters, setSupporters] = useState(issue.supporters)
  const [heat, setHeat] = useState(issue.chaiHeat)
  const [message, setMessage] = useState('')
  const [discussionOpen, setDiscussionOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null)
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('personal_data')
  const [reportDetails, setReportDetails] = useState('')
  const [comments, setComments] = useState<IssueComment[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([
      civicFetch(`/api/issues/${issue.id}/support`).then((response) => response.json()),
      civicFetch(`/api/issues/${issue.id}/follow`).then((response) => response.json()),
    ]).then(([supportData, followData]) => { setSupported(Boolean(supportData.supported)); setFollowing(Boolean(followData.following)) }).catch(() => {})
  }, [issue.id, user])

  async function toggleFollow() {
    setMessage('')
    if (!user) { setMessage('Sign in to follow issue updates.'); return }
    setBusy(true)
    try {
      const response = await civicFetch(`/api/issues/${issue.id}/follow`, { method: following ? 'DELETE' : 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not update follow settings.')
      setFollowing(Boolean(data.following))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update follow settings.') } finally { setBusy(false) }
  }

  async function supportIssue() {
    setMessage('')
    if (!user) {
      setMessage('Sign in to add one support per account.')
      return
    }
    setBusy(true)
    try {
      const response = await civicFetch(`/api/issues/${issue.id}/support`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not add support.')
      setSupported(true)
      setSupporters(data.issue.supporters)
      setHeat(data.issue.chaiHeat)
      haptic('success')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add support.')
    } finally {
      setBusy(false)
    }
  }

  async function openDiscussion() {
    setDiscussionOpen(true)
    const response = await civicFetch(`/api/issues/${issue.id}/comments`)
    if (response.ok) {
      const data = await response.json()
      setComments(Array.isArray(data.comments) ? data.comments : [])
    }
  }

  async function postComment(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.trim()) return
    setBusy(true)
    setMessage('')
    try {
      const response = await civicFetch(`/api/issues/${issue.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not post comment.')
      setComments((current) => [data.comment, ...current])
      setDraft('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not post comment.')
    } finally {
      setBusy(false)
    }
  }

  async function submitReport(event: React.FormEvent) {
    event.preventDefault()
    if (!user) { setMessage('Sign in to report content.'); return }
    setBusy(true)
    setMessage('')
    try {
      const response = await civicFetch(`/api/issues/${issue.id}/report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason, details: reportDetails, comment_id: reportingCommentId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Unable to send this report.')
      setReportOpen(false)
      setSubmittedReportId(data.report?.id ?? null)
      setReportingCommentId(null)
      setReportDetails('')
      setMessage('Report sent to the moderation queue.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to send this report.') } finally { setBusy(false) }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-terracotta" />
            <span className="font-medium text-foreground">{issue.pin}</span><span>·</span><span className="truncate">{issue.locality}</span>
          </div>
          <h3 className="font-display text-base font-bold leading-snug text-foreground"><Link href={`/issues/${encodeURIComponent(issue.id)}`} className="hover:text-chai hover:underline">{issue.title}</Link></h3>
          {issue.isDemo && <span className="mt-1 inline-flex rounded bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-chai">Synthetic demo record</span>}
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">{issue.documentId}</p>
        </div>
        <StatusBadge status={issue.status} />
      </div>
      <p className="px-4 text-sm leading-relaxed text-muted-foreground">{issue.description}</p>
      <div className="px-4 pt-2"><Link href={`/issues/${encodeURIComponent(issue.id)}`} className="text-xs font-semibold text-chai underline underline-offset-2">Open structured civic report</Link></div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <DepartmentBadge department={issue.department} />
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{issue.category}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border bg-secondary/40 px-4 py-3">
        <ChaiHeatMeter heat={heat} size="sm" />
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{supporters.toLocaleString('en-IN')}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{comments.length || issue.comments}</span>
          <span>{issue.daysUnresolved > 0 ? `${issue.daysUnresolved}d open` : 'New'}</span>
        </div>
      </div>
      <div className="flex gap-2 p-3">
        <button onClick={supportIssue} disabled={supported || busy} aria-pressed={supported} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-default', supported ? 'bg-heat text-heat-foreground' : 'bg-heat/10 text-heat hover:bg-heat/20')}>
          <Flame className="h-4 w-4" />{supported ? 'Supported' : 'Support'}
        </button>
        <button onClick={openDiscussion} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-chai/10 px-3 py-2 text-sm font-semibold text-chai transition-colors hover:bg-chai/20">
          <MessageCircle className="h-4 w-4" /> Charcha
        </button>
        <button onClick={toggleFollow} aria-pressed={following} aria-label={following ? 'Unfollow this issue' : 'Follow this issue'} className={cn('rounded-xl px-3 py-2', following ? 'bg-chai text-cream' : 'bg-muted text-charcoal/60 hover:text-chai')}><Bookmark className="h-4 w-4" /></button>
        <button onClick={() => setReportOpen(true)} aria-label="Report this issue" className="rounded-xl bg-muted px-3 py-2 text-charcoal/60 hover:text-heat"><ShieldAlert className="h-4 w-4" /></button>
      </div>
      {message && <p role="status" className="px-4 pb-3 text-xs text-terracotta">{message} {!user && <Link className="font-semibold underline" href="/login">Sign in</Link>}</p>}

      {discussionOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-charcoal/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Discussion for ${issue.title}`}>
          <div className="max-h-[80dvh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-background sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div><p className="text-xs text-charcoal/50">{issue.documentId}</p><h3 className="font-display font-bold">Charcha · {issue.title}</h3></div>
              <button aria-label="Close discussion" onClick={() => setDiscussionOpen(false)} className="rounded-lg p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[48dvh] space-y-3 overflow-y-auto p-4">
              {comments.length ? comments.map((comment) => <article key={comment.id} className="rounded-xl border border-border bg-card p-3"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold">{comment.display_name}</p>{user && <button type="button" onClick={() => { setReportingCommentId(comment.id); setReportOpen(true) }} className="text-[10px] font-semibold text-charcoal/50 underline">Report comment</button>}</div><p className="mt-1 whitespace-pre-wrap text-sm text-charcoal/75">{comment.body}</p></article>) : <p className="text-sm text-charcoal/55">No comments yet. Add context or a useful update.</p>}
            </div>
            <form onSubmit={postComment} className="border-t border-border p-4">
              <label htmlFor={`comment-${issue.id}`} className="sr-only">Write a comment</label>
              <div className="flex gap-2"><input id={`comment-${issue.id}`} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder={user ? 'Add a useful, respectful update…' : 'Sign in to join this discussion'} disabled={!user || busy} className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-chai" /><button disabled={!user || busy || !draft.trim()} className="rounded-lg bg-chai px-3 text-cream disabled:opacity-50" aria-label="Post comment"><Send className="h-4 w-4" /></button></div>
              {message && <p role="status" className="mt-2 text-xs text-terracotta">{message} {!user && <Link className="font-semibold underline" href="/login">Sign in</Link>}</p>}
            </form>
          </div>
        </div>
      )}
      {submittedReportId && <p className="px-4 pb-3 text-xs text-charcoal/55">Moderation report reference: <span className="font-mono">{submittedReportId}</span>. You can track it in Profile.</p>}
      {reportOpen && <div className="fixed inset-0 z-[75] flex items-center justify-center bg-charcoal/55 p-4" role="dialog" aria-modal="true" aria-label={`Report ${reportingCommentId ? 'comment' : issue.title}`}><form onSubmit={submitReport} className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-background p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display font-bold">Report {reportingCommentId ? 'this comment' : 'this issue'}</h3><p className="mt-1 text-xs text-charcoal/55">A moderator will review this report. Good-faith criticism is allowed.</p></div><button type="button" aria-label="Close report form" onClick={() => { setReportOpen(false); setReportingCommentId(null) }} className="rounded-lg p-2 hover:bg-muted"><X className="h-4 w-4" /></button></div><label className="block text-xs font-semibold text-charcoal/70">Reason<select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"><option value="personal_data">Personal information</option><option value="abuse">Abuse or harassment</option><option value="spam">Spam</option><option value="misinformation">Potentially misleading information</option><option value="other">Other concern</option></select></label><label className="block text-xs font-semibold text-charcoal/70">Context (optional)<textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" /></label>{message && <p role="status" className="text-xs text-terracotta">{message}</p>}<button disabled={busy} className="w-full rounded-lg bg-chai px-4 py-2.5 text-sm font-semibold text-cream disabled:opacity-50">{busy ? 'Sending…' : 'Send to moderators'}</button>{!user && <p className="text-center text-xs text-charcoal/60"><Link href="/login" className="font-semibold text-chai underline">Sign in</Link> to submit a content report.</p>}</form></div>}
    </article>
  )
}
