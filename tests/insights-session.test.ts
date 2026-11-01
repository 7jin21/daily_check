import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import { InsightsSession, insightsCacheKey, readInsightsCache, discardLegacyInsightsCaches } from '@/lib/insights-session'

const { loadTs, deferred } = createRequire(import.meta.url)('./helpers.cjs')
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

function storageFixture() {
  const data = new Map<string, string>()
  return {
    data,
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  }
}

// Run the real component closures/effect cleanup; no DOM, account, or API access.
function hooksFixture() {
  const slots: any[] = []
  let cursor = 0
  let pendingEffects: (() => void)[] = []
  const sameDeps = (a: unknown[] | undefined, b: unknown[] | undefined) =>
    a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]))
  const react = {
    useState(initial: any) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, (next: any) => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next }]
    },
    useEffect(effect: () => void | (() => void), deps: unknown[]) {
      const index = cursor++
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) {
        pendingEffects.push(() => {
          slots[index]?.cleanup?.()
          slots[index] = { deps, cleanup: effect() }
        })
      }
    },
    createContext: () => ({ Provider: 'context-provider' }),
  }
  return {
    react,
    render(component: () => any) {
      cursor = 0
      const element = component()
      const effects = pendingEffects
      pendingEffects = []
      effects.forEach((effect) => effect())
      return element
    },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()) },
  }
}

function find(node: any, predicate: (node: any) => boolean): any {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node
  for (const child of [node.props?.children].flat(Infinity)) {
    const result = find(child, predicate)
    if (result) return result
  }
  return null
}

const analysis = {
  personalityType: 'PRIVATE_A_ANALYSIS', description: 'private', strengths: [], growthAreas: [],
  emotionalPatterns: [], recommendations: [], emotionTriggers: [], averageMood: 3,
  moodTrend: 'stable', totalEntries: 5,
}
const weekly = {
  narrative: 'PRIVATE_A_WEEKLY', highlight: 'test', challenge: 'test', nextFocus: 'test',
  weekMood: 'test', entryCount: 5, avgMood: 3,
}

function sectionFixture(kind: 'analysis' | 'weekly' | 'ask', storage = storageFixture(), userId = 'user-a', existing?: InsightsSession) {
  const hooks = hooksFixture()
  const session = existing ?? new InsightsSession()
  session.changeUser(userId)
  const pending = deferred()
  const requests: any[] = []
  const files = { analysis: 'AnalysisSection', weekly: 'WeeklyReportSection', ask: 'AskSection' }
  const Section = loadTs(`components/insights/${files[kind]}.tsx`, {
    react: hooks.react,
    './InsightsSessionBoundary': { useInsightsSession: () => ({ userId, session }) },
    '@/lib/api-client': { apiPost: (...args: any[]) => { requests.push(args); return pending.promise } },
    '@/lib/focus': { loadFocus: () => null, isFocusActive: () => false, saveFocus() {}, FOCUS_MAX_CHARS: 60 },
    'next/link': () => null,
  }, { localStorage: storage.localStorage }).default
  const render = () => hooks.render(() => Section())
  render()
  return {
    render, pending, requests, storage, session,
    unmount: () => { hooks.unmount(); if (!existing) session.dispose() },
    click: () => find(render(), (node) => node.type === 'button').props.onClick(),
  }
}

