import { test } from 'node:test'
import assert from 'node:assert/strict'
import { joinTranscript, transcriptFromResults } from '@/components/citizen/speech'

const result = (transcript: string, isFinal: boolean) => ({ isFinal, 0: { transcript } })

test('desktop Chrome: interim updates never duplicate the final sentence', () => {
  // Each event carries the full result list; earlier code appended every update.
  const events = [
    [result('station road', false)],
    [result('station road ki light', false)],
    [result('station road ki light band hai', true)],
  ]
  let text = ''
  for (const results of events) {
    const { finalText } = transcriptFromResults(results)
    if (finalText) text = joinTranscript('', finalText)
  }
  assert.equal(text, 'station road ki light band hai')
})

test('Android Chrome: cumulative final results are kept once', () => {
  const results = [result('station road', true), result('station road ki light', true), result('station road ki light band hai', true)]
  assert.equal(transcriptFromResults(results).finalText, 'station road ki light band hai')
})

test('separate sentences in one session are joined, and earlier text is kept', () => {
  const results = [result('the streetlight is off', true), result('since fifteen days', true), result('near the school', false)]
  const { finalText, interim } = transcriptFromResults(results)
  assert.equal(finalText, 'the streetlight is off since fifteen days')
  assert.equal(interim, 'near the school')
  assert.equal(joinTranscript('Ward 4:', finalText), 'Ward 4: the streetlight is off since fifteen days')
})
