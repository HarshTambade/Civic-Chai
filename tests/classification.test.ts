import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORY_OPTIONS, DEPARTMENT_OPTIONS, analyzeComplaint, categoryOption } from '@/lib/ai'

// SOP §16: Hindi, Marathi, English and code-mixed examples classify into the taxonomy.
const EXAMPLES: Array<[string, string, string]> = [
  ['15 din se Station Road ki lights band hain', 'Public Lighting', 'Hinglish'],
  ['Streetlight not working near the school gate for a week', 'Public Lighting', 'English'],
  ['हमारे मोहल्ले में कचरा तीन दिन से नहीं उठाया गया', 'Sanitation', 'Hindi'],
  ['आमच्या भागात पाणी येत नाही आहे', 'Water Supply', 'Marathi'],
  ['Big pothole on the main road causing accidents', 'Roads & Potholes', 'English'],
  ['गटार तुंबले आहे आणि रस्त्यावर पाणी साचले', 'Drainage', 'Marathi'],
]

for (const [text, category, language] of EXAMPLES) {
  test(`classifies "${text}" as ${category}`, () => {
    const result = analyzeComplaint(text, 'Auto Detect', { pin: '401208', locality: 'Station Road' })
    assert.equal(result.category, category)
    assert.equal(result.language, language)
    assert.equal(result.department, categoryOption(category).department)
    assert.equal(result.modelVersion, 'civicchai-rules-v1')
  })
}

test('unknown complaints fall back to the general route instead of guessing', () => {
  const result = analyzeComplaint('Please look into the issue near our building', 'English', { pin: '401208', locality: 'Ward 5' })
  assert.equal(result.category, 'General civic issue')
  assert.equal(result.department, 'Municipal Operations')
  assert.ok(result.confidence < 76, 'fallback confidence stays below matched-taxonomy confidence')
})

test('safety words raise severity', () => {
  const routine = analyzeComplaint('Streetlight not working', 'English')
  const urgent = analyzeComplaint('Streetlight wire sparking, children got a shock near school', 'English')
  assert.ok(urgent.severity > routine.severity)
})

test('every category routes to a configured department', () => {
  for (const option of CATEGORY_OPTIONS) assert.ok(DEPARTMENT_OPTIONS.includes(option.department), option.category)
  assert.ok(DEPARTMENT_OPTIONS.includes('Municipal Operations'))
  assert.equal(categoryOption('Not a real category').department, 'Municipal Operations')
})