describe('account-owned insights caches and requests', () => {
  for (const kind of ['analysis', 'weekly'] as const) {
    const result = kind === 'analysis' ? analysis : weekly
    const marker = kind === 'analysis' ? 'PRIVATE_A_ANALYSIS' : 'PRIVATE_A_WEEKLY'

    it(`${kind}: caches successful results only under their owner and never loads another user's result`, async () => {
      const a = sectionFixture(kind)
      const work = a.click()
      a.pending.resolve(result)
      await work
      const raw = a.storage.data.get(insightsCacheKey(kind, 'user-a'))
      expect(JSON.parse(raw!).userId).toBe('user-a')
      expect(JSON.stringify(a.render())).toContain(marker)
      a.unmount()
      const b = sectionFixture(kind, a.storage, 'user-b')
      expect(JSON.stringify(b.render())).not.toContain(marker)
      b.unmount()
    })

    it(`${kind}: leaving and clearing storage cannot be undone by a late response`, async () => {
      const a = sectionFixture(kind)
      const work = a.click()
      a.unmount()
      a.storage.data.clear()
      expect(a.requests[0][2].signal.aborted).toBe(true)
      a.pending.resolve(result) // Even a transport that ignores abort cannot repopulate the cache.
      await work
      expect(a.storage.data.size).toBe(0)
      const b = sectionFixture(kind, a.storage, 'user-b')
      expect(JSON.stringify(b.render())).not.toContain(marker)
      b.unmount()
    })

    it(`${kind}: switching accounts invalidates an old response before React unmounts its section`, async () => {
      const session = new InsightsSession()
      const a = sectionFixture(kind, storageFixture(), 'user-a', session)
      const work = a.click()
      session.changeUser('user-b')
      expect(a.requests[0][2].signal.aborted).toBe(true)
      a.pending.resolve(result)
      await work
      expect(a.storage.data.size).toBe(0)
      expect(JSON.stringify(a.render())).not.toContain(marker)
      // An event handler from A's render must also refuse to start a new request for B.
      await a.click()
      expect(a.requests).toHaveLength(1)
      a.unmount()
      session.dispose()
    })
  }

  it('drops legacy caches and rejects a mismatched owner even under a current-user key', () => {
    const storage = storageFixture()
    const helper = loadTs('lib/insights-session.ts', {}, { localStorage: storage.localStorage }) as {
      discardLegacyInsightsCaches: typeof discardLegacyInsightsCaches
      readInsightsCache: typeof readInsightsCache
    }
    storage.data.set('insights-analysis-cache', JSON.stringify({ result: analysis, timestamp: Date.now() }))
    storage.data.set('insights-weekly-report-cache', JSON.stringify({ result: weekly, timestamp: Date.now() }))
    helper.discardLegacyInsightsCaches()
    expect(storage.data.size).toBe(0)
    storage.data.set(insightsCacheKey('analysis', 'user-b'), JSON.stringify({ userId: 'user-a', result: analysis, timestamp: Date.now() }))
    expect(helper.readInsightsCache('analysis', 'user-b', 60_000, (value): value is typeof analysis => !!value)).toBeNull()
  })

  it('a timed-out request cannot supply results, but can finish and allow a retry', () => {
    vi.useFakeTimers()
    const session = new InsightsSession()
    try {
      session.changeUser('user-a')
      const first = session.begin('analysis', 'user-a')!
      vi.advanceTimersByTime(10_000)
      expect(first.signal.aborted).toBe(true)
      expect(first.isCurrent()).toBe(false)
      expect(first.isActive()).toBe(true)
      first.finish()
      const retry = session.begin('analysis', 'user-a')!
      expect(retry.isCurrent()).toBe(true)
      session.dispose()
      expect(retry.isCurrent()).toBe(false)
    } finally {
      session.dispose()
      vi.useRealTimers()
    }
  })
})

function boundaryFixture() {
  const hooks = hooksFixture()
  const storage = storageFixture()
  const initialUser = deferred()
  let listener: (event: string, session: any) => void = () => {}
  let unsubscribed = false
  const Boundary = loadTs('components/insights/InsightsSessionBoundary.tsx', {
    react: hooks.react,
    '@/lib/supabase': { getSupabaseClient: () => ({ auth: {
      getUser: () => initialUser.promise,
      onAuthStateChange: (callback: typeof listener) => {
        listener = callback
        return { data: { subscription: { unsubscribe: () => { unsubscribed = true } } } }
      },
    } }) },
    '@/lib/focus': { saveFocus() {} },
  }, { localStorage: storage.localStorage }).default
  const render = () => hooks.render(() => Boundary({ children: 'sections' }))
  render()
  return {
    render, initialUser, storage,
    emit: (id: string | null) => listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', id ? { user: { id } } : null),
    unmount: hooks.unmount,
    unsubscribed: () => unsubscribed,
  }
}

