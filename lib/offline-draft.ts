// オフライン時・API失敗時のフォールバック日記生成
import type { CheckinInput } from '@/stores/checkin'
import { MOODS, ENERGY } from '@/lib/constants'
import { formatJSTDate, isISODate, todayJST } from '@/lib/jst'

export interface DraftResult {
  draft: string
  tags: string[]
  summary: string
  dominantEmotion: string
  fromAI?: boolean // AI の清書から作られたか（false ならテンプレート／本人のメモそのまま）
}

/** テンプレートの見出し（メモの4欄の順） */
const SECTIONS = [
  ['events', '【今日の出来事】'],
  ['challenges', '【課題・困ったこと】'],
  ['gratitude', '【感謝できること】'],
  ['freeform', '【メモ】'],
] as const

// テンプレートベースで日記ドラフトを生成（AI不使用）
// entryDate（YYYY-MM-DD）を渡すと、その日付の日記として生成する（過去日付の書き忘れ救済用）
export function generateOfflineDraft(input: CheckinInput, entryDate?: string | null): DraftResult {
  const moodInfo = MOODS.find((m) => m.value === input.mood)
  const energyInfo = ENERGY.find((e) => e.value === input.energy)

  // API ルートのフォールバックとしてサーバー(UTC)でも実行されるため、日付は必ず Asia/Tokyo で決める
  const baseDate = isISODate(entryDate) ? entryDate : todayJST()
  const today = formatJSTDate(baseDate, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const parts: string[] = []

  // 日付と気分・エネルギー
  parts.push(`${today}の記録`)
  parts.push('')

  if (moodInfo && energyInfo) {
    parts.push(
      `今日の気分は${moodInfo.label}（${moodInfo.emoji}）、エネルギーは${energyInfo.label}でした。`
    )
  }

  // 書いた欄だけ、見出しをつけて並べる
  for (const [field, heading] of SECTIONS) {
    const text = input[field]?.trim()
    if (text) parts.push('', heading, text)
  }

  const draft = parts.join('\n')

  // タグを自動生成
  const tags: string[] = []
  if (moodInfo) tags.push(moodInfo.label)
  if (energyInfo) tags.push(`エネルギー:${energyInfo.label}`)
  if (input.challenges?.trim()) tags.push('課題あり')
  if (input.gratitude?.trim()) tags.push('感謝')

  // サマリー
  const moodText = moodInfo ? `気分${moodInfo.label}` : ''
  const energyText = energyInfo ? `エネルギー${energyInfo.label}` : ''
  const summary = [moodText, energyText].filter(Boolean).join('・')

  // 主要感情
  const dominantEmotion = getDominantEmotion(input.mood ?? 3)

  return { draft, tags, summary, dominantEmotion }
}

function getDominantEmotion(mood: number): string {
  const emotions: Record<number, string> = {
    1: '落ち込み',
    2: '不安',
    3: '平静',
    4: '満足',
    5: '喜び',
  }
  return emotions[mood] ?? '平静'
}
