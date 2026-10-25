import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MIGRATION_HELP, publicErrorMessage } from '@/lib/api-errors'
import { isDemoAccountEmail } from '@/lib/roles'

test('a missing-column database error tells the operator to apply migrations', () => {
  const original = console.error
  console.error = () => {}
  try {
    assert.equal(publicErrorMessage({ code: '42703', details: null, hint: null, message: 'column issues.state does not exist' }, 'Unable to file'), MIGRATION_HELP)
    assert.equal(publicErrorMessage({ code: '23505', details: 'key exists', message: 'duplicate key' }, 'Unable to file'), 'Unable to file')
  } finally {
    console.error = original
  }
})

test('validation errors keep their message', () => {
  assert.equal(publicErrorMessage(new Error('Write a comment first.'), 'Unable'), 'Write a comment first.')
})

test('only the seeded .local demo identities are treated as demo accounts', () => {
  assert.ok(isDemoAccountEmail('Operator@CivicChai.local '))
  assert.ok(!isDemoAccountEmail('operator@civicchai.gov.in'))
  assert.ok(!isDemoAccountEmail(undefined))
})
