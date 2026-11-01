import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DRAFT_CUT_MARK, draftMaxTokens, splitCutMark, type DraftPromptInput } from '@/lib/draft-prompt'
import { readDraftStream } from '@/lib/draft-stream'

// /api/generate-draft を、ログインと GROQ を偽物に差し替えて呼ぶ。
// 清書が出力の上限で止まった・途中で失敗したときに、届いた本文のあとへ「途中で切れた」の印が付くかを確かめる
const groq = vi.hoisted(() => ({
  chunks: [] as { content?: string; finish?: string | null }[],
  failAfter: null as number | null,
  params: null as Record<string, unknown> | null,
  controller: null as AbortController | null,
  requestSignal: null as AbortSignal | null,
  waitForAbort: false,
}))

vi.mock('@/lib/supabase-server', () => ({
  createReadonlyServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) } }),
}))

vi.mock('@/lib/groq', () => ({
  GROQ_MODELS: { quality: 'test-model', fast: 'test-fast', transcribe: 'test-whisper' },
  getGroqClient: () => ({
    chat: {
      completions: {
        create: async (params: Record<string, unknown>, options?: { signal?: AbortSignal }) => {
          groq.params = params
          groq.requestSignal = options?.signal ?? null
          const controller = new AbortController()
          groq.controller = controller
          const stream = (async function* () {
            for (const [i, c] of groq.chunks.entries()) {
              if (groq.failAfter !== null && i >= groq.failAfter) throw new Error('stream broken')
              yield { choices: [{ delta: { content: c.content }, finish_reason: c.finish ?? null }] }
            }
            if (groq.waitForAbort && !controller.signal.aborted) {
              await new Promise((resolve) => controller.signal.addEventListener('abort', resolve, { once: true }))
            }
          })()
          return Object.assign(stream, { controller })
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
  groq.controller = null
  groq.requestSignal = null
  groq.waitForAbort = false
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

  it('finish_reason のない接続終了や予期しない終了理由を、旧クライアントにも中断として伝える', async () => {
    for (const finish of [null, 'tool_calls', 'content_filter']) {
      groq.chunks = [{ content: '途中の本文', finish }]
      const { text } = await call()
      expect(splitCutMark(text)).toEqual({ text: '途中の本文', cut: true })
    }
  })

  it.each(['stop', 'length', null, 'tool_calls'])('NDJSONはfinish_reason=%sを本文と分けて通知する', async (finish) => {
    groq.chunks = [{ content: '本人の言葉', finish }]
    const response = await POST(new NextRequest('http://localhost/api/generate-draft', {
      method: 'POST', body: JSON.stringify(input), headers: { Accept: 'application/x-ndjson' },
    }))
    expect(response.headers.get('Content-Type')).toContain('application/x-ndjson')
    let text = ''
    const reading = readDraftStream(response.body!, (delta) => { text += delta })
    if (finish === 'stop') await expect(reading).resolves.toBeUndefined()
    else await expect(reading).rejects.toThrow(finish === 'length' ? 'length' : 'interrupted')
    expect(text).toBe('本人の言葉')
  })

  it('NDJSONはモデルの途中例外でも本文を保持し、未完了を通知する', async () => {
    groq.chunks = [{ content: '途中まで' }, { content: '未送信' }]
    groq.failAfter = 1
    const response = await POST(new NextRequest('http://localhost/api/generate-draft', {
      method: 'POST', body: JSON.stringify(input), headers: { Accept: 'application/x-ndjson' },
    }))
    let text = ''
    await expect(readDraftStream(response.body!, (delta) => { text += delta })).rejects.toThrow('interrupted')
    expect(text).toBe('途中まで')
  })

  it('レスポンスをキャンセルするとモデルの生成も中止する', async () => {
    groq.chunks = [{ content: '途中まで' }]
    groq.waitForAbort = true
    const response = await POST(new NextRequest('http://localhost/api/generate-draft', {
      method: 'POST', body: JSON.stringify(input), headers: { Accept: 'application/x-ndjson' },
    }))
    const reader = response.body!.getReader()
    await reader.read()
    await reader.cancel()
    expect(groq.controller?.signal.aborted).toBe(true)
  })

  it('リクエストの中断をモデルに伝え、本文を正常完了にしない', async () => {
    groq.chunks = [{ content: '途中まで' }]
    groq.waitForAbort = true
    const controller = new AbortController()
    const request = new NextRequest('http://localhost/api/generate-draft', {
      method: 'POST', body: JSON.stringify(input), signal: controller.signal, headers: { Accept: 'application/x-ndjson' },
    })
    const response = await POST(request)
    expect(groq.requestSignal).toBe(request.signal)
    controller.abort()
    expect(groq.controller?.signal.aborted).toBe(true)
    await expect(readDraftStream(response.body!, () => {})).rejects.toThrow('interrupted')
  })
})
