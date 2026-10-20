import type { IssueRecord } from '@/lib/types'

export type HeatmapMetric = 'chai' | 'density' | 'priority' | 'resolution'

export type HeatmapCell = {
  latitude: number
  longitude: number
  issueCount: number
  averageChaiHeat: number
  averagePriority: number
  resolutionRate: number
}

export type HeatmapRegion = {
  key: string
  pin: string
  locality: string
  issueCount: number
  mappedIssueCount: number
  averageChaiHeat: number
  averagePriority: number
  resolutionRate: number
  latitude?: number
  longitude?: number
  categories: string[]
}

export type HeatmapData = {
  totalIssues: number
  syntheticSeedCount: number
  mappedIssueCount: number
  unmappedIssueCount: number
  cells: HeatmapCell[]
  regions: HeatmapRegion[]
  filters: { departments: string[]; categories: string[] }
}

const RESOLVED_STATUSES = new Set(['Resolved', 'Community Verified', 'Closed'])
const PRIORITY_SCORE: Record<string, number> = { Critical: 95, High: 78, Moderate: 55, Low: 25 }
const GRID_SIZE = 100 // 0.01 degrees, roughly a kilometre at Indian latitudes.

type Aggregate = {
  count: number
  heat: number
  priority: number
  resolved: number
  categories: Map<string, number>
  latitude: number
  longitude: number
  mappedCount: number
}

function blankAggregate(): Aggregate {
  return { count: 0, heat: 0, priority: 0, resolved: 0, categories: new Map(), latitude: 0, longitude: 0, mappedCount: 0 }
}

function addIssue(aggregate: Aggregate, issue: IssueRecord) {
  aggregate.count += 1
  aggregate.heat += Math.max(0, Math.min(100, issue.chaiHeat ?? 0))
  aggregate.priority += Math.max(0, Math.min(100, issue.priorityScore ?? PRIORITY_SCORE[issue.priority] ?? 0))
  if (RESOLVED_STATUSES.has(issue.status)) aggregate.resolved += 1
  aggregate.categories.set(issue.category, (aggregate.categories.get(issue.category) ?? 0) + 1)
}

function geoCell(latitude: number, longitude: number): [number, number, string] {
  const latIndex = Math.floor(latitude * GRID_SIZE)
  const lngIndex = Math.floor(longitude * GRID_SIZE)
  const cellLat = Math.max(-89.995, Math.min(89.995, latIndex / GRID_SIZE + 0.005))
  const cellLng = Math.max(-179.995, Math.min(179.995, lngIndex / GRID_SIZE + 0.005))
  return [cellLat, cellLng, `${latIndex}:${lngIndex}`]
}

function rate(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0
}

function average(total: number, count: number) {
  return count ? Math.round(total / count) : 0
}

export function buildHeatmapData(issues: IssueRecord[]): HeatmapData {
  const cells = new Map<string, Aggregate>()
  const regions = new Map<string, Aggregate & { pin: string; locality: string }>()
  let mappedIssueCount = 0

  for (const issue of issues) {
    const regionKey = JSON.stringify([issue.pin, issue.locality])
    let region = regions.get(regionKey)
    if (!region) {
      region = { ...blankAggregate(), pin: issue.pin, locality: issue.locality }
      regions.set(regionKey, region)
    }
    addIssue(region, issue)

    const latitude = issue.latitude
    const longitude = issue.longitude
    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue

    const [cellLat, cellLng, cellKey] = geoCell(latitude, longitude)
    let cell = cells.get(cellKey)
    if (!cell) {
      cell = blankAggregate()
      cells.set(cellKey, cell)
    }
    addIssue(cell, issue)
    cell.latitude = cellLat
    cell.longitude = cellLng
    cell.mappedCount += 1
    region.latitude += cellLat
    region.longitude += cellLng
    region.mappedCount += 1
    mappedIssueCount += 1
  }

  const publicCells = [...cells.values()].map((cell) => ({
    latitude: cell.latitude,
    longitude: cell.longitude,
    issueCount: cell.count,
    averageChaiHeat: average(cell.heat, cell.count),
    averagePriority: average(cell.priority, cell.count),
    resolutionRate: rate(cell.resolved, cell.count),
  })).sort((a, b) => b.issueCount - a.issueCount)

  const publicRegions = [...regions.entries()].map(([key, region]) => ({
    key,
    pin: region.pin,
    locality: region.locality,
    issueCount: region.count,
    mappedIssueCount: region.mappedCount,
    averageChaiHeat: average(region.heat, region.count),
    averagePriority: average(region.priority, region.count),
    resolutionRate: rate(region.resolved, region.count),
    latitude: region.mappedCount ? Number((region.latitude / region.mappedCount).toFixed(2)) : undefined,
    longitude: region.mappedCount ? Number((region.longitude / region.mappedCount).toFixed(2)) : undefined,
    categories: [...region.categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([category]) => category),
  })).sort((a, b) => b.issueCount - a.issueCount)

  return {
    totalIssues: issues.length,
    syntheticSeedCount: 0,
    mappedIssueCount,
    unmappedIssueCount: issues.length - mappedIssueCount,
    cells: publicCells,
    regions: publicRegions,
    filters: {
      departments: [...new Set(issues.map((issue) => issue.department))].sort(),
      categories: [...new Set(issues.map((issue) => issue.category))].sort(),
    },
  }
}
