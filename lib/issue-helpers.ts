import type { IssueStatus } from '@/lib/types'

export const TIMELINE_STEPS: { label: string; key: IssueStatus }[] = [
  { label: 'Filed', key: 'Filed' },
  { label: 'AI classified', key: 'AI Classified' },
  { label: 'Department assigned', key: 'Assigned' },
  { label: 'Officer acknowledged', key: 'Acknowledged' },
  { label: 'In progress', key: 'In Progress' },
  { label: 'Resolved', key: 'Resolved' },
  { label: 'Community verified', key: 'Community Verified' },
  { label: 'Closed', key: 'Closed' },
]

/** Where a status sits on the main timeline; side states map to the step they pause. */
export function timelineIndex(status: IssueStatus) {
  if (status === 'Under Review') return TIMELINE_STEPS.findIndex((step) => step.key === 'AI Classified')
  if (status === 'Duplicate') return TIMELINE_STEPS.findIndex((step) => step.key === 'Filed')
  return TIMELINE_STEPS.findIndex((step) => step.key === status)
}

export function heatLabel(heat: number): string {
  if (heat >= 85) return 'Very Hot'
  if (heat >= 65) return 'Hot'
  if (heat >= 45) return 'Warm'
  return 'Cooling'
}

/**
 * Chai Tapri "hottest" ranking. Civic priority leads so a severe, low-vote issue
 * is not buried by a popular minor one; heat and independent reports follow.
 */
export function hottestScore(issue: { priorityScore?: number; chaiHeat: number; reports: number }) {
  return (issue.priorityScore ?? 0) * 0.45 + issue.chaiHeat * 0.35 + Math.log2(issue.reports + 1) * 5
}
