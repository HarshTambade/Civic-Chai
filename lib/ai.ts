import { calculatePriorityScore, calculateTrustScore, type DuplicateCandidate } from '@/lib/scoring'
import type { IssuePriority } from '@/lib/types'
import { assessJurisdiction, type JurisdictionAssessment } from '@/lib/jurisdiction'
import type { DirectoryArea } from '@/lib/geo'

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
  /** Suggested responsible level of government (Union / State / local body). */
  jurisdiction?: JurisdictionAssessment
  /** State, district, taluka and local body from the PIN directory, when known. */
  area?: DirectoryArea | null
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
  duplicateCandidates?: DuplicateCandidate[]
}

// `words` are strong signals for a category; `context` words (such as "road" or "water"
// used to describe a location) only break ties, so they cannot override a strong match.
const TAXONOMY = [
  { category: 'Public Lighting', issue: 'Streetlight outage', department: 'Municipal Public Lighting', words: /street.?lights?|street ?lamps?|lamp ?post|bulb|electric light|lights? (is |are )?(not working|off|band|out)|light band|batti|बत्ती|स्ट्रीट ?लाइट|पथदीप|दिवे बंद|दिवा|रस्त्यावरील दिवे/i, context: /lights?|power outage|andhera|अंधेरा|अंधार/i, severity: 48 },
  { category: 'Sanitation', issue: 'Garbage overflow', department: 'Solid Waste Management', words: /garbage|rubbish|trash|waste|dump|litter|kachra|kachara|कचरा|घनकचरा|कचरापेटी|कचऱ्याचा/i, context: /smell|stink|बदबू|दुर्गंधी/i, severity: 42 },
  { category: 'Roads & Potholes', issue: 'Road damage or pothole', department: 'PWD — Roads Division', words: /pothole|road damage|broken road|cracked road|khadda|gaddha|खड्डा|खड्डे|गड्ढा|गड्ढे/i, context: /road|sadak|rasta|रस्ता|रस्त्यावर|सड़क/i, severity: 56 },
  { category: 'Water Supply', issue: 'Water supply disruption', department: 'Water Works Department', words: /water supply|no water|water leak|pipeline|pa+ni nahi|पाणी (येत )?नाही|पानी नहीं|जलापूर्ति|गळती/i, context: /water|pa+ni|पाणी|पानी|नल/i, severity: 52 },
  { category: 'Drainage', issue: 'Drainage or sewage issue', department: 'Drainage & Sewerage', words: /drain|sewer|sewage|manhole|gutter|naali|nala|नाला|गटार|सांडपाणी|नाली|सीवर/i, context: /flood|waterlogg|पाणी साचले|जलभराव/i, severity: 57 },
  { category: 'Traffic', issue: 'Traffic or road safety issue', department: 'Traffic Police / PWD', words: /traffic|signal|zebra crossing|road safety|जाम|वाहतूक|सिग्नल/i, context: /crossing|accident/i, severity: 45 },
  { category: 'Public Health', issue: 'Public health concern', department: 'Public Health Office', words: /mosquito|disease|contamination|health hazard|dengue|malaria|मच्छर|डास|रोग|दूषित|आरोग्य/i, context: /fever|बुखार|ताप/i, severity: 62 },
] as const

function matchCount(pattern: RegExp, text: string) {
  return text.match(new RegExp(pattern.source, 'gi'))?.length ?? 0
}

/** Picks the category with the strongest keyword evidence; earlier entries win ties. */
function selectCategory(text: string) {
  let best: (typeof TAXONOMY)[number] | undefined
  let bestScore = 0
  for (const item of TAXONOMY) {
    const score = matchCount(item.words, text) * 2 + matchCount(item.context, text)
    if (score > bestScore) { best = item; bestScore = score }
  }
  return best
}

export const GENERAL_CATEGORY = { category: 'General civic issue', issue: 'Civic service request', department: 'Municipal Operations' } as const

/** Citizen-confirmable categories and the department each one routes to. */
export const CATEGORY_OPTIONS: ReadonlyArray<{ category: string; issue: string; department: string }> = [
  ...TAXONOMY.map(({ category, issue, department }) => ({ category, issue, department })),
  GENERAL_CATEGORY,
]

export const DEPARTMENT_OPTIONS: readonly string[] = [...new Set(CATEGORY_OPTIONS.map((option) => option.department))]

export function categoryOption(category: string) {
  return CATEGORY_OPTIONS.find((option) => option.category === category) ?? GENERAL_CATEGORY
}

function detectLanguage(text: string, selected: string) {
  if (selected !== 'Auto Detect') return selected
  if (/\p{Script=Devanagari}/u.test(text)) {
    // Compare grammatical words unique to each language; nouns such as कचरा are shared.
    const marathi = matchCount(/आहे|आहेत|नाही|मध्ये|आमच्या|आमचा|आणि|झाले|झाला|पाहिजे|येत|होत|च्या|पाणी|गटार/u, text)
    const hindi = matchCount(/है|हैं|नहीं|में|हमारे|हमारा|और|गया|गई|रहा|रही|पानी|का |की |के /u, text)
    return marathi > hindi ? 'Marathi' : 'Hindi'
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
  const selected = selectCategory(original)
  const pin = options.pin?.match(/^\d{6}$/)?.[0] ?? original.match(/\b\d{6}\b/)?.[0] ?? ''
  const knownLocation = original.match(/(?:near|at|on|by|station road|market square|school|lane|nearby)\s+([\p{L}\d][\p{L}\d\s-]{2,35})/iu)?.[1]?.trim()
  const locality = options.locality?.trim() || knownLocation || 'Locality to confirm'
  const category = selected?.category ?? GENERAL_CATEGORY.category
  const issue = selected?.issue ?? GENERAL_CATEGORY.issue
  const department = selected?.department ?? GENERAL_CATEGORY.department
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
    jurisdiction: assessJurisdiction({ text: original, category }),
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
    const allowed = new Set<string>(CATEGORY_OPTIONS.map((item) => item.category))
    const category = typeof parsed.category === 'string' && allowed.has(parsed.category) ? parsed.category : fallback.category
    const mapped = categoryOption(category)
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
