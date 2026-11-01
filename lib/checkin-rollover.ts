// チェックインの書きかけが日付をまたいだときの扱い（純粋関数）。
// 夜に書き始めて日付が変わってから戻ってきても、書いた言葉を消さない。
// 言葉のある書きかけは「書き始めた日」の記録として続ける（過去日付の記録と同じ仕組み・同じ7日の範囲）。
import { daysBetween } from '@/lib/jst'

/** 過去日付の記録（書き忘れ救済）は何日前まで書けるか */
export const BACKFILL_DAYS = 7

/** 過去日付の記録として書ける日か（昨日〜7日前） */
export function isValidPastDate(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  if (date >= today) return false
  return daysBetween(date, today) <= BACKFILL_DAYS
}

/** 判定に使う、チェックインの入力（stores/checkin.ts の保存している値） */
export interface PendingCheckin {
  mood: number | null
  checkinDate: string | null // 入力を始めた日
  targetDate: string | null // 記録の対象日（null = 書き始めた日＝その日の今日）
  events: string
  challenges: string
  gratitude: string
  freeform: string
  editedDraft: string
}

export type RolloverPlan =
  | { kind: 'keep' } // 日付が変わっていない（そのまま続ける）
  | { kind: 'carry'; targetDate: string } // 言葉のある書きかけ: 書き始めた日の記録として続ける
  | { kind: 'reset' } // 言葉が無い（気分だけ）・7日より前: 消して今日の入力にする

/** 書きかけに本人の言葉（メモ・清書）があるか */
export function hasUnsavedWords(p: Partial<PendingCheckin>): boolean {
  return [p.events, p.challenges, p.gratitude, p.freeform, p.editedDraft].some(
    (s) => typeof s === 'string' && s.trim().length > 0
  )
}

/** 日付が変わったとき、書きかけをどうするか */
export function planDateRollover(p: Partial<PendingCheckin>, today: string): RolloverPlan {
  if (!p.checkinDate || p.checkinDate === today) return { kind: 'keep' }
  const entryDate = p.targetDate || p.checkinDate
  if (hasUnsavedWords(p) && isValidPastDate(entryDate, today)) return { kind: 'carry', targetDate: entryDate }
  return { kind: 'reset' }
}

/** ホームで「書きかけ」と出すか（今日の入力で気分を選んである／言葉のある書きかけが残っている） */
export function hasPendingCheckin(p: Partial<PendingCheckin>, today: string): boolean {
  const plan = planDateRollover(p, today)
  if (plan.kind === 'carry') return true
  if (plan.kind === 'reset' || !p.checkinDate) return false
  // 今日書き始めたもの。過去日付の書きかけは、言葉があるときだけ
  return p.targetDate ? hasUnsavedWords(p) : p.mood != null
}
