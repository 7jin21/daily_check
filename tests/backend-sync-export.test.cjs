const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTs, deferred } = require('./helpers.cjs')

const input = { entryId: '11111111-1111-1111-1111-111111111111', entryDate: '2026-11-01', draft: '今日の日記', tags: [], mood: 3, energy: 3 }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
const silent = { ...console, error() {}, warn() {} }
const request = (body = input) => ({ json: async () => body })

function database({ pageId = null, profile = { notion_token: 'token', notion_database_id: 'db' } } = {}) {
  const entry = { id: input.entryId, entry_date: input.entryDate, edited_draft: input.draft, ai_draft: null, mood: 3, energy: 3, tags: [], notion_page_id: pageId }
  const state = { leaseId: null, expires: 0, pageId, createPending: false }
  const faults = {}
  const actions = []
  const snapshot = () => ({ pageId: state.pageId, createPending: state.createPending })
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-a' } } }) },
    from(table) {
      const q = {
        select() { return q }, eq() { return q },
        upsert(value) { Object.assign(profile, value); return q },
        single: async () => ({ data: table === 'profiles' ? { ...profile } : { ...entry }, error: null }),
        then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject) },
      }
      return q
    },
    async rpc(name, params) {
      if (name === 'acquire_notion_sync') {
        if (state.leaseId && state.expires > Date.now() && state.leaseId !== params.p_lease_id) return { data: { acquired: false }, error: null }
        state.leaseId = params.p_lease_id; state.expires = Date.now() + 120000
        return { data: { acquired: true, ...snapshot() }, error: null }
      }
      const action = params.p_action
      actions.push(action)
      if (state.leaseId !== params.p_lease_id || (action !== 'release' && state.expires <= Date.now())) return { data: null, error: { message: 'lease lost' } }
      const fault = faults[action]
      if (fault === 'before') { delete faults[action]; return { data: null, error: { message: 'database unavailable' } } }
      if (action === 'prepare_create') { assert.equal(state.createPending, false); assert.equal(state.pageId, null); state.createPending = true }
      if (action === 'checkpoint') state.pageId = params.p_page_id
      if (action === 'finalize') { assert.equal(state.pageId, params.p_page_id); entry.notion_page_id = params.p_page_id; state.createPending = false }
      if (action === 'discard') { state.pageId = null; state.createPending = false }
      if (action === 'release') { state.leaseId = null; state.expires = 0 }
      else state.expires = Date.now() + 120000
      if (fault === 'after') { delete faults[action]; return { data: null, error: { message: 'response lost after commit' } } }
      return { data: snapshot(), error: null }
    },
  }
  return { db, state, entry, profile, faults, actions }
}

function notionServer() {
  const pages = new Map()
  const calls = []
  let nextPage = 0, nextBlock = 0
  const fetch = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : undefined
    calls.push({ url, method: options.method, body })
    if (options.method === 'POST') {
      const id = `page-${++nextPage}`
      pages.set(id, { archived: false, blocks: (body.children ?? []).map((block) => ({ ...block, id: `block-${++nextBlock}` })) })
      return json({ id })
    }
    const pageId = url.match(/\/(?:pages|blocks)\/(page-[^/?]+)/)?.[1]
    const page = pages.get(pageId)
    if (url.includes('/pages/') && options.method === 'PATCH') {
      if (Object.hasOwn(body, 'archived')) page.archived = body.archived
      return json({ id: pageId })
    }
    if (options.method === 'GET') return json({ results: page.blocks, has_more: false, next_cursor: null })
    if (url.endsWith('/children')) {
      const results = body.children.map((block) => ({ ...block, id: `block-${++nextBlock}` }))
      page.blocks.push(...results)
      return json({ results })
    }
    if (options.method === 'DELETE') {
      const id = url.split('/').pop()
      for (const p of pages.values()) p.blocks = p.blocks.filter((b) => b.id !== id)
      return json({})
    }
    throw new Error(`Unexpected call ${url}`)
  }
  return { fetch, pages, calls, active: () => [...pages.values()].filter((p) => !p.archived) }
}

function api(db, fetch) {
  return loadTs('app/api/notion-sync/route.ts', {
    '@/lib/supabase-server': { createReadonlyServerClient: async () => db, createServerSupabaseClient: async () => db },
    '@/lib/crypto': { decryptSecret: (value) => value },
  }, { fetch, console: silent })
}

test('separate server instances serialize first sync and reuse one page', async () => {
  const d = database(), n = notionServer(), gate = deferred()
  let posts = 0
  const fetch = async (url, options) => { if (options.method === 'POST') { posts++; await gate.promise } return n.fetch(url, options) }
  const first = api(d.db, fetch).POST(request())
  await new Promise((resolve) => setImmediate(resolve))
  const second = api(d.db, fetch).POST(request())
  gate.resolve()
  const responses = await Promise.all([first, second])
  assert.deepEqual(responses.map((r) => r.status), [200, 200])
  assert.equal(posts, 1)
  assert.equal(n.active().length, 1)
  assert.equal(d.entry.notion_page_id, 'page-1')
  assert.equal(d.state.leaseId, null)
})

