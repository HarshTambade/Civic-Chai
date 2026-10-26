import assert from 'node:assert/strict'
import test from 'node:test'
import { addCorroboratingReport, createIssue, getIssueById, getIssues, updateIssue, withdrawIssue, WithdrawRefused } from '@/lib/issues'

const input = (locality: string) => ({ title: `Streetlight outage — ${locality}`, description: `Streetlights on ${locality} are off for a week`, category: 'Public Lighting', department: 'Municipal Public Lighting', pin: '401208', locality, created_by: 'reporter-1' })

test('an untouched complaint is deleted by its reporter, and only by its reporter', async () => {
  const issue = await createIssue(input('Withdraw Lane A'), null)
  await assert.rejects(withdrawIssue(issue.id, 'someone-else', '', null), WithdrawRefused)
  assert.deepEqual(await withdrawIssue(issue.id, 'reporter-1', 'filed by mistake', null), { outcome: 'deleted', documentId: issue.documentId })
  assert.equal(await getIssueById(issue.id, null), null)
})

test('a complaint the authority acted on is withdrawn, hidden from the public and frozen', async () => {
  const issue = await createIssue(input('Withdraw Lane B'), null)
  await updateIssue(issue.id, { status: 'Acknowledged' }, 'operator-1', null)
  assert.equal((await withdrawIssue(issue.id, 'reporter-1', '', null))?.outcome, 'withdrawn')
  assert.equal((await getIssues(null)).some((item) => item.id === issue.id), false)
  assert.equal((await getIssues(null, true)).find((item) => item.id === issue.id)?.status, 'Withdrawn')
  await assert.rejects(withdrawIssue(issue.id, 'reporter-1', '', null), /already withdrawn/)
})

test('a complaint other neighbours joined stays open', async () => {
  const issue = await createIssue(input('Withdraw Lane C'), null)
  await addCorroboratingReport(issue.id, 'neighbour-1', { text: 'Same problem on this lane every night' }, null)
  await assert.rejects(withdrawIssue(issue.id, 'reporter-1', '', null), /Other neighbours have joined/)
})
