import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canSeeIssue, coveredPins, coversPin } from '@/lib/scope'

const authority = { role: 'authority_admin', pin: '401208', servicePins: ['401209', '401210'] }
const operator = { role: 'department_operator', pin: '401208', servicePins: ['401209'], department: 'Municipal Public Lighting' }

test('an account covers its primary PIN plus its service PINs, once each', () => {
  assert.deepEqual(coveredPins({ pin: '401208', servicePins: ['401209', '401208', 'bad'] }), ['401208', '401209'])
  assert.ok(coversPin(authority, '401210'))
  assert.ok(!coversPin(authority, '400001'))
})

test('authority admins see every department in their area, and nothing outside it', () => {
  assert.ok(canSeeIssue(authority, { pin: '401209', department: 'Municipal Operations' }))
  assert.ok(!canSeeIssue(authority, { pin: '400001', department: 'Municipal Operations' }))
})

test('department staff see only their department within their area', () => {
  assert.ok(canSeeIssue(operator, { pin: '401209', department: 'Municipal Public Lighting' }))
  assert.ok(!canSeeIssue(operator, { pin: '401209', department: 'Municipal Operations' }))
  assert.ok(!canSeeIssue(operator, { pin: '401210', department: 'Municipal Public Lighting' }))
})

test('roles without issue management see no queue', () => {
  assert.ok(!canSeeIssue({ role: 'moderator', pin: '401208' }, { pin: '401208', department: 'Municipal Public Lighting' }))
  assert.ok(!canSeeIssue(null, { pin: '401208', department: 'Municipal Public Lighting' }))
})

test('demo staff with all-area scope see complaints filed at any PIN, still within their department', () => {
  assert.ok(canSeeIssue({ ...authority, allAreas: true }, { pin: '401305', department: 'Municipal Operations' }))
  assert.ok(canSeeIssue({ ...operator, allAreas: true }, { pin: '401305', department: 'Municipal Public Lighting' }))
  assert.ok(!canSeeIssue({ ...operator, allAreas: true }, { pin: '401305', department: 'Municipal Operations' }))
})
