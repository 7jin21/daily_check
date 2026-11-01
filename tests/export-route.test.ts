import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({
  rows: [] as { entry_date: string; edited_draft: string }[],
  cursors: [] as string[],
  pageCap: 2,
  errorAt: 0,
  userId: 'user-a' as string | null,
}))

vi.mock('@/lib/supabase-server', () => ({
  createReadonlyServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: db.userId ? { id: db.userId } : null } }) },
    from(table: string) {
      expect(table).toBe('diary_entries')
      let after = ''
      const query = {
        select() { return query },
        eq(column: string, value: string) {
          expect(column).toBe('user_id')
          expect(value).toBe(db.userId)
          return query
        },
        order(column: string, options: { ascending: boolean }) {
          expect(column).toBe('entry_date')
          expect(options.ascending).toBe(true)
          return query
        },
        limit() { return query },
        gt(column: string, value: string) {
          expect(column).toBe('entry_date')
          after = value
          return query
        },
        then(resolve: (value: unknown) => unknown) {
          db.cursors.push(after)
          return Promise.resolve(db.errorAt === db.cursors.length
            ? { data: null, error: { message: 'unavailable' } }
            : { data: db.rows.filter((e) => e.entry_date > after).slice(0, db.pageCap), error: null }).then(resolve)
        },
      }
      return query
    },
  }),
}))

const { GET } = await import('@/app/api/export/route')

beforeEach(() => {
  db.rows = Array.from({ length: 5 }, (_, i) => ({ entry_date: `2026-10-${String(i + 1).padStart(2, '0')}`, edited_draft: `日記${i + 1}` }))
  db.cursors = []
  db.pageCap = 2
  db.errorAt = 0
  db.userId = 'user-a'
})

describe('/api/export', () => {
  it.each(['json', 'csv'])('サーバー側の上限が要求件数より小さくても全件を出力する（%s）', async (format) => {
    const response = await GET(new NextRequest(`http://localhost/api/export?format=${format}`))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    if (format === 'json') {
      expect(await response.json()).toEqual(db.rows)
    } else {
      const csv = await response.text()
      for (const row of db.rows) {
        expect(csv).toContain(row.entry_date)
        expect(csv).toContain(row.edited_draft)
      }
      expect(csv.trim().split('\n')).toHaveLength(6)
    }
    expect(db.cursors).toEqual(['', '2026-10-02', '2026-10-04', '2026-10-05'])
  })

  it('1,000件を超える記録も欠落しない', async () => {
    db.pageCap = 1000
    db.rows = Array.from({ length: 1001 }, (_, i) => ({
      entry_date: new Date(Date.UTC(2023, 0, 1 + i)).toISOString().slice(0, 10), edited_draft: `日記${i}`,
    }))
    const response = await GET(new NextRequest('http://localhost/api/export'))
    expect(await response.json()).toEqual(db.rows)
    expect(db.cursors).toHaveLength(3)
  })

  it('途中のページ取得失敗を、不完全なエクスポートの成功として返さない', async () => {
    db.errorAt = 2
    const response = await GET(new NextRequest('http://localhost/api/export'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'データ取得に失敗しました' })
  })

  it('未ログインでは日記を取得しない', async () => {
    db.userId = null
    expect((await GET(new NextRequest('http://localhost/api/export'))).status).toBe(401)
    expect(db.cursors).toEqual([])
  })

  it('記録がない場合も正しい空のファイルを返す', async () => {
    db.rows = []
    const response = await GET(new NextRequest('http://localhost/api/export'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })
})
