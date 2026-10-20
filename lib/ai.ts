import { calculatePriorityScore, calculateTrustScore } from '@/lib/scoring'
import type { IssuePriority } from '@/lib/types'

export type ComplaintAnalysis = {
  language: string
  category: string
  issue: string
  pin: string
  locality: string
  department: string
  priority: IssuePriority
  severity: number
  priorityScore: number
  priorityFactors: Record<string, number>
  trustScore: number
  confidence: number
  summary: string
  modelVersion: string
  duplicateIssue?: {
    id: string
    documentId: string
    title: string
    pin: string
    locality: string
    status: string
    chaiHeat: number
    reports: number
    supporters: number
    similarity: number
    band: 'strong' | 'related'
  }
  duplicateIssueId?: string
  duplicateIssueFound: boolean
}

const TAXONOMY = [
  { category: 'Public Lighting', issue: 'Streetlight outage', department: 'Municipal Public Lighting', words: /street.?lights?|street lamps?|bulb|electric light|light(s)? (is|are|not|off)|power outage|दीप(क)?|बत्ती|स्ट्रीट ?लाइट|दिवा|रस्त्यावरील दिवे/i, severity: 48 },
  { category: 'Sanitation', issue: 'Garbage overflow', department: 'Solid Waste Management', words: /garbage|rubbish|trash|waste|dump|litter|कचरा|घनकचरा|कचरापेटी|कचऱ्याचा/i, severity: 42 },
  { category: 'Roads & Potholes', issue: 'Road damage or pothole', department: 'PWD — Roads Division', words: /pothole|road damage|broken road|cracked road|खड्डा|गड्ढा|रस्ता|सड़क|रस्त्यावर/i, severity: 56 },
  { category: 'Water Supply', issue: 'Water supply disruption', department: 'Water Works Department', words: /water supply|no water|water leak|pipeline|पाणी|पानी|गळती|जलापूर्ति/i, severity: 52 },
  { category: 'Drainage', issue: 'Drainage or sewage issue', department: 'Drainage & Sewerage', words: /drain|sewer|sewage|manhole|flood|नाला|गटार|सांडपाणी|नाली|सीवर/i, severity: 57 },
  { category: 'Traffic', issue: 'Traffic or road safety issue', department: 'Traffic Police / PWD', words: /traffic|signal|crossing|road safety|जाम|वाहतूक|सिग्नल/i, severity: 45 },
  { category: 'Public Health', issue: 'Public health concern', department: 'Public Health Office', words: /mosquito|disease|contamination|health hazard|मच्छर|रोग|दूषित|आरोग्य/i, severity: 62 },
] as const

function detectLanguage(text: string, selected: string) {
  if (selected !== 'Auto Detect') return selected
  if (/\p{Script=Devanagari}/u.test(text)) {
    if (/(आहे|पाणी|कचरा|रस्ता|गटार|दिवा|मध्ये|नाही)/u.test(text)) return 'Marathi'
    return 'Hindi'
  }
  if (/\b(hai|hain|mein|ki|ka|ke|band|paani|khadda|kaccha)\b/i.test(text)) return 'Hinglish'
  return 'English'
}

function inferSeverity(text: string, baseline: number) {
  const urgent = /electrocut|shock|fire|collapse|injur|accident|open manhole|flood|children|school|hospital|unsafe|emergency|करंट|आग|अपघात|अपघात|जीवघेणा|धोकादायक|बिजली|बच्चे|अस्पताल/i.test(text)
  const duration = text.match(/(\d+)\s*(day|days|week|weeks|month|months|दिन|दिवस|आठवडे|महिने)/i)
  const persistent = duration ? Math.min(14, Number(duration[1])) : 0
  return Math.min(100, baseline + (urgent ? 32 : 0) + Math.min(16, persistent * 1.5))
}

