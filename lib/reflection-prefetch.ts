// AI 内省ガイドの問い（/api/checkin-question）の先読み。
// 以前は清書の直前に問いを作りはじめ、最大7秒の待ち画面が出ていた。メモを書いている間に裏で作っておき、
// 下書き画面では出来上がった問いをすぐ出す。入力が変わったら作り直す（同じ入力なら1回だけ）。
import { apiPost } from '@/lib/api-client'
import type { CheckinInput } from '@/stores/checkin'

export interface ReflectionResult {
  skip: boolean
  question?: string
  options?: string[]
}

const SKIP: ReflectionResult = { skip: true }

/** これ未満の文字数なら問いを作らない（サーバー側 /api/checkin-question と同じ基準） */
export const MIN_TEXT_FOR_REFLECTION = 4

/** 下書き画面で問いを待つ最大時間。過ぎたら問いなしで清書へ進む（絶対にブロックしない） */
export const REFLECTION_TIMEOUT_MS = 7000

let cache: { key: string; promise: Promise<ReflectionResult> } | null = null

function texts(input: CheckinInput): string[] {
  return [input.events, input.challenges, input.gratitude, input.freeform].map((s) =>
    typeof s === 'string' ? s.trim() : ''
  )
}

/** 問いの材料になる入力の同一性（同じなら作り直さない） */
export function reflectionKey(input: CheckinInput): string {
  return JSON.stringify([input.mood, input.energy, ...texts(input)])
}

/** 問いを作る材料があるか */
export function hasReflectionMaterial(input: CheckinInput): boolean {
  return texts(input).filter(Boolean).join('\n').length >= MIN_TEXT_FOR_REFLECTION
}

function isUsable(r: ReflectionResult | null | undefined): r is Required<ReflectionResult> {
  return !!r && !r.skip && !!r.question && Array.isArray(r.options) && r.options.length >= 2
}

function start(input: CheckinInput, key: string): Promise<ReflectionResult> {
  const entry: { key: string; promise: Promise<ReflectionResult> } = { key, promise: Promise.resolve(SKIP) }
  entry.promise = apiPost<ReflectionResult>('/api/checkin-question', input, { retry: false })
    .then((r) => (isUsable(r) ? r : SKIP))
    .catch(() => {
      // 失敗は覚えておかない（次に頼まれたときに取り直す）。
      // ただし消すのは自分の分だけ（同じ入力で後から始めた、まだ途中の先読みは残す）
      if (cache === entry) cache = null
      return SKIP
    })
  cache = entry
  return entry.promise
}

/** 問いを先に作りはじめる（材料が無い・同じ入力で作成済みなら何もしない） */
export function prefetchReflection(input: CheckinInput): void {
  if (!hasReflectionMaterial(input)) return
  const key = reflectionKey(input)
  if (cache?.key === key) return
  void start(input, key)
}

/**
 * 問いを受け取る。先読みした問いが同じ入力のものならそれを使い、なければ今から作る。
 * timeoutMs を過ぎても届かなければ「問いなし」を返す。
 */
export async function requestReflection(
  input: CheckinInput,
  timeoutMs: number = REFLECTION_TIMEOUT_MS
): Promise<ReflectionResult> {
  if (!hasReflectionMaterial(input)) return SKIP
  const key = reflectionKey(input)
  const promise = cache?.key === key ? cache.promise : start(input, key)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<ReflectionResult>((resolve) => {
    timer = setTimeout(() => resolve(SKIP), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** 先読みした問いを捨てる（保存後・入力のリセット時） */
export function clearReflectionCache(): void {
  cache = null
}
