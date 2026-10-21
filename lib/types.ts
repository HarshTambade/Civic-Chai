export type IssueStatus =
  | 'Filed'
  | 'AI Classified'
  | 'Assigned'
  | 'Acknowledged'
  | 'In Progress'
  | 'Resolved'
  | 'Community Verified'
  | 'Closed'
  | 'Duplicate'
  | 'Under Review'

export type IssuePriority = 'Critical' | 'High' | 'Moderate' | 'Low'

export interface IssueRecord {
  id: string
  document_id?: string
  documentId: string
  title: string
  description: string
  originalText?: string
  category: string
  department: string
  pin: string
  locality: string
  state?: string
  district?: string
  municipality?: string
  ward?: string
  status: IssueStatus
  priority: IssuePriority
  trust: number
  chai_heat?: number
  chaiHeat: number
  priorityScore?: number
  priorityFactors?: Record<string, number>
  trustFactors?: Record<string, number>
  aiConfidence?: number
  language?: string
  normalizedText?: string
  sourceChannel?: 'web' | 'pwa' | 'voice' | 'keypad' | 'assisted'
  modelVersion?: string
  latitude?: number
  longitude?: number
  evidenceUrls?: string[]
  supporters: number
  reports: number
  comments: number
  days_unresolved?: number
  daysUnresolved: number
  officer: string
  hub: string
  image_url?: string
  image?: string
  created_at?: string
  createdAt: string
  updated_at?: string
  updatedAt?: string
  createdBy?: string
  slaDueAt?: string
  myRelationship?: 'filed' | 'supported' | 'followed'
  isDemo?: boolean
  duplicateOf?: string
  duplicateDecision?: string
  hasEvidence?: boolean
}

export interface CreateIssueInput {
  title: string
  description: string
  category: string
  department: string
  pin: string
  locality: string
  status?: IssueStatus
  priority?: IssuePriority
  officer?: string
  hub?: string
  image_url?: string
  image_urls?: string[]
  evidence?: string[]
  original_text?: string
  normalized_text?: string
  source_channel?: IssueRecord['sourceChannel']
  language?: string
  ai_confidence?: number
  severity?: number
  location_lat?: number
  location_lng?: number
  created_by?: string
  consent?: Record<string, boolean>
  distinct_from?: string
}
