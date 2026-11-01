// 保存した直後にホームへ戻ったとき、その日の丸に色が落ちる演出（「水面に一滴」の続き）のための目印。
// 保存した画面で残し、ホームで一度だけ読んで消す。タブを閉じれば消える sessionStorage に置く。

const KEY = 'inner-mirror-save-echo'
/** これより前の保存の目印は使わない（あとで開いたホームで、急に演出が出ないように） */
const TTL_MS = 10 * 60 * 1000

export interface SaveEchoMark {
  date: string // YYYY-MM-DD（記録した日）
  mood: number // 1〜5
  at: number // 保存した時刻（ms）
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function markSaveEcho(date: string, mood: number | null, now = Date.now(), store: Store | null = defaultStore()) {
  if (!store) return
  const m = typeof mood === 'number' && mood >= 1 && mood <= 5 ? Math.round(mood) : 3
  try {
    store.setItem(KEY, JSON.stringify({ date, mood: m, at: now } satisfies SaveEchoMark))
  } catch {
    // 保存できない環境では演出を出さないだけ
  }
}

/** 目印を読んで消す。形が正しくない・古いものは捨てる */
export function takeSaveEcho(now = Date.now(), store: Store | null = defaultStore()): SaveEchoMark | null {
  if (!store) return null
  let raw: string | null = null
  try {
    raw = store.getItem(KEY)
    store.removeItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<SaveEchoMark>
    if (typeof v.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return null
    if (typeof v.mood !== 'number' || !Number.isInteger(v.mood) || v.mood < 1 || v.mood > 5) return null
    if (typeof v.at !== 'number' || now - v.at < 0 || now - v.at > TTL_MS) return null
    return { date: v.date, mood: v.mood, at: v.at }
  } catch {
    return null
  }
}
