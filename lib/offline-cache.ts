const DEFAULT_ISSUE_CACHE_KEY = 'civicchai:issues:public'

export function readCachedIssues(cacheKey = DEFAULT_ISSUE_CACHE_KEY) {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(cacheKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeCachedIssues(issues: unknown[], cacheKey = DEFAULT_ISSUE_CACHE_KEY) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(issues))
  } catch {
    // ignore quota errors; app remains usable
  }
}

export async function fetchIssuesWithCache(fetcher: () => Promise<{ issues?: unknown[] } | unknown[]>, cacheKey = DEFAULT_ISSUE_CACHE_KEY) {
  try {
    const response = await fetcher()
    const issues = Array.isArray(response) ? response : response?.issues

    if (Array.isArray(issues)) {
      writeCachedIssues(issues, cacheKey)
      return issues
    }

    return readCachedIssues(cacheKey)
  } catch {
    return readCachedIssues(cacheKey)
  }
}