describe('auth lifecycle boundary', () => {
  it('remounts for the new user, clears old caches and invalidates in-flight work immediately', () => {
    const h = boundaryFixture()
    h.emit('user-a')
    const a = h.render()
    const request = a.props.value.session.begin('analysis', 'user-a')
    h.storage.data.set(insightsCacheKey('analysis', 'user-a'), 'private')
    h.emit('user-b')
    const b = h.render()
    expect(a.key).toBe('user-a')
    expect(b.key).toBe('user-b')
    expect(request.signal.aborted).toBe(true)
    expect(request.isCurrent()).toBe(false)
    expect(h.storage.data.size).toBe(0)
    h.unmount()
    expect(h.unsubscribed()).toBe(true)
  })

  it('a stale initial getUser response cannot restore a signed-out account', async () => {
    const h = boundaryFixture()
    h.emit('user-a')
    const request = h.render().props.value.session.begin('weekly', 'user-a')
    h.emit(null)
    expect(h.render()).toBeNull()
    expect(request.signal.aborted).toBe(true)
    h.initialUser.resolve({ data: { user: { id: 'user-a' } } })
    await flush()
    expect(h.render()).toBeNull()
    h.unmount()
  })

  it('unmount cancels all work and the auth subscription; a same-user auth event keeps active requests', () => {
    const h = boundaryFixture()
    h.emit('user-a')
    const session = h.render().props.value.session
    const request = session.begin('analysis', 'user-a')
    h.emit('user-a')
    expect(request.isCurrent()).toBe(true)
    h.unmount()
    expect(request.signal.aborted).toBe(true)
    expect(request.isCurrent()).toBe(false)
    expect(h.unsubscribed()).toBe(true)
  })
})

it('IME confirmation does not ask a question, and a pending answer is discarded after leaving', async () => {
  const h = sectionFixture('ask')
  const question = () => find(h.render(), (node) => node.type === 'input')
  question().props.onChange({ target: { value: '最近の気分は？' } })
  const input = question()
  input.props.onKeyDown({ key: 'Enter', nativeEvent: { isComposing: true, keyCode: 13 } })
  input.props.onKeyDown({ key: 'Enter', nativeEvent: { isComposing: false, keyCode: 229 } })
  expect(h.requests).toHaveLength(0)
  input.props.onKeyDown({ key: 'Enter', nativeEvent: { isComposing: false, keyCode: 13 } })
  expect(h.requests).toHaveLength(1)
  expect(h.requests[0][1].question).toBe('最近の気分は？')
  h.unmount()
  expect(h.requests[0][2].signal.aborted).toBe(true)
  h.pending.resolve({ answer: 'PRIVATE_A_ANSWER' })
  await flush()
  expect(JSON.stringify(h.render())).not.toContain('PRIVATE_A_ANSWER')
})

it('local statistics from the previous account cannot appear after an account switch', async () => {
  const hooks = hooksFixture()
  const session = new InsightsSession()
  session.changeUser('user-a')
  const response = deferred()
  let signal: AbortSignal | undefined
  const query = {
    select() { return this },
    eq(column: string, userId: string) { expect(column).toBe('user_id'); expect(userId).toBe('user-a'); return this },
    gte() { return this }, order() { return this }, limit() { return this },
    abortSignal(value: AbortSignal) { signal = value; return this },
    then(resolve: (value: unknown) => void) { return response.promise.then(resolve) },
  }
  const Section = loadTs('components/insights/LocalStatsSection.tsx', {
    react: hooks.react,
    './InsightsSessionBoundary': { useInsightsSession: () => ({ userId: 'user-a', session }) },
    '@/lib/supabase': { getSupabaseClient: () => ({ from: () => query }) },
    'next/link': () => null,
  }).default
  const render = () => hooks.render(() => Section())
  expect(render()).toBeNull()
  session.changeUser('user-b')
  expect(signal?.aborted).toBe(true)
  response.resolve({ data: [{ entry_date: '2026-11-01', mood: 3, dominant_emotion: 'PRIVATE_A_EMOTION', tags: [] }] })
  await flush()
  expect(render()).toBeNull()
  hooks.unmount()
  session.dispose()
})
