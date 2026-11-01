/** 本文と完了通知を分ける。通信の終了だけでは清書の正常完了と扱わない。 */
export type DraftStreamFrame =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; reason: 'length' | 'interrupted' }

export async function readDraftStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let completed = false
  const accept = (line: string) => {
    if (!line.trim()) return
    if (completed) throw new Error('Unexpected data after draft completion')
    const frame = JSON.parse(line) as DraftStreamFrame
    if (frame.type === 'delta' && typeof frame.text === 'string') onDelta(frame.text)
    else if (frame.type === 'done') completed = true
    else if (frame.type === 'error') throw new Error(`Draft interrupted: ${frame.reason}`)
    else throw new Error('Invalid draft stream')
  }
  try {
    for (;;) {
      const { done, value } = await reader.read()
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true })
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      lines.forEach(accept)
      if (done) break
    }
    if (pending.trim()) accept(pending)
    if (!completed) throw new Error('Draft stream ended before completion')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
