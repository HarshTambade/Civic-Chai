import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redactPublicText, toPublicIssue } from '@/lib/privacy'
import { buildHeatmapData } from '@/lib/heatmap'
import { timelineIndex, TIMELINE_STEPS } from '@/lib/issue-helpers'
import type { IssueRecord } from '@/lib/types'

const issue: IssueRecord = {
  id: 'issue-1',
  documentId: 'CC-401208-2026-ABCD1234',
  title: 'Garbage overflow — call 9876543210',
  description: 'Bin overflowing near flat no. B-204, mail me at resident@example.com, Aadhaar 123456789012',
  originalText: 'Private original text',
  category: 'Sanitation',
  department: 'Solid Waste Management',
  pin: '401208',
  locality: 'Station Road',
  status: 'Filed',
  priority: 'Moderate',
  trust: 50,
  chaiHeat: 11,
  supporters: 0,
  reports: 1,
  comments: 0,
  daysUnresolved: 0,
  officer: 'Internal officer name',
  hub: 'Internal hub',
  createdAt: new Date().toISOString(),
  createdBy: 'user-123',
  latitude: 19.123456,
  longitude: 72.987654,
  evidenceUrls: ['user-123/private.jpg'],
}

test('public text hides phone numbers, emails, identity numbers and house numbers', () => {
  const redacted = redactPublicText(issue.description)
  assert.ok(!redacted.includes('resident@example.com'))
  assert.ok(!redacted.includes('123456789012'))
  assert.ok(!/B-204/.test(redacted))
  assert.ok(!redactPublicText(issue.title).includes('9876543210'))
})

test('the public projection removes reporter identity, original text, evidence and coordinates', () => {
  const projected = toPublicIssue(issue)
  assert.equal(projected.originalText, undefined)
  assert.equal(projected.createdBy, undefined)
  assert.equal(projected.latitude, undefined)
  assert.equal(projected.longitude, undefined)
  assert.deepEqual(projected.evidenceUrls, [])
  assert.equal(projected.officer, 'Assignment pending')
})

test('the heatmap generalizes coordinates to roughly 1 km cells', () => {
  const data = buildHeatmapData([issue])
  assert.equal(data.cells.length, 1)
  assert.notEqual(data.cells[0].latitude, issue.latitude)
  assert.equal(Math.round(data.cells[0].latitude * 1000) % 5, 0)
  assert.equal(data.regions[0].latitude, Number(data.cells[0].latitude.toFixed(2)))
})

test('closed and side states have a place on the tracking timeline', () => {
  assert.equal(timelineIndex('Closed'), TIMELINE_STEPS.length - 1)
  assert.ok(timelineIndex('Under Review') >= 0)
  assert.ok(timelineIndex('Duplicate') >= 0)
})
