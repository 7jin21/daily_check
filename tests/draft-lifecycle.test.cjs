const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTs, deferred } = require('./helpers.cjs')

const tick = () => new Promise((resolve) => setImmediate(resolve))
const quiet = { warn() {}, error() {}, log() {} }
const frame = (value) => new TextEncoder().encode(`${JSON.stringify(value)}\n`)

function harness({ question, fetchDraft, restored, saveEntry } = {}) {
  let persistence
  const { useCheckinStore: store } = loadTs('stores/checkin.ts', {
    zustand: {
      create: () => (initialize) => {
        let state
        const set = (update) => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) } }
        const get = () => state
        state = initialize(set, get)
        const hook = () => state
        hook.getState = get
        hook.setState = set
        return hook
      },
    },
    'zustand/middleware': { persist: (initialize, options) => { persistence = options; return initialize } },
  })
  store.setState({
    mood: 3, energy: 3, events: '今日は仕事を終えた。',
    checkinDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }),
  })
  if (restored) store.setState(persistence.merge(restored, store.getState()))
  let states = [], refs = [], effects = [], cleanups = []
  let stateIndex = 0, refIndex = 0, generationRequests = 0, questionRequests = 0
  const saves = [], apiCalls = [], navigations = []
  let memoClears = 0
  const react = {
    useState(initial) {
      const i = stateIndex++
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
      return [states[i], (value) => { states[i] = typeof value === 'function' ? value(states[i]) : value }]
    },
    useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial } },
    useMemo: (compute) => compute(),
    useEffect: (effect) => effects.push(effect),
  }
  const element = (type, props) => typeof type === 'function' ? type(props) : { type, props }
  const jsx = { jsx: element, jsxs: element }
  const { default: Page } = loadTs('app/draft/page.tsx', {
    react,
    'react/jsx-runtime': jsx,
    'next/navigation': { useRouter: () => ({ push(path) { navigations.push(path) }, replace(path) { navigations.push(path) } }) },
    '@/components/checkin/ReflectionQuestion': (props) => ({ type: 'ReflectionQuestion', props }),
    '@/components/draft/WaitingViews': {
      GeneratingView: (props) => ({ type: 'GeneratingView', props }),
      ReadingView: (props) => ({ type: 'ReadingView', props }),
    },
    '@/components/draft/SavedView': (props) => ({ type: 'SavedView', props: { ...props, children: props.merged ? '追記しました' : '保存しました' } }),
    '@/components/draft/draft.css': {},
    '@/stores/checkin': { useCheckinStore: store },
    '@/stores/settings': { useSettingsStore: (select) => select({ settings: { notificationsEnabled: false } }) },
    '@/stores/memos': { useMemoStore: { getState: () => ({ date: store.getState().checkinDate, removeUsedIn() { memoClears++ } }) } },
    '@/lib/entry-save': {
      hasEntryWithWords: async () => false,
      refreshEntryMeta: async () => null,
      saveFullEntry: async (entry) => {
        saves.push(entry)
        return saveEntry ? saveEntry(entry) : { id: 'entry', draft: entry.editedDraft, tags: entry.tags, merged: false, appended: false }
      },
    },
    '@/lib/reflection-prefetch': {
      clearReflectionCache() {},
      requestReflection: async () => { questionRequests++; return question ? question() : { skip: true } },
    },
    '@/lib/save-echo': { markSaveEcho() {} },
    '@/lib/notion-client': { syncNotion: async (body) => { apiCalls.push({ path: '/api/notion-sync', body }) } },
    '@/lib/api-client': {
      apiPost: async (path, body, options) => {
        apiCalls.push({ path, body })
        if (path === '/api/checkin-question') {
          questionRequests++
          return question ? question(options) : { skip: true }
        }
        return { tags: [], summary: '', dominantEmotion: '' }
      },
    },
  }, {
    Error, TypeError,
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    console: quiet,
    window: { confirm: () => true },
    fetch: async (url, options) => {
      generationRequests++
      if (fetchDraft) return fetchDraft(options)
      return new Response(Buffer.concat([frame({ type: 'delta', text: '完成した日記。' }), frame({ type: 'done' })]))
    },
  })
  const render = () => { stateIndex = 0; refIndex = 0; effects = []; return Page() }
  const mount = () => { render(); cleanups = effects.map((effect) => effect()).filter((f) => typeof f === 'function') }
  const unmount = () => { cleanups.forEach((cleanup) => cleanup()); cleanups = [] }
  const remount = () => { states = []; refs = []; mount() }
  return {
    store, render, mount, unmount, remount, saves, apiCalls, navigations,
    memoClears: () => memoClears,
    strictReplay() { unmount(); cleanups = effects.map((effect) => effect()).filter((f) => typeof f === 'function') },
    persisted: () => persistence.partialize(store.getState()),
    generationRequests: () => generationRequests,
    questionRequests: () => questionRequests,
  }
}

