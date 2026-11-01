const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./helpers.cjs')

function reminderFixture({ todayError = null, todayEntries = [], subscriptions = null } = {}) {
  const sent = []
  const lookups = []
  const subs = subscriptions ?? ['recorded-user', 'waiting-user'].map((userId) => ({
    user_id: userId, endpoint: `https://push.example/${userId}`, p256dh: 'mock', auth: 'mock',
  }))
  const route = loadTs('app/api/cron/reminder/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    'web-push': {
      setVapidDetails() {},
      async sendNotification(subscription, payload) { sent.push({ ...subscription, payload: JSON.parse(payload) }) },
    },
    '@/lib/supabase-admin': { createAdminClient: () => ({
      from(table) {
        if (table === 'push_subscriptions') return { select: async () => ({ data: subs, error: null }) }
        assert.equal(table, 'diary_entries')
        let columns = ''
        return {
          select(value) { columns = value; return this },
          eq(column, value) { assert.equal(column, 'entry_date'); lookups.push({ columns, date: value }); return this },
          async in(column, userIds) {
            assert.equal(column, 'user_id')
            assert.deepEqual(Array.from(userIds), ['recorded-user', 'waiting-user'])
            return columns === 'user_id'
              ? { data: todayError ? null : todayEntries, error: todayError }
              : { data: [{ user_id: 'waiting-user', mood: 4 }], error: null }
          },
        }
      },
    }) },
  }, {
    process: { env: { CRON_SECRET: 'mock', NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'mock', VAPID_PRIVATE_KEY: 'mock' } },
    console: { ...console, error() {} },
  })
  return { route, sent, lookups, request: { headers: { get: () => 'Bearer mock' } } }
}

test('reminders stop before sending anything when today entries cannot be checked', async () => {
  const h = reminderFixture({ todayError: { message: 'database timeout' } })
  const response = await h.route.GET(h.request)
  assert.equal(response.status, 500)
  assert.match((await response.json()).error, /通知を中止/)
  assert.deepEqual(h.sent, [])
  assert.equal(h.lookups.length, 1)
})

test('reminders skip recorded users and retain yesterday mood for unrecorded users', async () => {
  const h = reminderFixture({ todayEntries: [{ user_id: 'recorded-user' }] })
  const response = await h.route.GET(h.request)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { sent: 1, skipped: 1, removed: 0 })
  assert.equal(h.sent.length, 1)
  assert.equal(h.sent[0].endpoint, 'https://push.example/waiting-user')
  assert.match(h.sent[0].payload.body, /昨日の気分は🙂/)
})

test('an empty successful today lookup still sends reminders', async () => {
  const h = reminderFixture()
  const response = await h.route.GET(h.request)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { sent: 2, skipped: 0, removed: 0 })
  assert.equal(h.sent.length, 2)
})

test('no subscriptions returns without querying diary entries or sending', async () => {
  const h = reminderFixture({ subscriptions: [] })
  const response = await h.route.GET(h.request)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { sent: 0, skipped: 0, removed: 0 })
  assert.deepEqual(h.lookups, [])
  assert.deepEqual(h.sent, [])
})
