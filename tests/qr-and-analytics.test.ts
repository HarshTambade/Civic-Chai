import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signQrArea, verifyQrToken } from '@/lib/qr'
import { buildAnalytics, median } from '@/lib/analytics'
import type { IssueRecord } from '@/lib/types'

test('a signed locality QR verifies, and altered or forged codes are rejected', () => {
  const token = signQrArea({ pin: '401208', locality: 'Station Road market', ward: 'Ward 4' })
  assert.deepEqual({ ...verifyQrToken(token), issuedAt: undefined }, { pin: '401208', locality: 'Station Road market', ward: 'Ward 4', issuedAt: undefined })
  const [body, sig] = token.split('.')
  const forgedBody = Buffer.from(JSON.stringify({ v: 1, p: '110001', l: 'Elsewhere' })).toString('base64url')
  assert.equal(verifyQrToken(`${forgedBody}.${sig}`), null)
  assert.equal(verifyQrToken(`${body}.${sig.slice(0, -2)}AA`), null)
  assert.equal(verifyQrToken('not-a-token'), null)
})

const hour = 3_600_000
const base = Date.parse('2026-10-20T00:00:00Z')
const issue = (id: string, overrides: Partial<IssueRecord> = {}): IssueRecord => ({
  id, documentId: `CC-${id}`, title: id, description: '', category: 'Public Lighting', department: 'Municipal Public Lighting',
  pin: '401208', locality: 'Station Road', status: 'Filed', priority: 'Moderate', trust: 50, chaiHeat: 20, supporters: 0, reports: 1,
  comments: 0, daysUnresolved: 0, officer: '', hub: '', createdAt: new Date(base).toISOString(), ...overrides,
})

test('median handles odd, even and empty inputs', () => {
  assert.equal(median([5, 1, 3]), 3)
  assert.equal(median([1, 2, 3, 4]), 2.5)
  assert.equal(median([]), null)
})

test('KPIs measure time to first acknowledgement and resolution, excluding demo data', () => {
  const issues = [
    issue('a', { status: 'Resolved', hasEvidence: true, reports: 3 }),
    issue('b', { status: 'Acknowledged' }),
    issue('c', { status: 'Duplicate' }),
    issue('demo', { isDemo: true }),
  ]
  const at = (hours: number) => new Date(base + hours * hour).toISOString()
  const events = [
    { issue_id: 'a', new_status: 'Acknowledged', created_at: at(2) },
    { issue_id: 'a', new_status: 'Resolved', created_at: at(30) },
    { issue_id: 'b', new_status: 'Acknowledged', created_at: at(6) },
  ]
  const report = buildAnalytics(issues, events, [], base + 100 * hour)
  assert.equal(report.kpis.medianHoursToAcknowledge, 4)
  assert.equal(report.kpis.medianHoursToResolve, 30)
  assert.equal(report.totals.issues, 2)
  assert.equal(report.totals.syntheticExcluded, 1)
  // 5 reports filed (3 + 1 + 1 duplicate); 2 corroborations + 1 merged duplicate were consolidated.
  assert.equal(report.kpis.duplicateReductionPercent, 60)
})

test('a sudden support spike on an older issue is flagged for review, not hidden', () => {
  const now = base + 10 * 24 * hour
  const supports = Array.from({ length: 12 }, () => ({ issue_id: 'spiky', created_at: new Date(now - hour).toISOString() }))
  const report = buildAnalytics([issue('spiky', { supporters: 12 })], [], supports, now)
  assert.equal(report.trending[0].id, 'spiky')
  assert.ok(report.trending[0].flags.some((flag) => flag.includes('spike')))
})
