// 週次レポートの「来週のフォーカス」を本人が採用したもの（この端末の localStorage に保存）。
// ホームに表示し、実施した日をワンタップで残す。次の週次レポートでふり返りの材料になる。
import { STORAGE_KEYS } from '@/lib/constants'

export interface Focus {
  text: string
  adoptedAt: string // YYYY-MM-DD (JST)
  doneDates: string[] // 実施した日 YYYY-MM-DD
}

export const FOCUS_MAX_CHARS = 60
/** 採用から何日間ホームに出すか（週次レポートを作り直す目安の2週間） */
const ACTIVE_DAYS = 14

export function loadFocus(): Focus | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FOCUS)
    if (!raw) return null
    const f = JSON.parse(raw) as Partial<Focus>
    if (typeof f.text !== 'string' || !f.text.trim() || typeof f.adoptedAt !== 'string') return null
    return {
      text: f.text,
      adoptedAt: f.adoptedAt,
      doneDates: Array.isArray(f.doneDates) ? f.doneDates.filter((d) => typeof d === 'string') : [],
    }
  } catch {
    return null
  }
}

export function saveFocus(focus: Focus | null) {
  try {
    if (focus) localStorage.setItem(STORAGE_KEYS.FOCUS, JSON.stringify(focus))
    else localStorage.removeItem(STORAGE_KEYS.FOCUS)
  } catch {
    // localStorage が使えない環境では保存しない
  }
}

const daysBetween = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000

export function isFocusActive(focus: Focus | null, today: string): focus is Focus {
  return !!focus && daysBetween(focus.adoptedAt, today) <= ACTIVE_DAYS
}

/** 直近7日（今日を含む）に実施した日数 */
export function doneInLastWeek(focus: Focus, today: string): number {
  return focus.doneDates.filter((d) => {
    const diff = daysBetween(d, today)
    return diff >= 0 && diff < 7
  }).length
}

export function toggleDone(focus: Focus, date: string): Focus {
  const has = focus.doneDates.includes(date)
  return {
    ...focus,
    // 古い記録は30件で打ち切る
    doneDates: has ? focus.doneDates.filter((d) => d !== date) : [...focus.doneDates, date].slice(-30),
  }
}