test('stream interruption on navigation retains partial text and returns with recovery UI, not an endless spinner', async () => {
  let stream
  const h = harness({ fetchDraft: ({ signal }) => new Response(new ReadableStream({
    start(controller) {
      stream = controller
      signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')))
    },
  })) })
  h.mount()
  await tick()
  stream.enqueue(frame({ type: 'delta', text: '途中までの言葉' }))
  await tick()
  assert.equal(h.store.getState().isGenerating, true)
  h.unmount()
  await tick()
  assert.equal(h.store.getState().isGenerating, false)
  assert.equal(h.store.getState().editedDraft, '途中までの言葉')
  assert.equal(h.persisted().draftIncomplete, true)
  h.remount()
  assert.equal(h.generationRequests(), 1)
  assert.equal(h.store.getState().isGenerating, false)
  assert.match(JSON.stringify(h.render()), /清書が途中で止まりました/)
  assert.equal(h.store.getState().editedDraft, '途中までの言葉')
  h.unmount()

  const reloaded = harness({ restored: h.persisted() })
  reloaded.mount()
  assert.equal(reloaded.generationRequests(), 0)
  assert.equal(reloaded.store.getState().editedDraft, '途中までの言葉')
  assert.match(JSON.stringify(reloaded.render()), /清書が途中で止まりました/)
  reloaded.unmount()
})

test('leaving during the reflection gate prevents a late response from starting generation', async () => {
  const response = deferred()
  const h = harness({ question: () => response.promise })
  h.mount()
  h.unmount()
  response.resolve({ skip: true })
  await tick()
  assert.equal(h.generationRequests(), 0)
  assert.equal(h.store.getState().editedDraft, '')
})

test('legacy persisted text without completed metadata is restored as incomplete', () => {
  const h = harness({ restored: { editedDraft: '旧版で途中まで届いた本文', draftResult: null } })
  h.mount()
  assert.equal(h.store.getState().draftIncomplete, true)
  assert.equal(h.store.getState().editedDraft, '旧版で途中まで届いた本文')
  assert.equal(h.generationRequests(), 0)
  assert.match(JSON.stringify(h.render()), /清書が途中で止まりました/)
  h.unmount()
})

test('reset invalidates pending reflection even without navigation', async () => {
  const response = deferred()
  const h = harness({ question: () => response.promise })
  h.mount()
  h.store.getState().reset()
  response.resolve({ skip: true })
  await tick()
  assert.equal(h.generationRequests(), 0)
  assert.equal(h.store.getState().draftIncomplete, false)
  h.unmount()
})

test('StrictMode effect replay restarts the gate and only the current request generates a draft', async () => {
  const responses = [deferred(), deferred()]
  let count = 0
  const h = harness({
    question: () => responses[count++].promise,
    fetchDraft: () => new Response(Buffer.concat([
      frame({ type: 'delta', text: '完成した日記。' }), frame({ type: 'done' }),
    ])),
  })
  h.mount()
  h.strictReplay()
  assert.equal(h.questionRequests(), 2)
  responses[0].resolve({ skip: true })
  responses[1].resolve({ skip: true })
  await tick()
  assert.equal(h.generationRequests(), 1)
  assert.equal(h.store.getState().editedDraft, '完成した日記。')
  assert.equal(h.store.getState().draftIncomplete, false)
  assert.equal(h.store.getState().isGenerating, false)
  h.unmount()
})

test('length-limited streams retain their partial text and warning; fallback still uses the original memo', async () => {
  const partial = harness({ fetchDraft: () => new Response(Buffer.concat([
    frame({ type: 'delta', text: '長い文章の途中' }), frame({ type: 'error', reason: 'length' }),
  ])) })
  partial.mount()
  await tick()
  assert.equal(partial.store.getState().editedDraft, '長い文章の途中')
  assert.equal(partial.store.getState().draftIncomplete, true)
  assert.equal(partial.store.getState().isGenerating, false)
  assert.match(JSON.stringify(partial.render()), /清書が途中で止まりました/)
  partial.unmount()
  const fallback = harness({ fetchDraft: () => new Response('template', { headers: { 'X-Draft-Fallback': '1' } }) })
  fallback.mount()
  await tick()
  assert.equal(fallback.store.getState().editedDraft, '今日は仕事を終えた。')
  assert.equal(fallback.store.getState().draftIncomplete, false)
  fallback.unmount()
})

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}