for (const failure of ['before', 'after']) {
  test(`final ID persistence failure (${failure} commit) recovers the same page on retry`, async () => {
    const d = database(), n = notionServer()
    d.faults.finalize = failure
    const route = api(d.db, n.fetch)
    assert.equal((await route.POST(request())).status, 500)
    assert.equal(d.state.pageId, 'page-1')
    assert.equal((await route.POST(request())).status, 200)
    assert.equal(n.pages.size, 1)
    assert.equal(n.active().length, 1)
    assert.equal(d.entry.notion_page_id, 'page-1')
  })
}

for (const failure of ['before', 'after']) {
  test(`failed creation checkpoint (${failure} commit) archives and clears both recovery fields`, async () => {
    const d = database(), n = notionServer()
    d.faults.checkpoint = failure
    const route = api(d.db, n.fetch)
    assert.equal((await route.POST(request())).status, 500)
    assert.equal(n.active().length, 0)
    assert.equal(d.state.pageId, null)
    assert.equal(d.state.createPending, false)
    assert.equal((await route.POST(request())).status, 200)
    assert.equal(n.active().length, 1)
  })
}

test('uncertain Notion creation blocks new creation on retry', async () => {
  const d = database(), n = notionServer()
  const route = api(d.db, async (url, options) => {
    await n.fetch(url, options)
    throw new Error('connection lost after external creation')
  })
  assert.equal((await route.POST(request())).status, 500)
  const retry = await route.POST(request())
  assert.equal(retry.status, 409)
  assert.equal((await retry.json()).error, 'sync_recovery_required')
  assert.equal(n.pages.size, 1)
})

for (const [action, failure] of [['prepare_create', 'before'], ['prepare_create', 'after'], ['renew', 'before'], ['renew', 'after']]) {
  test(`failure before Notion dispatch (${action}, ${failure} commit) clears preparation safely`, async () => {
    const d = database(), n = notionServer()
    d.faults[action] = failure
    const route = api(d.db, n.fetch)
    assert.equal((await route.POST(request())).status, 500)
    assert.equal(n.calls.length, 0)
    assert.equal(d.state.createPending, false)
    assert.equal(d.state.pageId, null)
    assert.equal((await route.POST(request())).status, 200)
    assert.equal(n.pages.size, 1)
    assert.equal(n.active().length, 1)
  })
}

test('pre-dispatch recovery never clears a new owner lease or checkpoint', async () => {
  const d = database(), n = notionServer()
  const rpc = d.db.rpc.bind(d.db)
  d.db.rpc = async (name, params) => {
    const result = await rpc(name, params)
    if (params.p_action === 'prepare_create') {
      d.state.leaseId = 'new-owner'
      return { data: null, error: { message: 'response lost and lease taken over' } }
    }
    return result
  }
  assert.equal((await api(d.db, n.fetch).POST(request())).status, 500)
  assert.equal(n.calls.length, 0)
  assert.equal(d.state.leaseId, 'new-owner')
  assert.equal(d.state.createPending, true)
})

test('lease loss forbids stale compensation and release of the new owner', async () => {
  const d = database(), n = notionServer()
  const route = api(d.db, async (url, options) => {
    const response = await n.fetch(url, options)
    if (options.method === 'POST') d.state.leaseId = 'new-owner'
    return response
  })
  assert.equal((await route.POST(request())).status, 500)
  assert.equal(n.active().length, 1)
  assert.equal(d.state.leaseId, 'new-owner')
  assert.equal(d.state.createPending, true)
  assert.equal(n.calls.filter((c) => c.body?.archived).length, 0)
})

test('archive success followed by lost discard response recovers the known page', async () => {
  const d = database(), n = notionServer()
  d.faults.checkpoint = 'after'
  d.faults.discard = 'before'
  const route = api(d.db, n.fetch)
  assert.equal((await route.POST(request())).status, 500)
  assert.equal(n.active().length, 0)
  assert.equal(d.state.pageId, 'page-1')
  assert.equal((await route.POST(request())).status, 200)
  assert.equal(n.pages.size, 1)
  assert.equal(n.active().length, 1)
})

test('sync reads current saved content instead of an old request payload', async () => {
  const d = database(), n = notionServer()
  d.entry.edited_draft = '新しく保存した本文'
  const route = api(d.db, n.fetch)
  assert.equal((await route.POST(request())).status, 200)
  const text = n.active()[0].blocks.flatMap((b) => b.paragraph.rich_text).map((p) => p.text.content).join('')
  assert.equal(text, d.entry.edited_draft)
})

