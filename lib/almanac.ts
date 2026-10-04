// ホームの「水鏡」ヒーロー用の暦ユーティリティ（月齢・月の形・漢数字）。

const SYNODIC_MONTH = 29.530588853
// 基準の新月: 2000-01-06 18:14 UTC
const NEW_MOON_REF_MS = Date.UTC(2000, 0, 6, 18, 14)

/** 月齢（0〜29.53日）。精度は ±0.5 日程度で、表示用には十分 */
export function moonAge(date: Date): number {
  const days = (date.getTime() - NEW_MOON_REF_MS) / 86_400_000
  return ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH
}

/** 月の呼び名（和名） */
export function moonName(age: number): string {
  if (age < 1.5) return '新月'
  if (age < 3.5) return '三日月'
  if (age < 6.5) return '夕月'
  if (age < 8.5) return '上弦の月'
  if (age < 11.5) return '十日夜の月'
  if (age < 13.5) return '十三夜'
  if (age < 14.5) return '小望月'
  if (age < 16) return '満月'
  if (age < 17) return '十六夜'
  if (age < 18) return '立待月'
  if (age < 19) return '居待月'
  if (age < 20) return '寝待月'
  if (age < 21.5) return '更待月'
  if (age < 24) return '下弦の月'
  if (age < 28) return '有明月'
  return '晦の月'
}

/**
 * 月の明るい部分の SVG パス（中心 cx,cy・半径 r）。北半球の見え方（満ちる月は右側から光る）。
 * 外側の縁を半円で描き、明暗境界（楕円弧）で戻る。
 */
export function moonLitPath(age: number, cx: number, cy: number, r: number): string {
  const p = age / SYNODIC_MONTH // 0=新月, 0.5=満月
  const rx = Math.abs(Math.cos(2 * Math.PI * p)) * r
  const waxing = p < 0.5
  const limbSweep = waxing ? 1 : 0
  // 三日月〜半月は境界が光る側へ、半月〜満月は反対側へふくらむ
  const termSweep = waxing ? (p < 0.25 ? 0 : 1) : p < 0.75 ? 0 : 1
  const f = (n: number) => n.toFixed(2)
  return `M ${f(cx)} ${f(cy - r)} A ${f(r)} ${f(r)} 0 0 ${limbSweep} ${f(cx)} ${f(cy + r)} A ${f(rx)} ${f(r)} 0 0 ${termSweep} ${f(cx)} ${f(cy - r)} Z`
}

const KANJI_DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/** 1〜99 を漢数字に（10→十, 21→二十一） */
export function toKanjiNumber(n: number): string {
  if (n < 10) return KANJI_DIGITS[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return `${tens === 1 ? '' : KANJI_DIGITS[tens]}十${ones === 0 ? '' : KANJI_DIGITS[ones]}`
}

export const WEEKDAY_KANJI = ['日', '月', '火', '水', '木', '金', '土'] as const