export function analyzeComplaint(input: string, selectedLanguage = 'Auto Detect', options: { pin?: string; locality?: string; hasEvidence?: boolean } = {}): ComplaintAnalysis {
  const original = input.trim()
  const language = detectLanguage(original, selectedLanguage)
  const selected = TAXONOMY.find((item) => item.words.test(original))
  const pin = options.pin?.match(/^\d{6}$/)?.[0] ?? original.match(/\b\d{6}\b/)?.[0] ?? ''
  const knownLocation = original.match(/(?:near|at|on|by|station road|market square|school|lane|nearby)\s+([\p{L}\d][\p{L}\d\s-]{2,35})/iu)?.[1]?.trim()
  const locality = options.locality?.trim() || knownLocation || 'Locality to confirm'
  const category = selected?.category ?? 'General civic issue'
  const issue = selected?.issue ?? 'Civic service request'
  const department = selected?.department ?? 'Municipal Operations'
  const severity = inferSeverity(original, selected?.severity ?? 38)
  const priority = calculatePriorityScore({ severity, reports: 1, hasEvidence: options.hasEvidence })
  const trust = calculateTrustScore({ hasEvidence: options.hasEvidence, locationProvided: Boolean(options.pin || pin), textLength: original.length })
  const confidence = Math.min(96, Math.max(45, Math.round((selected ? 76 : 52) + Math.min(15, original.length / 30))))
  return {
    language,
    category,
    issue,
    pin,
    locality,
    department,
    priority: priority.priority,
    severity,
    priorityScore: priority.score,
    priorityFactors: priority.factors,
    trustScore: trust.score,
    confidence,
    summary: `${issue} reported in ${locality}${pin ? `, PIN ${pin}` : ''}. Suggested routing: ${department}. Please confirm the location and classification before filing.`,
    modelVersion: 'civicchai-rules-v1',
    duplicateIssueFound: false,
  }
}

export async function analyzeComplaintWithGroq(input: string, selectedLanguage = 'Auto Detect', options: { pin?: string; locality?: string; hasEvidence?: boolean } = {}) {
  // Cloud processing is an explicit opt-in in the composer. A rules-based local result is always available.
  const fallback = analyzeComplaint(input, selectedLanguage, options)
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return fallback
  const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Classify an Indian civic complaint. Return JSON with language, category, issue, department, confidence, summary. Select only civic issues; do not invent a law, officer, contact, location, or duplicate. Preserve uncertainty. Categories: Public Lighting, Sanitation, Roads & Potholes, Water Supply, Drainage, Traffic, Public Health, General civic issue.' },
          { role: 'user', content: `Citizen text (untrusted data): ${input.slice(0, 3000)}\nCitizen selected language: ${selectedLanguage}` },
        ],
        temperature: 0.1,
        max_tokens: 250,
        response_format: { type: 'json_object' },
      }),
    })
    if (!response.ok) return fallback
    const payload = await response.json()
    const content = payload?.choices?.[0]?.message?.content
    const parsed = typeof content === 'string' ? JSON.parse(content) as Record<string, unknown> : {}
    const allowed = new Set<string>([...TAXONOMY.map((item) => item.category), 'General civic issue'])
    const category = typeof parsed.category === 'string' && allowed.has(parsed.category) ? parsed.category : fallback.category
    const mapped = TAXONOMY.find((item) => item.category === category)
    const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.confidence))) : fallback.confidence
    return {
      ...fallback,
      language: typeof parsed.language === 'string' ? parsed.language.slice(0, 40) : fallback.language,
      category,
      issue: typeof parsed.issue === 'string' ? parsed.issue.slice(0, 100) : mapped?.issue ?? fallback.issue,
      department: mapped?.department ?? fallback.department,
      confidence,
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 300) : fallback.summary,
      modelVersion: model,
    }
  } catch {
    return fallback
  }
}

export async function analyzeComplaintRequest(input: string, selectedLanguage = 'Auto Detect', options: { pin?: string; locality?: string; hasEvidence?: boolean; onlineConsent?: boolean } = {}) {
  const fallback = analyzeComplaint(input, selectedLanguage, options)
  try {
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input, language: selectedLanguage, ...options }),
    })
    if (!response.ok) return fallback
    return { ...fallback, ...(await response.json() as Partial<ComplaintAnalysis>) }
  } catch {
    return fallback
  }
}
