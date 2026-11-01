import { STORAGE_KEYS } from '@/lib/constants'

export type InsightsCacheKind = 'analysis' | 'weekly'
type RequestKind = InsightsCacheKind | 'ask' | 'stats'

const CACHE_BASES: Record<InsightsCacheKind, string> = {
  analysis: STORAGE_KEYS.INSIGHTS_CACHE,
  weekly: STORAGE_KEYS.WEEKLY_REPORT_CACHE,
}

interface CachedResult<T> {
  userId: string
  result: T
  timestamp: number
}

export interface InsightsRequest {
  userId: string
  signal: AbortSignal
  /** The screen/account still owns this request, even if it timed out. */
  isActive: () => boolean
  /** Results may be used only while the request is also not aborted. */
  isCurrent: () => boolean
  finish: () => void
}

export function insightsCacheKey(kind: InsightsCacheKind, userId: string): string {
  return `${CACHE_BASES[kind]}:${encodeURIComponent(userId)}`
}

/** Older caches have no owner, so they cannot safely be assigned to the current user. */
export function discardLegacyInsightsCaches() {
  try {
    for (const key of Object.values(CACHE_BASES)) localStorage.removeItem(key)
  } catch { /* Storage may be unavailable. */ }
}

export function clearInsightsCaches(userId: string) {
  try {
    for (const kind of ['analysis', 'weekly'] as const) localStorage.removeItem(insightsCacheKey(kind, userId))
  } catch { /* Storage may be unavailable. */ }
}

export function readInsightsCache<T>(
  kind: InsightsCacheKind,
  userId: string,
  ttl: number,
  validate: (value: unknown) => value is T
): CachedResult<T> | null {
  try {
    const raw = localStorage.getItem(insightsCacheKey(kind, userId))
    if (!raw) return null
    const cached = JSON.parse(raw) as Partial<CachedResult<T>>
    const age = Date.now() - (cached.timestamp ?? NaN)
    if (cached.userId !== userId || !Number.isFinite(age) || age < 0 || age >= ttl || !validate(cached.result)) return null
    return cached as CachedResult<T>
  } catch {
    return null
  }
}

export function writeInsightsCache<T>(kind: InsightsCacheKind, request: InsightsRequest, result: T, timestamp: number) {
  if (!request.isCurrent()) return
  try {
    localStorage.setItem(insightsCacheKey(kind, request.userId), JSON.stringify({ userId: request.userId, result, timestamp }))
  } catch { /* The result can still be displayed without a cache. */ }
}

/** Owns all requests for one mounted screen; account changes invalidate every old result. */
export class InsightsSession {
  private active = true
  private userId: string | null = null
  private version = 0
  private requests = new Map<RequestKind, { controller: AbortController; timer: ReturnType<typeof setTimeout> }>()

  get currentUserId() { return this.userId }

  cancel(kind: RequestKind) {
    const request = this.requests.get(kind)
    if (!request) return
    request.controller.abort()
    clearTimeout(request.timer)
    this.requests.delete(kind)
  }

  changeUser(userId: string | null): boolean {
    if (!this.active || this.userId === userId) return false
    this.invalidate()
    this.userId = userId
    return true
  }

  begin(kind: RequestKind, expectedUserId: string | null): InsightsRequest | null {
    if (!this.active || !this.userId || this.userId !== expectedUserId) return null
    const previous = this.requests.get(kind)
    if (previous) {
      previous.controller.abort()
      clearTimeout(previous.timer)
    }
    const userId = this.userId
    const version = this.version
    const controller = new AbortController()
    const request = { controller, timer: setTimeout(() => controller.abort(), 10_000) }
    this.requests.set(kind, request)
    const isActive = () => this.active && this.userId === userId && this.version === version && this.requests.get(kind) === request
    return {
      userId,
      signal: controller.signal,
      isActive,
      isCurrent: () => isActive() && !controller.signal.aborted,
      finish: () => {
        clearTimeout(request.timer)
        if (this.requests.get(kind) === request) this.requests.delete(kind)
      },
    }
  }

  private invalidate() {
    this.version++
    for (const { controller, timer } of this.requests.values()) {
      controller.abort()
      clearTimeout(timer)
    }
    this.requests.clear()
  }

  dispose() {
    this.active = false
    this.invalidate()
  }
}
