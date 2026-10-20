import type { IssueRecord } from '@/lib/types'

// Clearly synthetic local-preview records. They are never returned when a
// configured Supabase database is empty or unavailable.
export const seedIssues: IssueRecord[] = [
  {
    id: 'demo-001', documentId: 'CC-DEMO-401208-001', title: 'DEMO: Streetlight outage',
    description: 'Synthetic sample report for the 401208 pilot flow. Confirm the real locality and authority before using this record.',
    category: 'Public Lighting', department: 'Municipal Public Lighting', pin: '401208', locality: 'Demo locality A',
    status: 'Filed', priority: 'Moderate', trust: 35, chaiHeat: 0, supporters: 0, reports: 1, comments: 0,
    daysUnresolved: 0, officer: 'Assignment pending', hub: 'No verified authority hub', createdAt: '2026-10-19T10:00:00.000Z', isDemo: true,
  },
  {
    id: 'demo-002', documentId: 'CC-DEMO-401208-002', title: 'DEMO: Road damage report',
    description: 'Synthetic sample report for interface review. The sample contains no verified address, officer or resolution.',
    category: 'Roads & Potholes', department: 'PWD — Roads Division', pin: '401208', locality: 'Demo locality B',
    status: 'In Progress', priority: 'High', trust: 40, chaiHeat: 0, supporters: 0, reports: 1, comments: 0,
    daysUnresolved: 2, officer: 'Assignment pending', hub: 'No verified authority hub', createdAt: '2026-10-18T10:00:00.000Z', isDemo: true,
  },
  {
    id: 'demo-003', documentId: 'CC-DEMO-401209-001', title: 'DEMO: Waste collection delay',
    description: 'Synthetic sample report for interface review. Replace this jurisdiction with verified authority data before launch.',
    category: 'Sanitation', department: 'Solid Waste Management', pin: '401209', locality: 'Demo locality C',
    status: 'Assigned', priority: 'Moderate', trust: 35, chaiHeat: 0, supporters: 0, reports: 1, comments: 0,
    daysUnresolved: 1, officer: 'Assignment pending', hub: 'No verified authority hub', createdAt: '2026-10-17T10:00:00.000Z', isDemo: true,
  },
]

export const demoIssues = seedIssues
