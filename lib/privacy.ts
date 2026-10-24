import type { IssueRecord } from '@/lib/types'

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const INDIAN_PHONE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g
const LONG_ID = /\b\d{12}\b/g
// Longer prefixes come first so "flat no. B-204" hides the number, not just the word "no".
const HOUSE_NUMBER = /\b(?:flat no\.?|house no\.?|door no\.?|h\.\s?no\.?|house|flat|door)\s*#?\s*[A-Z0-9/-]+\b/gi

export function redactPublicText(value: string) {
  return value
    .replace(EMAIL, '[email hidden]')
    .replace(INDIAN_PHONE, '[phone hidden]')
    .replace(LONG_ID, '[identity number hidden]')
    .replace(HOUSE_NUMBER, '[address detail hidden]')
    .slice(0, 5000)
}

export function safeComment(value: string) {
  return redactPublicText(value).slice(0, 2000)
}

export function toPublicIssue(issue: IssueRecord): IssueRecord {
  return {
    ...issue,
    title: redactPublicText(issue.title),
    description: redactPublicText(issue.description),
    normalizedText: issue.normalizedText ? redactPublicText(issue.normalizedText) : undefined,
    originalText: undefined,
    createdBy: undefined,
    officer: 'Assignment pending',
    hub: 'No verified authority hub',
    image: undefined,
    image_url: undefined,
    evidenceUrls: [],
    latitude: undefined,
    longitude: undefined,
  }
}
