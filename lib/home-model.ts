// ホーム画面の表示用モデル（データ取得と描画の間の純粋な計算）。
// app/page.tsx（本番）と開発用プレビューの両方から使う。日付はすべて Asia/Tokyo 基準。
import { jstHour, subtractDays, toJSTDate } from '@/lib/jst'

export interface HomeEntry {
  id: string
  entry_date: string // YYYY-MM-DD
  mood: number
  energy: number
  summary: string | null
  dominant_emotion: string | null
  tags: string[]
}

/**
 * 「気分の波」に描く回数。サーバー（HomeView）が新しい順にこの件数だけを切り出して、ブラウザ（MoodCurve）へ送る。
 * 両方から読むので、'use client' の部品ではなくここに置く
 * （サーバーの部品が 'use client' のファイルから読む値は、数ではなくクライアント部品への参照になる）
 */
export const CURVE_POINTS = 14
/** 波に使う1回分 */
export type CurvePoint = Pick<HomeEntry, 'entry_date' | 'mood' | 'energy'>

export type DayPeriod = 'dawn' | 'day' | 'dusk' | 'night'

export interface HomeStats {
  total: number
  avgMood: number
  /** 連続記録日数（今日がまだでも、昨日まで続いていれば数える） */
  streak: number
  /**
   * 昨日が空いているとき、昨日を書けば何日の連続に戻るか（書き忘れ救済で埋めれば連続は復活する）。
   * 昨日が埋まっている・一昨日も空いているなら null
   */
  restorable: number | null
  /** 直近365日のうち、いちばん長く続いた日数 */
  longest: number
}

export interface HomeModel {
  today: string
  hourJST: number
  period: DayPeriod
  entries: HomeEntry[] // 新しい順・直近365日
  stats: HomeStats
  todayEntry: HomeEntry | null
  yesterday: string
  missedYesterday: boolean
  flashbacks: { label: string; entry: HomeEntry }[]
  recentEntries: HomeEntry[]
}

export function periodOf(hour: number): DayPeriod {
  if (hour >= 4 && hour < 7) return 'dawn'
  if (hour >= 7 && hour < 16) return 'day'
  if (hour >= 16 && hour < 19) return 'dusk'
  return 'night'
}

export function buildHomeModel(entries: HomeEntry[], total: number, now: Date = new Date()): HomeModel {
  const today = toJSTDate(now)
  const hourJST = jstHour(now)

  // 平均気分は直近365日
  const avgMood =
    entries.length > 0
      ? Math.round((entries.reduce((sum, e) => sum + (e.mood ?? 0), 0) / entries.length) * 10) / 10
      : 0

  // 連続記録日数: 今日の記録がなくても昨日から連続していれば維持する
  const dates = new Set(entries.map((e) => e.entry_date))
  const todayHasEntry = dates.has(today)
  const runFrom = (start: string) => {
    let n = 0
    while (dates.has(subtractDays(start, n))) n++
    return n
  }
  const yesterday = subtractDays(today, 1)
  const hasYesterday = dates.has(yesterday)
  const streak = (todayHasEntry ? 1 : 0) + runFrom(yesterday)

  // 昨日だけが空いている: 昨日を書けば、一昨日までの連続とつながる
  const beforeYesterday = runFrom(subtractDays(today, 2))
  const restorable = !hasYesterday && beforeYesterday > 0 ? (todayHasEntry ? 1 : 0) + 1 + beforeYesterday : null

  // いちばん長く続いた日数（古い順にたどる）
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const d of Array.from(dates).sort()) {
    run = prev !== null && subtractDays(d, 1) === prev ? run + 1 : 1
    if (run > longest) longest = run
    prev = d
  }

  const flashbacks = [
    { label: '一年前の今日', entry: entries.find((e) => e.entry_date === subtractDays(today, 365)) },
    { label: 'ひと月前の今日', entry: entries.find((e) => e.entry_date === subtractDays(today, 30)) },
  ].filter((f): f is { label: string; entry: HomeEntry } => !!f.entry)

  return {
    today,
    hourJST,
    period: periodOf(hourJST),
    entries,
    stats: { total, avgMood, streak, restorable, longest },
    todayEntry: entries.find((e) => e.entry_date === today) ?? null,
    yesterday,
    // 昨日が空で、それ以前に記録があるなら「あとから書く」導線を出す
    missedYesterday: !hasYesterday && entries.some((e) => e.entry_date < yesterday),
    flashbacks,
    recentEntries: entries.slice(0, 5),
  }
}
