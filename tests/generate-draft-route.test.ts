import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DRAFT_CUT_MARK, draftMaxTokens, splitCutMark, type DraftPromptInput } from '@/lib/draft-prompt'

// /api/generate-draft を、ログインと GROQ を偽物に差し替えて呼ぶ。
// 清書が出力の上限で止まった・途中で失敗したときに、届いた本文のあとへ「途中で切れた」の印が付くかを確かめる
const groq = vi.hoisted(() => ({
  chunks: [] as { content?: string; finish?: string | null }[],
  failAfter: null as number | null,
  params: null as Record<string, unknown> | null,
}))

vi.mock('@/lib/supabase-server', () => ({
  createReadonlyServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) } }),
}))

vi.mock('@/lib/groq', () => ({
  GROQ_MODELS: { quality: 'test-model', fast: 'test-fast', transcribe: 'test-whisper' },
  getGroqClient: () => ({
    chat: {
      completions: {
        create: async (params: Record<string, unknown>) => {
          groq.params = params
          return (async function* () {
            for (const [i, c] of groq.chunks.entries()) {
              if (groq.failAfter !== null && i >= groq.failAfter) throw new Error('stream broken')
              yield { choices: [{ delta: { content: c.content }, finish_reason: c.finish ?? null }] }
            }
          })()
        },
      },
    },
  }),
}))

const { POST } = await import('@/app/api/generate-draft/route')

const input: DraftPromptInput = { mood: 4, energy: 3, events: '朝ジム。夜は会議の資料', challenges: '', gratitude: '', freeform: '' }

async function call(body: unknown = input) {
  const res = await POST(
    new NextRequest('http://localhost/api/generate-draft', { method: 'POST', body: JSON.stringify(body) })
  )
  return { res, text: await res.text() }
}

beforeEach(() => {
  process.env.GROQ_API_KEY = 'test-key'
  groq.chunks = []
  groq.failAfter = null
  groq.params = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  delete process.env.GROQ_API_KEY
  vi.restoreAllMocks()
})

describe('/api/generate-draft のストリーム', () => {
  it('最後まで書けた清書には印を付けない', async () => {
    groq.chunks = [{ content: '朝ジム。' }, { content: '夜は会議の資料。', finish: 'stop' }]
    const { res, text } = await call()
    expect(res.headers.get('X-Draft-Fallback')).toBeNull()
    expect(text).toBe('朝ジム。夜は会議の資料。')
    expect(splitCutMark(text).cut).toBe(false)
  })

  it('出力の上限（finish_reason: length）で止まったら、届いた本文のあとに印を付ける', async () => {
    groq.chunks = [{ content: '朝ジム。' }, { content: '夜は会議の', finish: 'length' }]
    const { text } = await call()
    expect(text).toBe(`朝ジム。夜は会議の${DRAFT_CUT_MARK}`)
    // 画面側は印を取り除いて「清書が途中で止まりました」と出す。届いた本文は一字も欠けない
    expect(splitCutMark(text)).toEqual({ text: '朝ジム。夜は会議の', cut: true })
  })

  it('途中で失敗したときも、届いた分を残して印を付ける（ストリームは正常に閉じる）', async () => {
    groq.chunks = [{ content: '朝ジム。' }, { content: '夜は' }, { content: '会議' }]
    groq.failAfter = 2
    const { text } = await call()
    expect(splitCutMark(text)).toEqual({ text: '朝ジム。夜は', cut: true })
  })

  it('出力の上限は入力の長さに合わせて渡す（評価スクリプトと同じ draftMaxTokens）', async () => {
    groq.chunks = [{ content: 'x', finish: 'stop' }]
    const long = { ...input, events: 'あ'.repeat(500), freeform: 'い'.repeat(500), challenges: 'う'.repeat(500), gratitude: 'え'.repeat(500) }
    await call(long)
    expect(groq.params?.max_tokens).toBe(draftMaxTokens(long))
    expect(groq.params?.max_tokens as number).toBeGreaterThan(1536)
    expect(groq.params?.stream).toBe(true)
  })

  it('GROQ が未設定なら、これまでどおりフォールバック（印は付けない）', async () => {
    delete process.env.GROQ_API_KEY
    const { res, text } = await call()
    expect(res.headers.get('X-Draft-Fallback')).toBe('1')
    expect(splitCutMark(text).cut).toBe(false)
  })
})
