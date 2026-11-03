// 日付・時刻の共通処理。このアプリは日本時間（Asia/Tokyo）で1日を区切る。
// 端末やサーバー（Vercel は UTC）のタイムゾーンに左右されないよう、日付は "YYYY-MM-DD" 文字列で扱い、
// 日数の計算は UTC の暦で行う。

export const APP_TIME_ZONE = 'Asia/Tokyo'

// 日付の書式は作るのが重い（1回およそ 0.1ms）ので、作ったものを使い回す。
// 入力のたび・一覧の行ごとに何度も呼ばれるため
const YMD = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE })
const HM = new Intl.DateTimeFormat('ja-JP', { timeZone: APP_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false })
const HOUR = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, hour: 'numeric', hour12: false })
const jaFormats = new Map<string, Intl.DateTimeFormat>()

/** YYYY-MM-DD の形をしているか */
export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Asia/Tokyo の日付を YYYY-MM-DD で返す */
export function toJSTDate(d: Date = new Date()): string {
  return YMD.format(d)
}

/** 今日（Asia/Tokyo）の日付 YYYY-MM-DD */
export function todayJST(): string {
  return toJSTDate()
}

/** YYYY-MM-DD 文字列から n 日前の日付文字列を返す（負なら n 日後） */
export function subtractDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10)
}

/** YYYY-MM-DD の曜日（0=日） */
export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** from から to まで何日あるか（to が後なら正） */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** YYYY-MM-DD を、その日の Asia/Tokyo の正午を指す Date にする（表示の変換で日付がずれないように） */
export function jstNoon(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00+09:00`)
}

/** YYYY-MM-DD を日本語で表示する（例: { month: 'long', day: 'numeric' } → 「10月10日」） */
export function formatJSTDate(dateStr: string, options: Intl.DateTimeFormatOptions): string {
  const key = JSON.stringify(options)
  let format = jaFormats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat('ja-JP', { timeZone: APP_TIME_ZONE, ...options })
    jaFormats.set(key, format)
  }
  return format.format(jstNoon(dateStr))
}

/** YYYY-MM-DD を「10.4」の形で短く表示する */
export function shortDate(dateStr: string): string {
  return `${Number(dateStr.slice(5, 7))}.${Number(dateStr.slice(8, 10))}`
}

/** いまの Asia/Tokyo の時刻 HH:MM */
export function jstTimeHM(d: Date = new Date()): string {
  return HM.format(d)
}

/** いまの Asia/Tokyo の時（0〜23） */
export function jstHour(d: Date = new Date()): number {
  return parseInt(HOUR.format(d), 10) % 24
}
