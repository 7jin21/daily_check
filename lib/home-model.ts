// ホーム画面の表示用モデル（データ取得と描画の間の純粋な計算）。
// app/page.tsx（本番）と開発用プレビューの両方から使う。日付はすべて Asia/Tokyo 基準。
import { dayOfWeek, jstHour, subtractDays, toJSTDate } from '@/lib/jst'

// 日付の関数は lib/jst.ts にまとめた（既存の import 先を変えずに済むよう再公開する）
export { dayOfWeek, subtractDays, toJSTDate }

export interface HomeEntry {
  id: string
  entry_date: string // YYYY-MM-DD
  mood: number
  energy: number
  summary: string | null
  dominant_emotion: string | null
  tags: string[]
}

export type DayPeriod = 'dawn' | 'day' | 'dusk' | 'night'

export interface HomeModel {
  today: string
  hourJST: number
  period: DayPeriod
  entries: HomeEntry[] // 新しい順・直近365日
  stats: { total: number; avgMood: number; streak: number }
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
  const todayHasEntry = entries[0]?.entry_date === today
  let streak = 0
  for (let i = 0; i < entries.length; i++) {
    const expected = subtractDays(today, todayHasEntry ? i : i + 1)
    if (entries[i]?.entry_date === expected) streak++
    else break
  }

  const yesterday = subtractDays(today, 1)
  const hasYesterday = entries.some((e) => e.entry_date === yesterday)

  const flashbacks = [
    { label: '一年前の今日', entry: entries.find((e) => e.entry_date === subtractDays(today, 365)) },
    { label: 'ひと月前の今日', entry: entries.find((e) => e.entry_date === subtractDays(today, 30)) },
  ].filter((f): f is { label: string; entry: HomeEntry } => !!f.entry)

  return {
    today,
    hourJST,
    period: periodOf(hourJST),
    entries,
    stats: { total, avgMood, streak },
    todayEntry: entries.find((e) => e.entry_date === today) ?? null,
    yesterday,
    // 昨日が空で、それ以前に記録があるなら「あとから書く」導線を出す
    missedYesterday: !hasYesterday && entries.some((e) => e.entry_date < yesterday),
    flashbacks,
    recentEntries: entries.slice(0, 5),
  }
}
