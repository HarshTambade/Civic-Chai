import assert from 'node:assert/strict'
import test from 'node:test'
import { adminPath, assessJurisdiction, localBodyTypeFrom } from '@/lib/jurisdiction'
import { analyzeComplaint } from '@/lib/ai'
import { afterClassify, handleReply, startCall } from '@/lib/voice-call'

test('municipal services go to the local body, with the urban or rural schedule', () => {
  const urban = assessJurisdiction({ text: 'Streetlight outside the school is off', category: 'Public Lighting', localBodyType: 'urban' })
  assert.equal(urban.level, 'local')
  assert.match(urban.authority, /Municipal corporation/)
  assert.match(urban.basis, /Twelfth Schedule \(Article 243W\): public amenities including street lighting/)

  const rural = assessJurisdiction({ text: 'Village road has big potholes', category: 'Roads & Potholes', localBodyType: 'rural' })
  assert.match(rural.authority, /Gram panchayat/)
  assert.match(rural.basis, /Eleventh Schedule \(Article 243G\): roads, culverts, bridges/)

  const unknown = assessJurisdiction({ text: 'No water since Monday', category: 'Water Supply' })
  assert.match(unknown.basis, /Twelfth Schedule.*Eleventh Schedule/)
})

test('Union and State subjects are recognised from the complaint text', () => {
  assert.equal(assessJurisdiction({ text: 'Huge pothole on NH 48 near the toll plaza', category: 'Roads & Potholes' }).ruleId, 'national-highway')
  assert.equal(assessJurisdiction({ text: 'राष्ट्रीय महामार्गावर खड्डे', category: 'Roads & Potholes' }).level, 'union')
  assert.equal(assessJurisdiction({ text: 'The railway station foot bridge is broken', category: 'General civic issue' }).ruleId, 'railways')
  assert.equal(assessJurisdiction({ text: 'Potholes on the state highway to Wada', category: 'Roads & Potholes' }).ruleId, 'state-highway')
  assert.equal(assessJurisdiction({ text: 'Power cut for 10 hours, transformer sparking', category: 'General civic issue' }).ruleId, 'electricity')
  assert.equal(assessJurisdiction({ text: 'Signal at the junction is broken', category: 'Traffic' }).level, 'state')
})

test('streetlights stay with the local body even when wires or poles are mentioned', () => {
  const result = assessJurisdiction({ text: 'Street light pole has a live wire hanging', category: 'Public Lighting' })
  assert.equal(result.level, 'local')
})

test('urban or rural comes from the map, else from the post office serving the locality', () => {
  assert.equal(localBodyTypeFrom({ mapSettlement: 'urban' }), 'urban')
  const offices = [{ name: 'Nallasopara', branchType: 'Sub Post Office' }, { name: 'Achole', branchType: 'Branch Post Office' }]
  assert.equal(localBodyTypeFrom({ locality: 'Achole', offices }), 'rural')
  assert.equal(localBodyTypeFrom({ locality: 'Nallasopara East', offices }), 'unknown')
  assert.equal(localBodyTypeFrom({ locality: 'Kaman', offices: [{ name: 'Kaman', branchType: 'Branch Post Office' }] }), 'rural')
})

test('the administrative path skips what is not known', () => {
  assert.deepEqual(adminPath({ state: 'Maharashtra', district: 'Palghar', subDistrict: 'Vasai', municipality: 'Vasai-Virar', pin: '401208' }), ['Maharashtra', 'Palghar', 'Vasai', 'Vasai-Virar', 'PIN 401208'])
  assert.deepEqual(adminPath({ pin: '401208' }), ['PIN 401208'])
})

test('the analysis and the call agent carry the jurisdiction', () => {
  const analysis = analyzeComplaint('Big pothole on NH48 near Vasai phata for two weeks', 'English', { pin: '401208', locality: 'Vasai' })
  assert.equal(analysis.jurisdiction?.level, 'union')
  const turn = afterClassify(handleReply(startCall('en').state, 'Big pothole on NH48 near Vasai phata').state, analysis)
  assert.match(turn.say, /National Highways Authority/)
  assert.match(turn.say, /forward it/)
})
