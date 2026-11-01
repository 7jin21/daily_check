import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  selected: '',
  messages: [] as { role: string; content: string }[],
}))

vi.mock('@/lib/supabase-server', () => ({
  createReadonlyServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-a' } } }) },
    from() {
      const query = {
        select(columns: string) { state.selected = columns; return query },
        eq(column: string, value: string) {
          expect(column).toBe('user_id')
          expect(value).toBe('user-a')
          return query
        },
        gte() { return query }, order() { return query }, limit() { return query },
        then(resolve: (value: unknown) => unknown) {
          const columns = state.selected.split(',').map((s) => s.trim())
          const data = state.rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])))
          return Promise.resolve({ data, error: null }).then(resolve)
        },
      }
      return query
    },
  }),
}))

vi.mock('@/lib/groq', () => ({
  GROQ_MODELS: { quality: 'test-model' },
  getGroqClient: () => ({ chat: { completions: {
    create: async (options: { messages: typeof state.messages }) => {
      state.messages = options.messages
      return { choices: [{ message: { content: JSON.stringify({
        personalityType: 'test', description: 'test', strengths: [], growthAreas: [], emotionalPatterns: [],
        coreValues: [], recommendations: [],
        emotionTriggers: [{ trigger: 'test', effect: 'positive', dates: ['2026-11-01', '2026-10-30', '2099-01-01'] }],
        narrative: 'test', highlight: 'test', challenge: 'test', nextFocus: 'test', weekMood: 'test',
      }) } }] }
    },
  } } }),
}))

const { POST: analyze } = await import('@/app/api/analyze/route')
const { POST: weekly } = await import('@/app/api/weekly-report/route')
const { POST: ask } = await import('@/app/api/ask/route')

beforeEach(() => {
  vi.stubEnv('GROQ_API_KEY', 'test-key')
  const blank = {
    entry_date: '2026-11-01', mood: 3, energy: 3, events: null, challenges: null,
    gratitude: null, freeform: null, edited_draft: null, ai_draft: null, dominant_emotion: null,
  }
  state.rows = [
    { ...blank, edited_draft: '気分だけの記録にあとから直接書いた言葉' },
    { ...blank, entry_date: '2026-10-31', freeform: `${'長い自由メモ'.repeat(100)}\n\n【ふりかえり】何を大切に？\n→ 家族との約束\n\n【あとから 2026-11-01】今は安心している` },
    { ...blank, entry_date: '2026-10-30', events: '本人が書いた会議の予定', ai_draft: '会議に出席した。', edited_draft: '訂正：会議は中止だった。' },
    { ...blank, entry_date: '2026-10-29', events: '本人のメモ', edited_draft: 'AIによる装飾された言葉', ai_draft: 'AIによる装飾された言葉' },
    { ...blank, entry_date: '2026-10-28' },
  ]
  state.selected = ''
  state.messages = []
})

afterEach(() => vi.unstubAllEnvs())

describe('分析APIが本人の原文と更新本文を区別して渡す', () => {
  it.each(['analyze', 'weekly-report', 'ask'])('%s の実際のDB取得列とAI送信内容を確認する', async (name) => {
    const req = new NextRequest(`http://localhost/api/${name}`, { method: 'POST', body: JSON.stringify({ question: '最近の変化は？' }) })
    const response = name === 'analyze' ? await analyze() : name === 'weekly-report' ? await weekly(req) : await ask(req)
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.isFallback).not.toBe(true)
    const prompt = state.messages.map((m) => m.content).join('\n')
    expect(prompt).toContain('日記: 気分だけの記録にあとから直接書いた言葉')
    expect(prompt).toContain('【ふりかえり】何を大切に？ → 家族との約束')
    expect(prompt).toContain('【あとから 2026-11-01】今は安心している')
    expect(prompt).toContain('編集後の本文（AI清書を含む場合あり）: 訂正：会議は中止だった。')
    expect(prompt).toContain('本人の原文として引用したり')
    expect(prompt).not.toContain('AIによる装飾された言葉')
    if (name === 'analyze') {
      expect(result.emotionTriggers[0].evidence).toEqual([
        { date: '2026-11-01', mood: 3, quote: '気分だけの記録にあとから直接書いた言葉' },
        { date: '2026-10-30', mood: 3, quote: '本人が書いた会議の予定' },
      ])
    }
  })
})
