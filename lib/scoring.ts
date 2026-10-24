import type { IssuePriority } from '@/lib/types'

export type PriorityFactors = {
  severity: number
  community_support: number
  corroboration: number
  persistence: number
  geographic_impact: number
  evidence: number
  sla: number
}

export type TrustFactors = {
  evidence: number
  location_consistency: number
  corroboration: number
  report_consistency: number
  anomaly: number
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

export function calculatePriorityScore(input: {
  severity?: number
  supporters?: number
  reports?: number
  daysUnresolved?: number
  geographicImpact?: number
  hasEvidence?: boolean
  overdue?: boolean
}): { score: number; factors: PriorityFactors; priority: IssuePriority } {
  const factors: PriorityFactors = {
    severity: clamp(input.severity ?? 40),
    community_support: clamp(Math.min(100, Math.log2((input.supporters ?? 0) + 1) * 12)),
    corroboration: clamp(Math.min(100, Math.log2((input.reports ?? 1) + 1) * 18)),
    persistence: clamp(Math.min(100, (input.daysUnresolved ?? 0) * 4)),
    geographic_impact: clamp(input.geographicImpact ?? 20),
    evidence: input.hasEvidence ? 80 : 20,
    sla: input.overdue ? 100 : 10,
  }
  const score = clamp(
    factors.severity * 0.25 +
      factors.community_support * 0.25 +
      factors.corroboration * 0.15 +
      factors.persistence * 0.1 +
      factors.geographic_impact * 0.1 +
      factors.evidence * 0.1 +
      factors.sla * 0.05,
  )
  const priority: IssuePriority = score >= 82 ? 'Critical' : score >= 65 ? 'High' : score >= 40 ? 'Moderate' : 'Low'
  return { score, factors, priority }
}

/** Mirrors refresh_issue_signals() in the database so local preview heat matches connected mode. */
export function calculateChaiHeat(supporters: number, reports: number) {
  return clamp(12 * Math.log(Math.max(0, supporters) + 1) + 16 * Math.log(Math.max(1, reports) + 1))
}

export function calculateTrustScore(input: {
  hasEvidence?: boolean
  locationProvided?: boolean
  corroborationCount?: number
  textLength?: number
  anomaly?: number
}): { score: number; factors: TrustFactors } {
  const factors: TrustFactors = {
    evidence: input.hasEvidence ? 85 : 35,
    location_consistency: input.locationProvided ? 75 : 40,
    corroboration: clamp(Math.min(100, (input.corroborationCount ?? 0) * 18)),
    report_consistency: clamp((input.textLength ?? 0) >= 30 ? 75 : (input.textLength ?? 0) >= 10 ? 55 : 25),
    anomaly: clamp(input.anomaly ?? 0),
  }
  const score = clamp(
    factors.evidence * 0.3 +
      factors.location_consistency * 0.2 +
      factors.corroboration * 0.2 +
      factors.report_consistency * 0.2 +
      (100 - factors.anomaly) * 0.1,
  )
  return { score, factors }
}

const STOP_WORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'a', 'an', 'to', 'in', 'on', 'at', 'near', 'for', 'of', 'and', 'this', 'that',
  'hai', 'hain', 'ka', 'ki', 'ke', 'se', 'par', 'mein', 'mera', 'hamare', 'please', 'issue', 'problem',
  'है', 'हैं', 'का', 'की', 'के', 'में', 'से', 'पर', 'यह', 'और', 'कृपया', 'आहे', 'आहेत', 'चा', 'ची', 'मध्ये',
])

export function textSimilarity(left: string, right: string) {
  const terms = (value: string) => new Set(
    value.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]{2,}/gu)?.filter((word) => !STOP_WORDS.has(word)) ?? [],
  )
  const a = terms(left)
  const b = terms(right)
  if (!a.size || !b.size) return 0
  const intersection = [...a].filter((word) => b.has(word)).length
  return intersection / (a.size + b.size - intersection)
}

export type DuplicateCandidate = {
  issue: { id: string; documentId: string; title: string; pin: string; locality: string; department: string; status: string; chaiHeat: number; reports: number; supporters: number }
  similarity: number
  band: 'strong' | 'related'
  signals: string[]
}

export function findDuplicateCandidates<T extends {
  id: string
  documentId: string
  title: string
  description: string
  pin: string
  locality: string
  department: string
  status: string
  chaiHeat: number
  reports: number
  supporters: number
  category?: string
  createdAt?: string
  hasEvidence?: boolean
}>(input: { text: string; pin?: string; locality?: string; department?: string; category?: string; hasEvidence?: boolean }, issues: T[]): DuplicateCandidate[] {
  const candidates = issues.map((issue) => {
    const samePin = Boolean(input.pin && issue.pin === input.pin)
    // A merged report points at its canonical issue; suggest the canonical one instead.
    if (!samePin || issue.status === 'Duplicate') return null
    const sameLocality = Boolean(input.locality && issue.locality.toLowerCase() === input.locality.toLowerCase())
    const sameDepartment = Boolean(input.department && issue.department.toLowerCase() === input.department.toLowerCase())
    const sameCategory = Boolean(input.category && issue.category && issue.category.toLowerCase() === input.category.toLowerCase())
    const semantic = textSimilarity(input.text, `${issue.title} ${issue.description}`)
    const location = sameLocality ? 1 : input.locality ? 0.82 : 0.6
    const category = sameCategory ? 1 : sameDepartment ? 0.8 : 0.55
    const ageDays = issue.createdAt ? Math.max(0, (Date.now() - Date.parse(issue.createdAt)) / 86_400_000) : 30
    const timeProximity = ageDays <= 7 ? 1 : ageDays <= 30 ? 0.8 : ageDays <= 90 ? 0.55 : 0.3
    const evidenceSignal = input.hasEvidence && issue.hasEvidence ? 1 : input.hasEvidence || issue.hasEvidence ? 0.5 : 0
    const score = Math.round((semantic * 0.6 + location * 0.15 + category * 0.12 + timeProximity * 0.05 + evidenceSignal * 0.08) * 100)
    if (score < 60) return null
    const signals = [
      semantic >= 0.25 ? 'similar wording' : '',
      sameLocality ? 'same locality' : 'same PIN',
      sameCategory ? 'same category' : sameDepartment ? 'same department' : '',
      ageDays <= 30 ? 'reported within 30 days' : '',
      input.hasEvidence && issue.hasEvidence ? 'both reports have evidence' : '',
    ].filter(Boolean)
    return {
      issue: {
        id: issue.id,
        documentId: issue.documentId,
        title: issue.title,
        pin: issue.pin,
        locality: issue.locality,
        department: issue.department,
        status: issue.status,
        chaiHeat: issue.chaiHeat,
        reports: issue.reports,
        supporters: issue.supporters,
      },
      similarity: score / 100,
      band: score >= 90 ? 'strong' as const : 'related' as const,
      signals,
    }
  }).filter((candidate): candidate is DuplicateCandidate => candidate !== null)
  return candidates.sort((a, b) => b.similarity - a.similarity).slice(0, 3)
}