function button(tree, text) {
  const result = nodes(tree).find((n) => n.type === 'button' && JSON.stringify(n.props.children)?.includes(text))
  assert.ok(result, `Expected button: ${text}`)
  return result
}

const readyDraft = () => ({
  editedDraft: '保存する本文', draftIncomplete: false,
  draftResult: { draft: '保存する本文', tags: ['仕事'], summary: '一日の記録', dominantEmotion: '満足', fromAI: true },
})

const saveResult = (draft = '保存する本文') => ({ id: 'saved-entry', draft, tags: ['仕事'], merged: false, appended: false })

test('saving locks editing and navigation immediately, rejects duplicate clicks, and clears only after success', async () => {
  const pending = deferred()
  const h = harness({ restored: readyDraft(), saveEntry: () => pending.promise })
  h.mount()
  const before = h.render()
  const saving = button(before, '保存する').props.onClick()
  await button(before, '保存する').props.onClick()
  assert.equal(h.saves.length, 1)

  // 再描画前の古いハンドラでも、保存中に書換えや画面遷移を起こさない。
  nodes(before).find((n) => n.type === 'textarea').props.onChange({ target: { value: '保存中の追記' } })
  nodes(before).find((n) => n.props?.['aria-label'] === '入力に戻る').props.onClick()
  button(before, '原文のまま').props.onClick()
  button(before, '清書し直す').props.onClick()
  await button(before, '短くして').props.onClick()
  assert.equal(h.store.getState().editedDraft, '保存する本文')
  assert.equal(h.store.getState().draftMode, 'tidy')
  assert.deepEqual(h.navigations, [])
  assert.equal(h.generationRequests(), 0)
  assert.equal(h.apiCalls.length, 0)

  const during = nodes(h.render())
  assert.equal(during.find((n) => n.type === 'textarea').props.readOnly, true)
  assert.equal(during.find((n) => n.props?.['aria-label'] === '入力に戻る').props.disabled, true)
  assert.ok(during.filter((n) => n.props?.role === 'radio').every((n) => n.props.disabled))
  assert.equal(h.persisted().editedDraft, '保存する本文')

  pending.resolve(saveResult())
  await saving
  assert.equal(h.saves[0].editedDraft, '保存する本文')
  assert.equal(h.store.getState().editedDraft, '')
  assert.equal(h.memoClears(), 1)
  assert.match(JSON.stringify(h.render()), /保存しました/)
  assert.equal(h.apiCalls.find((c) => c.path === '/api/notion-sync').body.draft, '保存する本文')
  h.unmount()
})

for (const change of ['reset', 'input', 'targetDate', 'editedDraft']) {
  test(`late save success preserves a changed draft (${change})`, async () => {
    const pending = deferred()
    const h = harness({ restored: readyDraft(), saveEntry: () => pending.promise })
    h.mount()
    const saving = button(h.render(), '保存する').props.onClick()
    if (change === 'reset') {
      // 値が同じ新しい入力でも、resetVersionが異なるので古い保存は消せない。
      const sameValues = h.persisted()
      h.store.getState().reset()
      h.store.setState(sameValues)
    } else if (change === 'input') h.store.getState().setEvents('別の出来事を入力')
    else if (change === 'targetDate') h.store.getState().setTargetDate('2026-10-31')
    else h.store.getState().setEditedDraft('別の画面から変更された本文')
    const expected = h.persisted()
    pending.resolve(saveResult())
    await saving
    assert.deepEqual(h.persisted(), expected)
    assert.equal(h.memoClears(), 0)
    assert.doesNotMatch(JSON.stringify(h.render()), /保存しました/)
    assert.equal(button(h.render(), '保存する').props.disabled, false)
    h.unmount()
  })
}

