import { test } from 'node:test'
import assert from 'node:assert/strict'
import { anonymousHandle } from '@/lib/anonymity'
import { buildPublicMapCells } from '@/lib/heatmap'
import type { IssueRecord } from '@/lib/types'

test('handles are stable, pseudonymous and match the SQL function', () => {
  // 0x49 % 8 = 1 → Masala, 0x48 % 8 = 0 → Chai, suffix from hex characters 5-8.
  assert.equal(anonymousHandle('4948ee34-9166-46a7-8616-f2399aadab97'), 'MasalaChai-EE34')
  assert.equal(anonymousHandle('demo-citizen'), anonymousHandle('demo-citizen'))
  assert.match(anonymousHandle('demo-citizen'), /^[A-Z][a-z]+[A-Z][a-z]+-[0-9A-F]{4}$/)
  assert.notEqual(anonymousHandle('demo-citizen'), anonymousHandle('demo-operator'))
})

const issue = (id: string, latitude: number, longitude: number, chaiHeat: number): IssueRecord => ({
  id, documentId: `CC-${id}`, title: `Issue ${id}`, description: '', category: 'Sanitation', department: 'Solid Waste Management',
  pin: '401208', locality: 'Station Road', status: 'Filed', priority: 'Moderate', trust: 50, chaiHeat,
  supporters: 0, reports: 1, comments: 0, daysUnresolved: 0, officer: '', hub: '', createdAt: new Date().toISOString(), latitude, longitude,
})

test('the public map groups nearby reports and never returns exact coordinates', () => {
  const cells = buildPublicMapCells([issue('a', 19.37112, 72.89211, 40), issue('b', 19.37388, 72.89601, 80), issue('c', 19.45512, 72.81061, 10)])
  assert.equal(cells.length, 2)
  assert.equal(cells[0].issueCount, 2)
  assert.equal(cells[0].averageChaiHeat, 60)
  assert.deepEqual(cells[0].issues.map((item) => item.id), ['b', 'a'])
  for (const cell of cells) {
    assert.ok(![19.37112, 19.37388, 19.45512].includes(cell.latitude))
    assert.ok(!('latitude' in cell.issues[0]))
  }
})
