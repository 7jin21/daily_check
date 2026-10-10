import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiPost } from '@/lib/api-client'
import {
  clearReflectionCache,
  hasReflectionMaterial,
  prefetchReflection,
  reflectionKey,
  REFLECTION_TIMEOUT_MS,
  requestReflection,
  type ReflectionResult,
} from '@/lib/reflection-prefetch'
import type { CheckinInput } from '@/stores/checkin'

vi.mock('@/lib/api-client', () => ({ apiPost: vi.fn() }))

const post = vi.mocked(apiPost)

const input: CheckinInput = { mood: 3, energy: 2, events: '会議で疲れた', challenges: '', gratitude: '', freeform: '' }
const QUESTION: ReflectionResult = { skip: false, question: '一番引っかかったのは？', options: ['前提', '時間', '言い方'] }

/** 外から resolve / reject できる Promise（API の応答の時機を決めるため） */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  clearReflectionCache()
  post.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('hasReflectionMaterial / reflectionKey', () => {
  it('メモの合計が4文字以上なら材料がある', () => {
    expect(hasReflectionMaterial({ ...input, events: 'abc' })).toBe(false)
    expect(hasReflectionMaterial({ ...input, events: ' abcd ' })).toBe(true)
    expect(hasReflectionMaterial({ ...input, events: '', freeform: '   ' })).toBe(false)
  })

  it('前後の空白の違いでは変わらず、気分・メモが変われば変わる', () => {
    const k = reflectionKey(input)
    expect(reflectionKey({ ...input, events: ' 会議で疲れた\n' })).toBe(k)
    expect(reflectionKey({ ...input, mood: 4 })).not.toBe(k)
    expect(reflectionKey({ ...input, gratitude: '友達' })).not.toBe(k)
  })
})

describe('requestReflection', () => {
  it('材料が無ければ API を呼ばずに「問いなし」', async () => {
    const short = { ...input, events: 'abc' }
    prefetchReflection(short)
    await expect(requestReflection(short)).resolves.toEqual({ skip: true })
    expect(post).not.toHaveBeenCalled()
  })

  it('先読みした問いを使う（同じ入力なら API は1回だけ）', async () => {
    post.mockResolvedValue(QUESTION)
    prefetchReflection(input)
    prefetchReflection({ ...input }) // 同じ入力をもう一度先読みしても作り直さない
    await expect(requestReflection({ ...input, events: ` ${input.events} ` })).resolves.toEqual(QUESTION)
    await expect(requestReflection(input)).resolves.toEqual(QUESTION)
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/api/checkin-question', input, { retry: false })
  })

  it('先読みしていなければ、その場で作る', async () => {
    post.mockResolvedValue(QUESTION)
    await expect(requestReflection(input)).resolves.toEqual(QUESTION)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('入力が変わったら作り直す', async () => {
    post.mockResolvedValueOnce(QUESTION).mockResolvedValueOnce({ ...QUESTION, question: '別の問い' })
    prefetchReflection(input)
    const changed = { ...input, events: '会議で疲れた。でも褒められた' }
    await expect(requestReflection(changed)).resolves.toEqual({ ...QUESTION, question: '別の問い' })
    expect(post).toHaveBeenCalledTimes(2)
    expect(post).toHaveBeenLastCalledWith('/api/checkin-question', changed, { retry: false })
  })

  it('気分が変わっても作り直す', async () => {
    post.mockResolvedValue(QUESTION)
    prefetchReflection(input)
    await requestReflection({ ...input, mood: 5 })
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('使えない応答（skip・選択肢が2つ未満・問いが空）は「問いなし」', async () => {
    for (const r of [
      { skip: true },
      { skip: false, question: '問い', options: ['1つだけ'] },
      { skip: false, question: '', options: ['a', 'b'] },
      { skip: false, question: '問い' },
      null,
    ]) {
      clearReflectionCache()
      post.mockResolvedValueOnce(r)
      await expect(requestReflection(input), JSON.stringify(r)).resolves.toEqual({ skip: true })
    }
  })

  it('失敗したら「問いなし」で、次に頼まれたときは取り直す', async () => {
    post.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce(QUESTION)
    await expect(requestReflection(input)).resolves.toEqual({ skip: true })
    await expect(requestReflection(input)).resolves.toEqual(QUESTION)
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('先読みが失敗しても覚えておかない', async () => {
    const first = deferred<ReflectionResult>()
    post.mockReturnValueOnce(first.promise).mockResolvedValueOnce(QUESTION)
    prefetchReflection(input)
    first.reject(new Error('network'))
    await new Promise((r) => setTimeout(r, 0)) // 失敗の後始末（キャッシュを捨てる）まで進める
    await expect(requestReflection(input)).resolves.toEqual(QUESTION)
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('待ちすぎたら「問いなし」で進む（既定は7秒）', async () => {
    vi.useFakeTimers()
    const pending = deferred<ReflectionResult>()
    post.mockReturnValue(pending.promise)
    let settled: ReflectionResult | undefined
    void requestReflection(input).then((r) => (settled = r))

    await vi.advanceTimersByTimeAsync(REFLECTION_TIMEOUT_MS - 1)
    expect(settled).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toEqual({ skip: true })
    expect(REFLECTION_TIMEOUT_MS).toBe(7000)
  })

  it('時間切れのあとに届いた問いは、同じ入力の次の依頼で使う', async () => {
    vi.useFakeTimers()
    const pending = deferred<ReflectionResult>()
    post.mockReturnValue(pending.promise)
    const first = requestReflection(input, 100)
    await vi.advanceTimersByTimeAsync(100)
    await expect(first).resolves.toEqual({ skip: true })

    pending.resolve(QUESTION)
    await expect(requestReflection(input, 100)).resolves.toEqual(QUESTION)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('間に合えばタイマーを残さない', async () => {
    vi.useFakeTimers()
    post.mockResolvedValue(QUESTION)
    await expect(requestReflection(input)).resolves.toEqual(QUESTION)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('clearReflectionCache', () => {
  it('捨てたあとは作り直す', async () => {
    post.mockResolvedValue(QUESTION)
    await requestReflection(input)
    clearReflectionCache()
    await requestReflection(input)
    expect(post).toHaveBeenCalledTimes(2)
  })
})