test('save completion after navigation cannot clear new input or replace the current screen', async () => {
  const pending = deferred()
  const h = harness({ restored: readyDraft(), saveEntry: () => pending.promise })
  h.mount()
  const saving = button(h.render(), '保存する').props.onClick()
  h.unmount() // ブラウザの戻る・共通ナビゲーションなど、ページ外からの離脱。
  h.store.getState().setEvents('離脱後に入力したメモ')
  h.store.getState().setEditedDraft('離脱後の新しい本文')
  h.remount()
  pending.resolve(saveResult())
  await saving
  assert.equal(h.store.getState().events, '離脱後に入力したメモ')
  assert.equal(h.store.getState().editedDraft, '離脱後の新しい本文')
  assert.equal(h.memoClears(), 0)
  assert.doesNotMatch(JSON.stringify(h.render()), /保存しました/)
  h.unmount()
})

test('save failure retains text, unlocks editing, and allows saving the corrected text on retry', async () => {
  const pending = [deferred(), deferred()]
  let attempt = 0
  const h = harness({ restored: readyDraft(), saveEntry: () => pending[attempt++].promise })
  h.mount()
  const first = button(h.render(), '保存する').props.onClick()
  pending[0].reject(new Error('保存テスト失敗'))
  await first
  assert.equal(h.store.getState().editedDraft, '保存する本文')
  assert.equal(h.memoClears(), 0)
  const afterFailure = h.render()
  assert.match(JSON.stringify(afterFailure), /保存テスト失敗/)
  const textarea = nodes(afterFailure).find((n) => n.type === 'textarea')
  assert.equal(textarea.props.readOnly, false)
  textarea.props.onChange({ target: { value: '修正して再保存する本文' } })
  const second = button(h.render(), '保存する').props.onClick()
  assert.equal(h.saves[1].editedDraft, '修正して再保存する本文')
  pending[1].resolve(saveResult('修正して再保存する本文'))
  await second
  assert.match(JSON.stringify(h.render()), /保存しました/)
  assert.equal(h.store.getState().editedDraft, '')
  h.unmount()
})

test('a failed save from a departed screen does not redirect or add errors to the new screen', async () => {
  const pending = deferred()
  const h = harness({ restored: readyDraft(), saveEntry: () => pending.promise })
  h.mount()
  const saving = button(h.render(), '保存する').props.onClick()
  h.unmount()
  h.store.getState().setEditedDraft('新しい本文')
  h.remount()
  pending.reject(new Error('Unauthorized'))
  await saving
  assert.equal(h.store.getState().editedDraft, '新しい本文')
  assert.deepEqual(h.navigations, [])
  assert.doesNotMatch(JSON.stringify(h.render()), /保存できませんでした/)
  h.unmount()
})

test('append saves keep the latest full-entry synchronization and appended confirmation', async () => {
  const fullDiary = '前の日記\n\n今回の追記'
  const h = harness({
    restored: readyDraft(),
    saveEntry: async () => ({ id: 'entry', merged: true, appended: true, draft: fullDiary, tags: ['一日全体'] }),
  })
  h.mount()
  await button(h.render(), '保存する').props.onClick()
  await tick()
  const sync = h.apiCalls.find((c) => c.path === '/api/notion-sync')
  assert.equal(sync.body.draft, fullDiary)
  assert.deepEqual(sync.body.tags, ['一日全体'])
  assert.match(JSON.stringify(h.render()), /追記しました/)
  h.unmount()
})

test('a carried draft keeps its original target date and text across the latest rollover flow', async () => {
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const h = harness({ restored: { ...readyDraft(), checkinDate: yesterday } })
  h.mount()
  assert.equal(h.store.getState().targetDate, yesterday)
  assert.equal(h.store.getState().editedDraft, '保存する本文')
  assert.equal(h.generationRequests(), 0)
  await button(h.render(), '保存する').props.onClick()
  assert.equal(h.saves[0].entryDate, yesterday)
  h.unmount()
})

test('recovering an incomplete draft does not relabel later handwritten additions as AI text', async () => {
  const h = harness({ fetchDraft: () => new Response(Buffer.concat([
    frame({ type: 'delta', text: 'AIの途中の本文' }), frame({ type: 'error', reason: 'length' }),
  ])) })
  h.mount()
  await tick()
  assert.ok(h.store.getState().aiText.includes('AIの途中の本文'))
  nodes(h.render()).find((n) => n.type === 'textarea').props.onChange({ target: { value: 'AIの途中の本文。本人が追記した言葉。' } })
  h.unmount()
  h.remount()
  assert.equal(h.store.getState().editedDraft, 'AIの途中の本文。本人が追記した言葉。')
  assert.equal(h.store.getState().aiText.includes('本人が追記した言葉'), false)
  h.unmount()
})
