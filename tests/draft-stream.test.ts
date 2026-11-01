import { describe, expect, it } from 'vitest'
import { readDraftStream } from '@/lib/draft-stream'

describe('readDraftStream', () => {
  it('UTF-8の途中やフレームの途中で分割されても本文を復元する', async () => {
    const bytes = new TextEncoder().encode(`${JSON.stringify({ type: 'delta', text: '今日も、ありがとう。😀' })}\n{"type":"done"}\n`)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
        controller.close()
      },
    })
    let text = ''
    await readDraftStream(body, (delta) => { text += delta })
    expect(text).toBe('今日も、ありがとう。😀')
  })

  it('完了通知のない通信終了を成功扱いしない', async () => {
    let text = ''
    const body = new Response('{"type":"delta","text":"途中まで"}\n').body!
    await expect(readDraftStream(body, (delta) => { text += delta })).rejects.toThrow('before completion')
    expect(text).toBe('途中まで')
  })

  it('エラー通知を受けても既に届いた本文は保持する', async () => {
    let text = ''
    const body = new Response('{"type":"delta","text":"途中まで"}\n{"type":"error","reason":"length"}\n').body!
    await expect(readDraftStream(body, (delta) => { text += delta })).rejects.toThrow('length')
    expect(text).toBe('途中まで')
  })

  it('画面側が処理を中止したら読み取りをキャンセルする', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('{"type":"delta","text":"届いた本文"}\n')) },
      cancel() { cancelled = true },
    })
    await expect(readDraftStream(body, () => { throw new DOMException('Obsolete draft', 'AbortError') })).rejects.toThrow('Obsolete draft')
    expect(cancelled).toBe(true)
    expect(body.locked).toBe(false)
  })
})
