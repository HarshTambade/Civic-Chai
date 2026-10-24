import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateChaiHeat, calculatePriorityScore, calculateTrustScore, findDuplicateCandidates } from '@/lib/scoring'

const base = {
  documentId: 'CC-401208-2026-TEST',
  department: 'Municipal Public Lighting',
  category: 'Public Lighting',
  status: 'Assigned',
  chaiHeat: 40,
  reports: 3,
  supporters: 10,
  createdAt: new Date().toISOString(),
}

test('priority bands follow the documented thresholds', () => {
  assert.equal(calculatePriorityScore({ severity: 100, supporters: 1000, reports: 50, daysUnresolved: 30, geographicImpact: 100, hasEvidence: true, overdue: true }).priority, 'Critical')
  assert.equal(calculatePriorityScore({ severity: 0, supporters: 0, reports: 1 }).priority, 'Low')
})

test('a severe issue with no votes is not ranked below a trivial popular one', () => {
  const severe = calculatePriorityScore({ severity: 95, supporters: 0, reports: 1 })
  const trivial = calculatePriorityScore({ severity: 10, supporters: 3, reports: 1 })
  assert.ok(severe.score > trivial.score)
})

test('trust describes evidence, not the citizen, and never blocks intake', () => {
  const withoutEvidence = calculateTrustScore({ hasEvidence: false, locationProvided: false, textLength: 5 })
  const withEvidence = calculateTrustScore({ hasEvidence: true, locationProvided: true, textLength: 80 })
  assert.ok(withEvidence.score > withoutEvidence.score)
  assert.ok(withoutEvidence.score > 0)
  assert.deepEqual(Object.keys(withEvidence.factors).sort(), ['anomaly', 'corroboration', 'evidence', 'location_consistency', 'report_consistency'])
})

test('chai heat matches the database formula and is capped', () => {
  assert.equal(calculateChaiHeat(0, 1), Math.round(16 * Math.log(2)))
  assert.equal(calculateChaiHeat(10, 3), Math.round(12 * Math.log(11) + 16 * Math.log(4)))
  assert.equal(calculateChaiHeat(1_000_000, 1_000_000), 100)
})

test('same wording in a different PIN is never a duplicate candidate (geographic safety)', () => {
  const existing = [{ ...base, id: 'a', title: 'Streetlight outage on Station Road', description: 'Station road lights not working', pin: '401209', locality: 'Station Road' }]
  const candidates = findDuplicateCandidates({ text: 'Station road lights not working', pin: '401208', locality: 'Station Road', category: 'Public Lighting' }, existing)
  assert.equal(candidates.length, 0)
})

test('matching wording in the same PIN is suggested, but merged duplicates are skipped', () => {
  const existing = [
    { ...base, id: 'canonical', title: 'Streetlight outage on Station Road', description: 'Station road lights not working since 15 days', pin: '401208', locality: 'Station Road' },
    { ...base, id: 'merged', status: 'Duplicate', title: 'Streetlight outage on Station Road', description: 'Station road lights not working since 15 days', pin: '401208', locality: 'Station Road' },
  ]
  const candidates = findDuplicateCandidates({ text: 'Station road lights not working since 15 days', pin: '401208', locality: 'Station Road', department: 'Municipal Public Lighting', category: 'Public Lighting' }, existing)
  assert.deepEqual(candidates.map((candidate) => candidate.issue.id), ['canonical'])
  assert.ok(candidates[0].similarity >= 0.75)
})

test('a different problem at the same place is not a strong duplicate (hard negative)', () => {
  const existing = [{ ...base, id: 'water', department: 'Water Works Department', category: 'Water Supply', title: 'Water pipeline leak', description: 'Pipeline leaking water near the market', pin: '401208', locality: 'Market Square' }]
  const candidates = findDuplicateCandidates({ text: 'Huge pothole near the market', pin: '401208', locality: 'Market Square', department: 'PWD — Roads Division', category: 'Roads & Potholes' }, existing)
  assert.ok(candidates.every((candidate) => candidate.similarity < 0.75))
})