test('failed long update retains old content and rolls back added blocks', async () => {
  const d = database(), n = notionServer(), route = api(d.db, n.fetch)
  assert.equal((await route.POST(request())).status, 200)
  d.entry.edited_draft = 'あ'.repeat(150000)
  let appends = 0
  const failing = api(d.db, async (url, options) => {
    if (url.endsWith('/children') && options.method === 'PATCH' && ++appends === 2) return json({ message: 'unavailable' }, 503)
    return n.fetch(url, options)
  })
  assert.equal((await failing.POST(request())).status, 500)
  const text = n.active()[0].blocks.flatMap((b) => b.paragraph.rich_text).map((p) => p.text.content).join('')
  assert.equal(text, input.draft)
})

test('new-page append failure archives the partial page before permitting a fresh retry', async () => {
  const d = database(), n = notionServer()
  d.entry.edited_draft = 'あ'.repeat(150000)
  const route = api(d.db, async (url, options) => {
    if (url.endsWith('/children') && options.method === 'PATCH') return json({ message: 'unavailable' }, 503)
    return n.fetch(url, options)
  })
  assert.equal((await route.POST(request())).status, 500)
  assert.equal(n.active().length, 0)
  assert.equal(d.state.createPending, false)
  assert.equal(d.state.pageId, null)
})

test('replacement reads every page of existing Notion blocks before deleting them', async () => {
  const d = database({ pageId: 'page-1' }), n = notionServer()
  const oldBlocks = Array.from({ length: 101 }, (_, i) => ({ id: `old-${i}`, paragraph: { rich_text: [{ text: { content: 'old' } }] } }))
  n.pages.set('page-1', { archived: false, blocks: [...oldBlocks] })
  let reads = 0
  const route = api(d.db, async (url, options) => {
    if (options.method === 'GET') {
      reads++
      return url.includes('start_cursor=')
        ? json({ results: oldBlocks.slice(100), has_more: false, next_cursor: null })
        : json({ results: oldBlocks.slice(0, 100), has_more: true, next_cursor: 'next' })
    }
    return n.fetch(url, options)
  })
  assert.equal((await route.POST(request())).status, 200)
  assert.equal(reads, 2)
  assert.equal(n.calls.filter((c) => c.method === 'DELETE').length, 101)
  assert.equal(n.active()[0].blocks.length, 1)
})

test('Notion body batches preserve Unicode within item and payload limits', () => {
  const { notionBodyBatches } = loadTs('lib/notion-content.ts')
  const text = 'a'.repeat(1999) + '😀' + 'あ\n\u0000😀'.repeat(70000)
  const batches = notionBodyBatches(text)
  const chunks = []
  for (const batch of batches) {
    assert.ok(batch.length <= 100)
    assert.ok(Buffer.byteLength(JSON.stringify({ children: batch })) < 500000)
    for (const block of batch) for (const part of block.paragraph.rich_text) {
      assert.ok(part.text.content.length <= 2000)
      assert.ok(!/[\uD800-\uDBFF]$/.test(part.text.content))
      chunks.push(part.text.content)
    }
  }
  assert.equal(chunks.join(''), text)
})

test('disconnect suppresses server defaults and all outbound requests', async () => {
  const d = database({ profile: { notion_token: null, notion_database_id: null } })
  const settings = loadTs('app/api/settings/route.ts', {
    '@/lib/supabase-server': { createReadonlyServerClient: async () => d.db, createServerSupabaseClient: async () => d.db },
    '@/lib/crypto': { encryptSecret: (value) => value },
  }, { process: { env: { NOTION_API_KEY: 'default-token', NOTION_DATABASE_ID: 'default-db' } }, console: silent })
  assert.equal((await (await settings.GET()).json()).hasNotionToken, true)
  assert.equal((await settings.POST(request({ notionToken: null, notionDatabaseId: '' }))).status, 200)
  assert.equal(d.profile.notion_token, '')
  assert.equal((await (await settings.GET()).json()).hasNotionToken, false)
  assert.equal((await api(d.db, async () => { throw new Error('must not send') }).POST(request())).status, 200)
})

test('client retries only known lock contention, never an uncertain creation outcome', async () => {
  class ApiError extends Error { constructor(status, message) { super(message); this.status = status } }
  let calls = 0
  const waits = []
  const { syncNotion } = loadTs('lib/notion-client.ts', {
    '@/lib/api-client': {
      ApiError,
      apiPost: async () => { if (++calls < 3) throw new ApiError(409, 'sync_busy'); return { success: true } },
    },
  }, { setTimeout: (resolve, ms) => { waits.push(ms); return setImmediate(resolve) } })
  await syncNotion(input)
  assert.equal(calls, 3)
  assert.deepEqual(waits, [1000, 2000])
  calls = 0
  const recovery = loadTs('lib/notion-client.ts', {
    '@/lib/api-client': { ApiError, apiPost: async () => { calls++; throw new ApiError(409, 'sync_recovery_required') } },
  })
  await assert.rejects(recovery.syncNotion(input), /sync_recovery_required/)
  assert.equal(calls, 1)
})
