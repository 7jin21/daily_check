// 日付・時刻の共通処理。このアプリは日本時間（Asia/Tokyo）で1日を区切る。
// 端末やサーバー（Vercel は UTC）のタイムゾーンに左右されないよう、日付は "YYYY-MM-DD" 文字列で扱い、
// 日数の計算は UTC の暦で行う。

export const APP_TIME_ZONE = 'Asia/Tokyo'

/** Asia/Tokyo の日付を YYYY-MM-DD で返す */
export function toJSTDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE })
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
  return jstNoon(dateStr).toLocaleDateString('ja-JP', { timeZone: APP_TIME_ZONE, ...options })
}

/** いまの Asia/Tokyo の時刻 HH:MM */
export function jstTimeHM(d: Date = new Date()): string {
  return d.toLocaleTimeString('ja-JP', { timeZone: APP_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false })
}

/** いまの Asia/Tokyo の時（0〜23） */
export function jstHour(d: Date = new Date()): number {
  return parseInt(d.toLocaleString('en-US', { timeZone: APP_TIME_ZONE, hour: 'numeric', hour12: false }), 10) % 24
}
