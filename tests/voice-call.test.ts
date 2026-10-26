import assert from 'node:assert/strict'
import test from 'node:test'
import { afterClassify, afterFiled, extractDuration, extractPin, handleDigits, handleReply, handleSilence, parseYesNo, spellId, startCall, withCoverage } from '@/lib/voice-call'

test('PINs are understood from digits, spaced digits, words and Devanagari', () => {
  assert.equal(extractPin('it is 401208'), '401208')
  assert.equal(extractPin('4 0 1 2 0 9'), '401209')
  assert.equal(extractPin('four zero one two oh eight'), '401208')
  assert.equal(extractPin('four zero one double zero eight'), '401008')
  assert.equal(extractPin('पिन ४०१२०८ है'), '401208')
  assert.equal(extractPin('चार शून्य एक दो शून्य नौ'), '401209')
  assert.equal(extractPin('for 10 days near gate 3'), '')
})

test('yes and no are read in English, Hindi and Marathi', () => {
  assert.equal(parseYesNo('Yes, that is correct'), 'yes')
  assert.equal(parseYesNo('हाँ'), 'yes')
  assert.equal(parseYesNo('होय बरोबर'), 'yes')
  assert.equal(parseYesNo('nahi'), 'no')
  assert.equal(parseYesNo('नाही'), 'no')
  assert.equal(parseYesNo('the light is broken'), null)
})

test('durations are picked out of a sentence', () => {
  assert.equal(extractDuration('The streetlight has been off for 10 days near the school'), '10 days')
  assert.equal(extractDuration('since last week the drain overflows'), 'since last week')
  assert.equal(extractDuration('दो हफ़्ते से पानी नहीं आ रहा'), 'दो हफ़्ते से')
})

test('a full call fills every slot, reads back, and files only after yes', () => {
  let turn = startCall('en', { pin: '401209', locality: 'Nallasopara East' })
  assert.match(turn.say, /What problem/)

  turn = handleReply(turn.state, 'The streetlight outside the school has been off for 10 days')
  assert.equal(turn.action, 'classify')
  assert.equal(turn.state.slots.duration, '10 days')

  turn = afterClassify(turn.state, { issue: 'Streetlight outage', department: 'Municipal Public Lighting' })
  assert.equal(turn.state.stage, 'location')
  assert.match(turn.say, /Municipal Public Lighting/)
  assert.match(turn.say, /Nallasopara East, PIN 4 0 1 2 0 9/)

  turn = handleReply(turn.state, 'yes')
  assert.equal(turn.state.slots.pin, '401209')
  assert.equal(turn.state.stage, 'proof', 'duration was already given, so it is not asked again')

  turn = handleDigits(turn.state, '2')
  assert.equal(turn.state.stage, 'confirm')
  assert.equal(turn.state.slots.proof, false)
  assert.match(turn.say, /Is this correct/)
  assert.equal(turn.action, undefined, 'nothing is filed before the caller confirms')

  turn = handleReply(turn.state, 'yes please file it')
  assert.equal(turn.action, 'file')

  turn = afterFiled(turn.state, 'CC-401209-2026-5FE49A6D')
  assert.equal(turn.action, 'hangup')
  assert.match(turn.say, /C C, 4 0 1 2 0 9, 2 0 2 6, 5 F E 4 9 A 6 D/)
})

test('without device location the agent asks for the area, then the PIN', () => {
  let turn = startCall('hi')
  turn = afterClassify(handleReply(turn.state, 'सड़क पर बहुत बड़ा गड्ढा है').state, { issue: 'Road damage', department: 'PWD — Roads Division' })
  assert.equal(turn.state.stage, 'location')
  turn = handleReply(turn.state, 'स्टेशन रोड')
  assert.equal(turn.state.slots.locality, 'स्टेशन रोड')
  assert.equal(turn.state.stage, 'pin')
  turn = handleReply(turn.state, 'मुझे नहीं पता')
  assert.equal(turn.state.stage, 'pin', 'an unclear PIN is asked again')
  turn = handleDigits(turn.state, '401208')
  assert.equal(turn.state.stage, 'duration')
})

test('the caller can correct the read-back before filing', () => {
  let turn = startCall('en', { pin: '401208', locality: 'Vasai' })
  turn = afterClassify(handleReply(turn.state, 'Garbage is overflowing near the market').state, { issue: 'Garbage overflow', department: 'Solid Waste Management' })
  turn = handleReply(turn.state, 'yes')
  turn = handleReply(turn.state, "I don't know")
  assert.equal(turn.state.slots.duration, '')
  turn = handleReply(turn.state, 'no')
  assert.equal(turn.state.stage, 'confirm')

  // A PIN spoken in the correction replaces the old one and is read back again.
  turn = handleReply(turn.state, 'no, the pin is 401210')
  assert.equal(turn.state.slots.pin, '401210')
  assert.equal(turn.state.stage, 'confirm')

  turn = handleReply(turn.state, 'no')
  assert.equal(turn.state.stage, 'change')
  turn = handleReply(turn.state, 'the place')
  assert.equal(turn.state.stage, 'location')
  assert.equal(turn.state.slots.pin, '')

  const covered = withCoverage({ ...turn.state, slots: { ...turn.state.slots, pin: '400001', locality: 'Fort' }, locationSettled: true, stage: 'confirm' }, '400001', false)
  assert.match(handleSilence(covered).say, /no authority team covers PIN 4 0 0 0 0 1/)
})

test('silence is re-prompted, and the keypad is offered after two misses', () => {
  let turn = startCall('mr')
  turn = handleSilence(turn.state)
  assert.doesNotMatch(turn.say, /कीपॅड/)
  turn = handleSilence(turn.state)
  assert.match(turn.say, /कीपॅड/)
  assert.equal(spellId('CC-1'), 'C C, 1')
})
